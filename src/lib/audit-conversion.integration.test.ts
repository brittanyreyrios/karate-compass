import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Exact dedicated identities and explicit opt-in; never run against real imports.
describe.skipIf(process.env.RUN_AUDIT_CONVERSION_TESTS !== "1")("audit conversion — live fixtures", () => {
  let staff: SupabaseClient;
  let parent: SupabaseClient;
  const imports: string[] = [];
  const students: string[] = [];
  beforeAll(async () => {
    const path = process.env.AUDIT_TEST_SESSION_FILE;
    if (!path?.startsWith("/tmp/browser/")) throw new Error("Private fixture sessions required");
    const config = JSON.parse(readFileSync(path, "utf8"));
    expect(config.staff.id).toBe("d9db9608-b5d0-44f9-bbd4-b44514459708");
    const client = (token: string) => createClient(config.url, config.key, {
      auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    staff = client(config.staff.token);
    parent = createClient(config.url, config.key, { auth: { persistSession: false } });
    const auth = await parent.auth.signInWithPassword({ email: "zz.test.secondary@example.com", password: process.env.AUDIT_SECONDARY_PASSWORD ?? "" });
    expect(auth.data.user?.id).toBe("44a1b1c7-c9cd-4192-8717-8c137e5d3c9a");
  });
  async function park(first: string, className: string, email = "brittanyreyrios+zzauditunit@gmail.com") {
    const r = await staff.from("pending_student_imports").insert({ first_name: first, last_name: "Z", parent_email: email, class_name: className, current_belt: "White", start_date: "2026-02-03", belt_rank_id: null }).select("id").single();
    if (r.error || !r.data) throw new Error("Fixture import failed");
    imports.push(r.data.id); return r.data.id as string;
  }
  async function convert(ids: string[]) {
    const r = await staff.rpc("convert_pending_student_imports", { _ids: ids });
    expect(r.error).toBeNull();
    const rows = r.data as { import_id: string; student_id?: string; status: string; in_no_class?: boolean }[];
    for (const row of rows) if (row.status === "converted" && row.student_id) students.push(row.student_id);
    return rows;
  }
  afterAll(async () => {
    for (const id of students) expect((await staff.from("students").delete().eq("id", id)).error).toBeNull();
    for (const id of imports) expect((await staff.from("pending_student_imports").delete().eq("id", id)).error).toBeNull();
  });
  it("matches class names ignoring case/outer spaces and preserves source values/provenance", async () => {
    const id = await park("ZZTEMP Audit Class", "  tiny tigers  ");
    const [row] = await convert([id]);
    expect(row).toMatchObject({ status: "converted", in_no_class: false });
    const r = await staff.from("students").select("parent_id,created_by_staff,start_date,belt_rank_id,current_belt,claim_code").eq("id", row.student_id).single();
    expect(r.data).toMatchObject({ parent_id: null, created_by_staff: true, start_date: "2026-02-03", belt_rank_id: null, current_belt: "White" });
    expect(r.data?.claim_code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    const enrollment = await staff.from("student_classes").select("class_id,is_primary").eq("student_id", row.student_id);
    expect(enrollment.data).toEqual([{ class_id: "6081b118-dfd8-4d76-a771-c1ca7ff63d89", is_primary: true }]);
    expect((await staff.from("pending_student_imports").select("id").eq("id", id)).data).toEqual([]);
  });
  it("converts missing classes without enrollment and reports In no class", async () => {
    const id = await park("ZZTEMP Audit NoClass", "ZZTEST Missing Class");
    const [row] = await convert([id]);
    expect(row).toMatchObject({ status: "converted", in_no_class: true });
    expect((await staff.from("student_classes").select("id").eq("student_id", row.student_id)).data).toEqual([]);
    expect((await staff.from("students").select("class_name").eq("id", row.student_id).single()).data?.class_name).toBe("Unassigned");
  });
  it("bulk duplicate detection converts only one same-name/same-class row and leaves the skipped import", async () => {
    const ids = [await park("ZZTEMP Audit Duplicate", "Tiny Tigers"), await park("ZZTEMP Audit Duplicate", "Tiny Tigers")];
    const rows = await convert(ids);
    expect(rows.filter((r) => r.status === "converted")).toHaveLength(1);
    expect(rows.filter((r) => r.status === "duplicate")).toHaveLength(1);
    const skipped = rows.find((r) => r.status === "duplicate");
    expect((await staff.from("pending_student_imports").select("id").eq("id", skipped?.import_id)).data).toHaveLength(1);
    expect((await convert(ids)).filter((r) => r.status === "converted")).toHaveLength(0);
  });
  it("rolls back a failed row and preserves other bulk conversions", async () => {
    const bad = await park("   ", "Tiny Tigers");
    const good = await park("ZZTEMP Audit Mixed", "Tiny Tigers");
    const rows = await convert([bad, good]);
    expect(rows.find((r) => r.import_id === bad)?.status).toBe("failed");
    expect(rows.find((r) => r.import_id === good)?.status).toBe("converted");
    expect((await staff.from("pending_student_imports").select("id").eq("id", bad)).data).toHaveLength(1);
  });
  it("denies parent conversion and private reference reads", async () => {
    const id = await park("ZZTEMP Audit Forbidden", "Tiny Tigers");
    expect((await parent.rpc("convert_pending_student_imports", { _ids: [id] })).error?.message).toBe("Admins only");
    const privateRows = await parent.from("unclaimed_student_parent_links").select("*");
    expect(privateRows.data).toEqual([]);
  });
  it("clears the email reference when a parent claims via code", async () => {
    const [row] = await convert([await park("ZZTEMP Audit Claim", "Tiny Tigers")]);
    const child = await staff.from("students").select("claim_code").eq("id", row.student_id).single();
    expect((await parent.rpc("claim_student", { code: child.data?.claim_code })).data).toMatchObject({ success: true, student_id: row.student_id });
    expect((await staff.from("unclaimed_student_parent_links").select("student_id").eq("student_id", row.student_id)).data).toEqual([]);
  });
  it("clears the email reference after the existing staff reassignment path", async () => {
    const [row] = await convert([await park("ZZTEMP Audit Reassign", "Tiny Tigers")]);
    expect((await staff.rpc("admin_reassign_student", { _student_id: row.student_id, _new_parent_email: "zz.test.secondary@example.com" })).error).toBeNull();
    expect((await staff.from("unclaimed_student_parent_links").select("student_id").eq("student_id", row.student_id)).data).toEqual([]);
  });
});