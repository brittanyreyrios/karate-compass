# Round 62 — Absence log, editable absences, all-time class tally

## Checked before planning (real output, 12 Oct 2026)
- attendance_events mismatched rows (occurred_on vs created_at in Chicago): **68** (brief expected ~36 on 3 Oct — more evening check-ins since). Column default: `CURRENT_DATE`.
- point_events mismatched rows: **0**; default `((now() AT TIME ZONE 'America/Chicago'::text))::date` (R57 pattern, followed here).
- change_attendance proacl: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
- change_attendance is also called by the student edit dialog (manual attendance correction, admin.tsx ~1766), not just check-in.

## Migration (one file, drizzle/migrations/0005_r62_absence_events.sql)
1. `public.absence_events`: id uuid PK, student_id uuid NOT NULL → students ON DELETE CASCADE, occurred_on date NOT NULL default `((now() AT TIME ZONE 'America/Chicago'))::date`, class_name text NULL, created_by uuid (plain uuid, no auth.users FK), created_at timestamptz NOT NULL default now(). Index (student_id, occurred_on).
   - **class_name choice:** a text snapshot of the student's primary class (students.class_name) at the moment of marking. attendance_events has no class column and mark_absent takes only the student id, so a snapshot is the honest, simple option; it is display-only.
   - GRANT SELECT/INSERT/UPDATE/DELETE to authenticated, ALL to service_role; RLS on; one policy: admins ALL via `has_role(auth.uid(),'admin')`. No parent policy.
2. `ALTER TABLE attendance_events ALTER COLUMN occurred_on SET DEFAULT ((now() AT TIME ZONE 'America/Chicago'))::date`.
3. `CREATE OR REPLACE change_attendance` — body byte-identical except `CURRENT_DATE` → `(now() AT TIME ZONE 'America/Chicago')::date`. Delta / partial-decrease / row-count logic untouched.
4. `mark_absent(_student_id)` — SECURITY DEFINER, search_path public, admin check, `SELECT … FOR UPDATE` on the student, insert one row (Chicago today, class snapshot, auth.uid()), increment streak; returns jsonb {student_id, absence_id, streak}.
5. `remove_absence(_absence_id)` — same shape; locks the student, deletes the row, adjusts the streak.
   - **Streak rule:** decrement by 1 (never below 0) **only if the absence was recorded after the student's latest check-in** (absence created_at > newest attendance_events created_at). An absence from before the last check-in is no longer part of the current streak, so removing it leaves the streak alone. Undo of a just-marked absence therefore restores exactly the previous value.
6. `check_in_student(_student_id)` — **separate locked function, not inside change_attendance**, because change_attendance also serves manual corrections in the edit dialog, which must not wipe the streak. It locks the student, calls change_attendance(_student_id, 1) in the same transaction, sets consecutive_absences = 0, never touches absence_events.
7. One-time correction: the exact UPDATE from the brief on attendance_events (created_at not null only). point_events untouched.
8. Last DDL: REVOKE EXECUTE FROM PUBLIC, anon and GRANT to authenticated on the three new functions and change_attendance; then proacl verification query.

**Editing an absence's date:** left out. A moved date can cross a check-in and change which absences belong to the streak; remove-and-re-mark covers it.

## Admin UI (admin.tsx; new src/lib/absences.ts)
- Absent button → `mark_absent`; toast "Absent · streak N" with a 3-second Undo calling `remove_absence`, same pattern as the Dojo Points toast.
- Present button → `check_in_student` (no more client update of the streak).
- Student record (edit dialog): "Absences this year: N" at the top, then history rows (date, class, who marked it by email/family name of the admin), Remove per row → confirm "Remove the absence for {first} {last} on {date}?".
- FollowUpBadge / riskLevel / riskCardClasses untouched.

## Yearly reset by filtering
"This year" = occurred_on between Jan 1 and Dec 31 of the current Chicago year. Nothing deleted, no scheduled job.

## Parent dashboard (index.tsx)
- Year from GYM_TIMEZONE (new tiny helper `gymYear()` exported from schedule-time.ts using the existing constant) instead of `new Date().getFullYear()`.
- Attendance card: "This year: 12 · All-time: 47 (since Aug 2026)"; all-time = students.attendance_count. Layout checked at 390/768/1024/1025/1536 with scrollWidth.

## Test plan (temporary "ZZTEMP R62 Test" child under zz.test.negative; fixture child not used)
Mark ×2, Undo ×1, remove from history, check in — rows and streak after every step; two simultaneous mark_absent calls (+2 rows, +2 streak); non-admin refusal for mark_absent/remove_absence and zero rows from absence_events as zz.test.negative; last-year absence excluded from the count; follow-up badge before/after screenshot. Staff checks as the staff test account. Cleanup: temp child (cascades its rows), counts back, ZZTEST54 untouched.

## Not touched
point_events, award_points, leaderboard, Dojo Points display, R58 guardian objects, R54 belt-test path, R54b auth path, legal pages.

## Report
Migration text and file list, pg_proc definitions and proacl, correction counts before/after, point_events 0, git diff --stat with package.json / bun.lock stated, all test output.
