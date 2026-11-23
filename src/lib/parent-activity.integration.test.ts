import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Live checks are opt-in, using only the two approved fixtures.
describe.skipIf(process.env['RUN_PARENT_ACTIVITY_TESTS'] !== "1")("parent dashboard activity — fixtures", () => {
  let parent: SupabaseClient<Database> | undefined;
  let staff: SupabaseClient<Database> | undefined;
  const parentId = "57a7e312-d3cb-40bf-bd89-940a516cadfd";
  const staffId = "d9db9608-b5d0-44f9-bbd4-b44514459708";
  function required(client: SupabaseClient<Database> | undefined) {
    if (!client) throw new Error("Fixture client unavailable");
    return client;
  }
  beforeAll(async () => {
    const path = process.env['PARENT_ACTIVITY_SESSION_FILE'];
    if (!path?.startsWith("/tmp/browser/")) throw new Error("Private fixture session file required");
    const account = z.object({ id: z.string().uuid(), email: z.string(), token: z.string() });
    const config = z.object({ url: z.string().url(), key: z.string(), parent: account, staff: account })
      .parse(JSON.parse(readFileSync(path, "utf8")));
    expect(config.parent.id).toBe(parentId);
    expect(config.parent.email).toBe("zz.test.negative@example.com");
    expect(config.staff.id).toBe(staffId);
    expect(config.staff.email).toBe("leaguecity.tigersden+zzstaff@gmail.com");
    const client = (token: string) => createClient<Database>(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    parent = client(config.parent.token); staff = client(config.staff.token);
    for (const [c, fixture] of [[parent, config.parent], [staff, config.staff]] as const) {
      const user = await c.auth.getUser(fixture.token);
      expect(user.error).toBeNull(); expect(user.data.user?.id).toBe(fixture.id);
    }
  });
  it("a. repeated parent dashboard logging stores exactly one Chicago-day row", async () => {
    for (let n = 0; n < 2; n++) {
      const result = await required(parent).rpc("log_dashboard_open");
      expect(result.error).toBeNull();
    }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const rows = await required(staff).from("parent_activity_days").select("profile_id, activity_date")
      .eq("profile_id", parentId).eq("activity_date", today);
    expect(rows.error).toBeNull(); expect(rows.data).toHaveLength(1);
    expect(rows.data?.[0]?.activity_date).toBe(today);
  });
  it("b. staff dashboard logging creates no row", async () => {
    const result = await required(staff).rpc("log_dashboard_open"); expect(result.error).toBeNull();
    const rows = await required(staff).from("parent_activity_days").select("profile_id").eq("profile_id", staffId);
    expect(rows.error).toBeNull(); expect(rows.data).toEqual([]);
  });
  it("c. parent direct selection exposes zero rows", async () => {
    const rows = await required(parent).from("parent_activity_days").select("*");
    expect(rows.error).toBeNull(); expect(rows.data).toEqual([]);
  });
  it("d. parent cannot call the weekly summary", async () => {
    const result = await required(parent).rpc("get_weekly_active_parents", { _weeks: 8 });
    expect(result.data).toBeNull(); expect(result.error?.message).toBe("Admins only");
  });
  it("e. staff receives completed weeks excluding fixture activity and eligibility", async () => {
    const result = await required(staff).rpc("get_weekly_active_parents", { _weeks: 8 });
    expect(result.error).toBeNull();
    const rows = result.data ?? [];
    if (process.env['PARENT_ACTIVITY_HISTORY_READY'] !== "1") {
      expect(rows).toEqual([]); return;
    }
    expect(rows).toHaveLength(4);
    expect(rows.map(row => row.week_start)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26", "2026-10-19"]);
    for (const row of rows) {
      expect(row.active_parents).toBe(0);
      // Independent read-only aggregate at this fixture run: 90 eligible real accounts.
      expect(row.eligible_parents).toBe(90);
      expect(Number(row.pct)).toBe(0);
    }
  });
});