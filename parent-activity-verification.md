# Weekly parent dashboard usage — verification

Approved SQL applied byte-for-byte through the platform migration tool as `drizzle/migrations/0019_weekly_parent_dashboard_usage.sql`. The three application files match the approved code diff exactly. Frozen `supabase/migrations/` untouched. No pages or dependencies added.

## Fixture results
Only the permanent negative parent and zzstaff accounts used. No signup, invite use, real-family account testing, student edits, or account changes.

- **a — passed:** Actual parent dashboard opened and reloaded; exactly one activity row for that profile on Chicago date 2026-11-22. The development preview mounted effects twice, producing repeated requests; the database key still deduplicated to one row.
- **b — passed:** Staff opened the shared dashboard; no staff activity row. Staff-page navigation made zero logging requests.
- **c — passed:** Parent direct table selection returned zero rows with no error despite its existing activity row.
- **d — passed:** Parent weekly summary was refused with `Admins only`.
- **e — passed:** Staff summary initially returned no measured finished weeks. Temporarily backdated the new table comment to 2026-10-18 and inserted only negative-fixture historical dates. Staff received four finished Monday weeks (October 19, October 26, November 2, November 9), each with zero active parents, 90 eligible parents, and 0.0%. Independent read-only eligibility aggregate also returned 90. Fixture activity and eligibility excluded. Restored exact original comment.

All five integration tests passed in three runs (initial, historical, restored). Desktop and 390px phone screenshots confirmed initial text and populated summary; no horizontal overflow. Actual staff summary displayed `Parents active last week: 0 of 90 (0.0%) · 4-week average: 0.0%`. Browser reported no page errors. Privacy sentence rendered. Final preview build: OK at 02:13:05 UTC.

Zero-eligible NULL handling was inspected in SQL/UI, not induced by changing real eligibility. Four-week arithmetic was exercised with zero percentages, not a synthetic nonzero real-parent numerator. These limits avoid modifying real accounts.

## Cleanup and readback
Historical and final rerun fixture activity rows removed. No permanent fixtures removed. Exact restored comment: `{"measurement_started_on": "2026-11-22"}`. Temporary comment changes used platform migrations 0020 and 0021, keeping the final deployment comment replayable in migration history.

- Columns: profile_id UUID NOT NULL; activity_date DATE NOT NULL.
- Composite primary key; profiles foreign key ON DELETE CASCADE.
- RLS enabled; exactly one authenticated admin SELECT policy, no write policies.
- Table grants: authenticated SELECT only; service_role ALL; no PUBLIC/anon grants. Platform-managed sandbox_exec privileges are present and were not modified.
- Both functions SECURITY DEFINER, fixed search_path=public. Weekly summary STABLE; logging VOLATILE.
- Both function ACLs: owner and authenticated EXECUTE only. Anonymous/service-role EXECUTE false; no PUBLIC execution. Summary performs its own admin check.
- Every pre-existing policy readback matches the baseline byte-for-byte.

## Quick scan
Completed November 23, 2026 at 02:12:58 UTC: **zero new findings**, eight existing findings (one app-settings warning, seven shared-reference notices), no errors. Nothing dismissed or marked fixed. Other previously reported security items remain outside this request.

## Dependencies, credentials, publishing
`package.json` diff: empty. `bun.lock` diff: empty. **No dependency changes.** Tracked private-credential pattern check: zero matches. Private fixture sessions removed after checks.

**The dashboard change needs publishing.** No publish requested or performed. Database changes are already applied; the published dashboard does not start making the new logging call until app changes are published. Saved `measurement_started_on` is **2026-11-22**, the Chicago calendar date at migration time. First fully measured calendar week under this saved boundary is November 23–29, with a report available November 30; publishing later reduces actual dashboard coverage even though the saved date remains unchanged.