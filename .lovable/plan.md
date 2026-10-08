# Round 57 — Dojo Points reset every two months (Chicago calendar)

## Facts checked (read-only, 8 Oct 2026 22:37 UTC)
- Database `TimeZone` = **UTC**; `CURRENT_DATE` = 2026-10-08.
- point_events: 284 rows, SUM(delta) = 35, 0 rows with null created_at.
- Rows whose occurred_on differs from the Chicago date of created_at: **62**.
- Of those, rows that would cross a month (and so a two-month period) boundary: **0**.

## One definition of "current period start" — SQL helper
New `public.points_period_start(_at timestamptz DEFAULT now()) RETURNS date`
(IMMUTABLE-free, STABLE, `SET search_path = public`):
```text
d := (_at AT TIME ZONE 'America/Chicago')::date
start := make_date(year(d), ((month(d)-1)/2)*2 + 1, 1)
```
Why SQL rather than TypeScript + matching SQL: there is then literally one copy. `get_leaderboard` calls it in `bounds`; the dashboard calls it via `supabase.rpc("points_period_start")` and uses the result for its `.gte("occurred_on", …)` filter. The old client `monthStart` computation is deleted, so nothing can drift. The period end/next reset (start + 2 months) is derived from the same returned date for the copy. Granted EXECUTE to authenticated and service_role only (REVOKE from PUBLIC, anon).

## Migration (one file, drizzle/migrations/)
1. Create `points_period_start`.
2. `CREATE OR REPLACE get_leaderboard` — identical except `date_trunc('month', CURRENT_DATE)::date` → `public.points_period_start()`. all_time branch, divisions_of, `> 0` filter, LIMIT 10, last-initial untouched; owner, SECURITY DEFINER, STABLE, search_path, grants kept.
3. `ALTER TABLE point_events ALTER COLUMN occurred_on SET DEFAULT ((now() AT TIME ZONE 'America/Chicago')::date)`.
4. One-time date correction exactly as specified (dates only; delta, student_id, students.points untouched). Note: the migration tool normally takes schema only; this UPDATE ships with the default change as the specified backfill. If the tool rejects it, I run the same statement separately via the data tool and report that.

award_points, revert_point_event, attendance_events: not touched.

## Proposed copy (please approve exact strings)
Leaderboard (example shown for today; months/date computed from the period start):
- Intro: "Top 10 by Dojo Points earned Sep–Oct, with a separate board for each training division."
- Reset line: "Leaderboard resets 1 November, then every two months. Your all-time points are on your dashboard and never reset."
- Empty: "No points logged yet for Sep–Oct. Be the first on the board!"
- Podium caption: "Dojo Points Sep–Oct"

Dashboard stat sub-line: "Sep–Oct: N · resets 1 November · all-time points never reset"

## Verification to report
- git diff --stat, full migration text, package.json/bun.lock diff.
- `SHOW TimeZone` output.
- Boundary test: `points_period_start('2026-10-31 23:00 America/Chicago')` → 2026-09-01; `points_period_start('2026-11-01 00:30 America/Chicago')` → 2026-11-01 (no points awarded).
- One existing student: dashboard-formula SUM vs leaderboard-formula SUM in SQL at the same moment — must match. No family sign-in.
- Before/after: row count, SUM(delta), one student's students.points; mismatch count 62 → 0; boundary-crossing count.
- Screens checked as the staff test account only.
