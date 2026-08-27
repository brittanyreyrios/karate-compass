# Round 25 — make points and attendance writes atomic

One migration, three SECURITY DEFINER functions, two frontend files rewritten to call them. Nothing else.

## Migration (single file)

`public.award_points(_student_id uuid, _delta integer, _reason text DEFAULT NULL) RETURNS jsonb`
- `SECURITY DEFINER`, `SET search_path TO 'public'`; first statement is the admin check (`has_role(auth.uid(),'admin')` → `RAISE EXCEPTION`), same as `admin_reassign_student`.
- `SELECT points INTO v_current FROM students WHERE id = _student_id FOR UPDATE`; raise if the student does not exist.
- `v_new := GREATEST(0, v_current + _delta)`, `v_applied := v_new - v_current`.
- `v_applied = 0` → return with `event_id: null`, no `point_events` row written.
- Otherwise update `students.points`, insert `point_events (student_id, delta, reason, awarded_by := auth.uid())` returning the id.
- Returns `{student_id, delta, new_total, event_id}`.

`public.revert_point_event(_event_id uuid) RETURNS jsonb`
- Same admin check. Reads `student_id` and `delta` from `point_events` itself (no client-supplied numbers); raises if the event is gone.
- Locks the student row `FOR UPDATE`, sets `points = GREATEST(0, points - delta)`, then deletes the event row.
- Returns `{student_id, delta, new_total, event_id}`.

`public.change_attendance(_student_id uuid, _delta integer) RETURNS jsonb`
- Same admin check, locks the student row `FOR UPDATE`.
- `_delta = 0` → no-op, returns the current total.
- `_delta > 0` → counter `+ _delta`, insert exactly that many `attendance_events` rows with `occurred_on = CURRENT_DATE`, `created_by = auth.uid()`.
- `_delta < 0` → `wanted := LEAST(-_delta, current)`, delete the `wanted` newest rows (`ORDER BY occurred_on DESC, created_at DESC LIMIT wanted`), lower the counter by the number actually deleted (may be fewer — the partial case).
- Returns `{student_id, delta, requested, new_total}` — same shape the client returns today.

Grants last, mirroring `admin_reassign_student`: `GRANT EXECUTE ... TO authenticated, service_role` plus an explicit `REVOKE EXECUTE ... FROM anon` for each of the three (the schema default privilege grants anon otherwise).

## Frontend (`src/lib/points.ts`, `src/lib/attendance.ts`)

Each exported function keeps its exact name, options object and return type, so `admin.tsx` needs zero changes:
- `awardPoints({studentId, currentPoints, delta, reason})` → `supabase.rpc('award_points', ...)`; `currentPoints` is accepted and ignored (the DB now reads it under lock). Returns the same `PointAward`.
- `revertPointEvent({studentId, currentPoints, delta, eventId})` → `supabase.rpc('revert_point_event', {_event_id: eventId})`, still returns `void`. `eventId === null` is a no-op, which is exactly when `awardPoints` applied 0 anyway.
- `changeAttendance({studentId, currentAttendance, delta})` → `supabase.rpc('change_attendance', ...)`, returns the same `AttendanceChange` (`delta`, `requested`, `newTotal`) so partial-decrease messaging still works.

## Verification I will paste back

Full migration SQL and confirmation it is the only one; `git diff --stat`; `pg_proc.proacl` for the three functions showing no `anon=X`; a `ZZTEST` student exercised through two awards, one revert, a positive and an over-large negative attendance delta with counter + audit rows after each call; a genuine concurrent double `award_points`; before/after `md5(prosrc)` for `division_of`, `divisions_of`, `get_leaderboard`, `get_curriculum_for_student`, `get_curriculum_for_all_children`, `get_technique_library`; and proof the test student and rows are gone with no real student touched.

Out of scope and untouched: table columns, audit-table schemas, caller-visible report shapes, any frontend file besides the two libs, and everything from Round 24.
