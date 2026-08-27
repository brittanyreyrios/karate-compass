# Jiu Jitsu leaderboard: a student can sit on two boards

One migration, no front-end changes, no schema changes to tables.

## 1. New `public.divisions_of(_student_id uuid) RETURNS text[]`

`SECURITY DEFINER`, `STABLE`, `SET search_path = public`, matching the existing functions.

Body assembles an array with no NULLs and no duplicates:

- The primary division from `public.division_of(_student_id)` — called, not re-implemented, so the two can never drift.
- `'jiu_jitsu'` when the student has any `student_classes` row whose `class_schedules.program_id` is the "Jiu Jitsu & Wrestling" programme (`679fb4c1-8004-4db1-a88b-11e910de640d`), commented by name in the SQL.

Result rules: primary NULL + jiu jitsu class → `{jiu_jitsu}`; neither → `{}`; a jiu-jitsu student whose primary is already `jiu_jitsu` → `{jiu_jitsu}` once.

Execute granted to `authenticated` (and `service_role`) only, matching `division_of`'s current grants.

## 2. `public.get_leaderboard` — one line changed

`AND public.division_of(st.id) = _division` becomes `AND _division = ANY(public.divisions_of(st.id))`. The `bounds` CTE, the `point_events` sum, `COALESCE(pts.total, 0) > 0`, the ordering, `LIMIT 10` and the returned columns are re-issued byte-identical.

## 3. Untouched

`public.division_of` and `public.get_my_division` are not re-created — no signature, body or grant change. No table columns, no programme changes, no class moves, no `leaderboard_divisions` change, no front-end file.

## Evidence I will report

The full migration SQL as committed and confirmation it is the only one; `git diff --stat`; the `first_name / primary / all_divisions` table for all active students; `get_leaderboard('jiu_jitsu','month')`; all five other boards before and after; and `md5(prosrc)` for `division_of` and `get_my_division` before and after to prove they are byte-identical.

Note: the read-only query tool lacks EXECUTE on these functions, so the before/after board captures run through the privileged SQL path instead.
