import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Explicit opt-in, dedicated identities only. This test never uses real families.
describe.skipIf(process.env.RUN_PARENT_CLAIM_DB_TESTS !== "1")("parent claims — live fixtures", () => {
  let staff: SupabaseClient;
  let parent: SupabaseClient;
  let id: string | undefined;
  let code = "";
  beforeAll(async () => {
    const path = process.env.CLAIM_TEST_SESSION_FILE;
    if (!path?.startsWith("/tmp/browser/")) throw new Error("Private fixture sessions required");
    const config = JSON.parse(readFileSync(path, "utf8"));
    expect(config.staff.id).toBe("d9db9608-b5d0-44f9-bbd4-b44514459708");
    expect(config.secondary.id).toBe("44a1b1c7-c9cd-4192-8717-8c137e5d3c9a");
    const client = (token: string) => createClient(config.url, config.key, {
      auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    staff = client(config.staff.token); parent = client(config.secondary.token);
    const r = await staff.from("students").insert({ first_name: "ZZTEMP P3 Integration", last_name: "Z", parent_id: null, created_by_staff: true, active: true, class_name: "Tiny Tigers", belt_rank_id: "bb6f5e16-4e3c-49c6-a05e-85b780ffa560" }).select("id,claim_code").single();
    if (r.error || !r.data) throw new Error("Fixture insert failed");
    id = r.data.id; code = r.data.claim_code;
    await staff.from("student_classes").insert({ student_id: id, class_id: "6081b118-dfd8-4d76-a771-c1ca7ff63d89", is_primary: true });
    for (let n = 0; n < 3; n++) {
      const result = await staff.rpc("check_in_student", { _student_id: id });
      expect(result.error).toBeNull();
    }
    expect((await staff.rpc("award_points", { _student_id: id, _delta: 5, _reason: "ZZTEMP P3 Integration" })).error).toBeNull();
  });
  afterAll(async () => { if (id) expect((await staff.from("students").delete().eq("id", id)).error).toBeNull(); });
  it("excludes an unclaimed child with points, then keeps all 3 checkins and 5 points after claiming", async () => {
    const before = await parent.rpc("get_leaderboard", { _division: "tiny_tiger", _period: "month" });
    expect(before.error).toBeNull(); expect(before.data?.some((s: { id: string }) => s.id === id)).toBe(false);
    const claimed = await parent.rpc("claim_student", { code }); expect(claimed.error).toBeNull();
    expect(claimed.data).toMatchObject({ success: true, student_id: id });
    const child = await parent.from("students").select("attendance_count,points").eq("id", id).single();
    expect(child.data).toEqual({ attendance_count: 3, points: 5 });
    expect((await parent.rpc("get_my_division")).data).toBe("tiny_tiger");
    const after = await parent.rpc("get_leaderboard", { _division: "tiny_tiger", _period: "month" });
    expect(after.data?.find((s: { id: string; period_points: number }) => s.id === id)?.period_points).toBe(5);
  });
});