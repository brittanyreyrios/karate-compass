import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Opt-in live checks. The session file must contain only dedicated fixtures;
// credentials/tokens are never committed or printed. No app module imports this.
const enabled = process.env.RUN_CLAIM_DB_TESTS === "1";
const negativeId = "57a7e312-d3cb-40bf-bd89-940a516cadfd";
const secondaryId = "44a1b1c7-c9cd-4192-8717-8c137e5d3c9a";
const staffId = "d9db9608-b5d0-44f9-bbd4-b44514459708";
type FixtureConfig = {
  url: string;
  key: string;
  negative: { id: string; token: string; email: string };
  secondary: { id: string; token: string; email: string };
  staff: { id: string; token: string; email: string };
};
type Student = { id: string; claim_code: string; parent_id: string | null };

describe.skipIf(!enabled)("claim_student — live dedicated fixtures only", () => {
  let admin: SupabaseClient;
  let parent: SupabaseClient;
  let second: SupabaseClient;
  let anon: SupabaseClient;
  let config: FixtureConfig;
  const students: Student[] = [];
  const prefix = `ZZTEMP CLAIM ${Date.now()}`;
  let claimed: Student;
  let limited: Student;
  let concurrent: Student;
  let failure: unknown;

  const check = <T,>(result: { data: T; error: unknown }): NonNullable<T> => {
    // Do not serialize raw responses containing claim codes or session data.
    if (result.error) throw new Error("Database fixture operation failed");
    // Mutation-only responses legitimately have no data; callers ignore them.
    // Queries use select/single and are asserted below.
    return result.data as NonNullable<T>;
  };
  const client = (token?: string) => createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
  const claim = async (c: SupabaseClient, code: string) => check(await c.rpc("claim_student", { code }));

  beforeAll(async () => {
    const path = process.env.CLAIM_TEST_SESSION_FILE;
    if (!path?.startsWith("/tmp/browser/")) throw new Error("Provide a private fixture session file under /tmp/browser/");
    config = JSON.parse(readFileSync(path, "utf8"));
    expect(config.negative.email).toBe("zz.test.negative@example.com");
    expect(config.secondary.id).toBe(secondaryId);
    expect(config.secondary.email).toBe("zz.test.secondary@example.com");
    expect(config.staff.id).toBe(staffId);
    expect(config.staff.email).toBe("leaguecity.tigersden+zzstaff@gmail.com");
    expect(config.negative.id).toBe(negativeId);
    admin = client(config.staff.token);
    parent = client(config.negative.token);
    second = client(config.secondary.token);
    anon = client();
    check(await admin.from("claim_attempts").select("id").in("user_id", [config.negative.id, secondaryId]));
    for (const name of ["Claim", "Limited", "Race", "Default"]) {
      const row = check(await admin.from("students").insert({
        first_name: prefix, last_name: name, parent_id: null, active: false,
        ...(name === "Default" ? {} : { created_by_staff: true }),
      }).select("id,claim_code,parent_id").single());
      students.push(row);
    }
    expect(students).toHaveLength(4);
    [claimed, limited, concurrent] = students;
  }, 30_000);

  afterAll(async () => {
    // Attempt rows are removed separately through the approved data tool,
    // scoped to fixture IDs and this run's timestamps; no client write policy.
    if (admin && students.length) {
      check(await admin.from("students").delete().in("id", students.map((s) => s.id)));
    }
  }, 30_000);

  it("generates unique 8-character codes without 0/O/1/I/L", () => {
    expect(new Set(students.map((s) => s.claim_code)).size).toBe(4);
    for (const s of students) expect(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(s.claim_code)).toBe(true);
  });

  it("defaults staff provenance to false, allows admins to update unclaimed students", async () => {
    const row = check(await admin.from("students").select("created_by_staff").eq("id", students[3].id).single());
    expect(row.created_by_staff).toBe(false);
    const updated = check(await admin.from("students").update({ created_by_staff: true }).eq("id", students[3].id).select("created_by_staff").single());
    expect(updated.created_by_staff).toBe(true);
  });

  it("parents cannot read or modify unclaimed students; anonymous reads are empty", async () => {
    for (const c of [parent, second, anon]) {
      expect(check(await c.from("students").select("id").in("id", students.map((s) => s.id)))).toEqual([]);
    }
    expect(check(await parent.from("students").update({ parent_id: config.negative.id }).eq("id", claimed.id).select("id"))).toEqual([]);
    const inserted = await parent.from("students").insert({ first_name: prefix, last_name: "Refused", parent_id: null });
    expect(inserted.error).not.toBeNull();
  });

  it("refuses anonymous claim execution", async () => {
    expect((await anon.rpc("claim_student", { code: claimed.claim_code })).error).not.toBeNull();
  });

  it("claims once, preserving student ID, attendance and points", async () => {
    check(await admin.from("attendance_events").insert({ student_id: claimed.id }));
    check(await admin.from("point_events").insert({ student_id: claimed.id, delta: 2, reason: "ZZTEMP CLAIM verification" }));
    const before = check(await admin.from("students").select("id,attendance_count,points,belt_rank_id").eq("id", claimed.id).single());
    expect(await claim(parent, ` ${claimed.claim_code.toLowerCase()} `)).toEqual({ success: true, student_id: claimed.id });
    const after = check(await parent.from("students").select("id,parent_id,claimed_at,claim_code,attendance_count,points,belt_rank_id").eq("id", claimed.id).single());
    expect(after.parent_id).toBe(config.negative.id);
    expect(after.claim_code).toBeNull();
    expect(Number.isFinite(Date.parse(after.claimed_at))).toBe(true);
    expect({ id: after.id, attendance_count: after.attendance_count, points: after.points, belt_rank_id: after.belt_rank_id }).toEqual(before);
    expect(check(await parent.from("attendance_events").select("id").eq("student_id", claimed.id))).toHaveLength(1);
    expect(check(await parent.from("point_events").select("delta").eq("student_id", claimed.id))).toEqual([{ delta: 2 }]);
    const links = check(await admin.from("student_guardians").select("profile_id,is_primary").eq("student_id", claimed.id));
    expect(links).toEqual([{ profile_id: config.negative.id, is_primary: true }]);
  });

  it("preserves second-guardian access but blocks links to unclaimed students", async () => {
    check(await admin.from("student_guardians").insert([
      { student_id: claimed.id, profile_id: secondaryId, is_primary: false },
      { student_id: limited.id, profile_id: secondaryId, is_primary: false },
    ]));
    expect(check(await second.from("students").select("id").eq("id", claimed.id))).toEqual([{ id: claimed.id }]);
    expect(check(await second.rpc("is_guardian_of", { _student_id: limited.id }))).toBe(false);
    expect(check(await second.from("students").select("id").eq("id", limited.id))).toEqual([]);
  });

  it("returns identical failures for used and invalid codes and durably logs them", async () => {
    failure = await claim(parent, "OOOOOOOO");
    expect(failure).toMatchObject({ success: false });
    expect(await claim(parent, claimed.claim_code)).toEqual(failure);
    const rows = check(await admin.from("claim_attempts").select("success").eq("user_id", config.negative.id).order("attempted_at"));
    expect(rows).toEqual([{ success: true }, { success: false }, { success: false }]);
  });

  it("blocks a valid code after five failed attempts in the past hour", async () => {
    for (let i = 0; i < 3; i++) expect(await claim(parent, "OOOOOOOO")).toEqual(failure);
    expect(await claim(parent, limited.claim_code)).toEqual(failure);
    expect(check(await admin.from("students").select("parent_id").eq("id", limited.id).single()).parent_id).toBeNull();
    expect(check(await admin.from("claim_attempts").select("id").eq("user_id", config.negative.id).eq("success", false))).toHaveLength(6);
  });

  it("cannot forge, read as parent, or erase the attempt log", async () => {
    expect(check(await parent.from("claim_attempts").select("id"))).toEqual([]);
    expect(check(await anon.from("claim_attempts").select("id"))).toEqual([]);
    for (const c of [parent, admin]) {
      expect((await c.from("claim_attempts").insert({ user_id: config.negative.id, success: true })).error).not.toBeNull();
      expect(check(await c.from("claim_attempts").delete().eq("user_id", config.negative.id).select("id"))).toEqual([]);
    }
  });

  it("allows only one success for simultaneous claims of the same code", async () => {
    const results = await Promise.all([claim(second, concurrent.claim_code), claim(second, concurrent.claim_code)]);
    expect(results.filter((r) => r.success === true)).toHaveLength(1);
    expect(results.filter((r) => r.success === false)).toHaveLength(1);
    expect(check(await admin.from("students").select("parent_id").eq("id", concurrent.id).single()).parent_id).toBe(secondaryId);
  });

  it("refuses detaching a claimed student's main family", async () => {
    expect((await admin.from("students").update({ parent_id: null }).eq("id", claimed.id)).error).not.toBeNull();
    expect(check(await admin.from("students").select("parent_id").eq("id", claimed.id).single()).parent_id).toBe(config.negative.id);
  });
});