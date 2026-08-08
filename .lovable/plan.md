# Round 10 — Loose ends before launch

Answers locked in: tai chi is identified by class name `Tai Chi` only; the single level is called **Tai Chi Flow**; AO1 becomes one SECURITY DEFINER database function; AP uses neutral "student" wording.

## AK — Tai Chi as a fourth, beltless system

Migration (append-only):

- Add `belt_systems.uses_belts boolean NOT NULL DEFAULT true`.
- Insert system `tai_chi` ("Tai Chi", `uses_belts = false`, sort_order after solid) with one rank: **Tai Chi Flow**, pattern `solid`, tier `beginner`, sort_order 0. Colours stored but unused for display.
- Migrate existing students: set `belt_rank_id` to Tai Chi Flow where `lower(btrim(class_name)) = 'tai chi'` and `belt_rank_id IS NULL`. Same normalisation applied to the 4 parked roster rows in AL's backfill. Count reported.
- `class_schedules` row for Tai Chi is already `is_teen_adult = true`, so `division_of` places them on Teen & Adults once they have a rank. The NULL-first ordering in `division_of` is left exactly as it is.

Frontend, data-driven off `uses_belts` (never a slug check):

- `src/lib/belts.ts`: carry `uses_belts` on `BeltSystem`; add helpers `systemUsesBelts()` and a rank-noun helper returning "Belt" or "Level".
- New neutral `LevelChip` (text chip, no belt graphic) rendered instead of `BeltSwatch` wherever the student's system has `uses_belts = false` — dashboard, roster tables, curriculum headings, leaderboard rows.
- Dashboard: the "Road to Black Belt" progress panel is omitted entirely for a beltless system and replaced by a small "Current level: Tai Chi Flow" card. No 100% bar, no one-step ladder.
- Labels switch "Belt" → "Level" for those students (stats card, belt picker group heading, admin filters).

## AL — Auto-linked children arrive with no rank

- Migration: `ALTER TABLE public.pending_student_imports ADD COLUMN belt_rank_id uuid REFERENCES public.belt_ranks(id)`.
- Backfill existing parked rows using the existing `resolve_belt_rank_id()` matcher (name/short_name, active ranks, ambiguous → NULL). Report resolved vs still-ambiguous counts.
- Admin CSV importer: rows parked for a missing parent now carry the `belt_rank_id` that `findRanks()` already resolved with the selected belt system, so matching happens where a human is watching.
- `handle_new_user()` recreated (new migration): copies `r.belt_rank_id` into the student, falling back to `resolve_belt_rank_id(current_belt)` when the parked row predates the column. The whole linking block stays inside `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING` — signup can never fail because of a rank lookup.

## AM — Reassign a student to another parent

- Migration: `admin_reassign_student(_student_id uuid, _new_parent_email text)` — SECURITY DEFINER, `SET search_path = public`, first statement `IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION`. Looks the profile up by normalised email; raises a clear "No account found for that email" if absent; otherwise updates `students.parent_id` in place and returns the destination family name. REVOKE EXECUTE FROM anon, public; GRANT to authenticated, service_role. RLS on `students` continues to restrict direct updates to admins.
- Admin → Manage Students: per-student "Move to another parent" control with an email lookup and a confirmation dialog naming both the child and the destination family/email.
- On success, invalidate the student/roster/dashboard query keys and the realtime-backed caches so the child leaves the old dashboard and appears on the new one without a re-login.

## AN — Tournaments in real date order

- A shared `useTournaments()` query (new `src/lib/announcements.ts`): `category = 'tournament'`, server-side `.order("event_date", { ascending: true, nullsFirst: false })`, filtered to `event_end_date >= today OR (event_end_date IS NULL AND event_date >= today)` plus dated-only ordering; undated events sort last.
- Announcements page uses it for the Tournaments column; the dashboard panel uses the same query with a server-side limit. School News keeps its existing newest-first paginated feed untouched. No client-side sorting anywhere.

## AO1 — Testing-date save as one transaction

- Migration: `set_class_test_date(_schedule_id uuid, _date date, _post_announcement boolean)` — SECURITY DEFINER, `SET search_path = public`, admin check first, REVOKE/GRANT as above. In one transaction it updates the schedule date, updates enrolled students using `lower(btrim(s.class_name)) = lower(btrim(cs.class_name))`, and runs the existing announcement lifecycle unchanged (create / update in place / delete + null the link when the date is cleared or the box unticked).
- Returns `students_updated` and an `announcement_action` of `created | updated | deleted | none`; the admin toast reports those values instead of guessing.

## AO2 — Re-targeted curriculum item renumbering

- On save, when `belt_rank_id` or `curriculum_tier` changes, call the existing `next_curriculum_sort_order` RPC for the destination group and store that value. No new locking logic, no `FOR UPDATE`.

## AP — Neutral "student" copy

Sweep parent-facing copy only (dashboard, curriculum, leaderboard, calendar, announcements, gallery, sidebar, empty states) replacing "your child" with neutral "student" wording. Legal documents — Privacy Policy, Terms, Media Release and the consent wording on /settings — are not touched; if any copy change appeared to require it, I stop and say so instead. Every changed string is listed in the reply.

## Verification

- Every new/changed database function executed for real: `set_class_test_date` through the admin UI across set / move / clear, `admin_reassign_student` on a live student, `handle_new_user` exercised by a real signup against a parked tai chi row, plus `division_of` and `get_leaderboard('teen_adult')` for a tai chi student.
- 360px check on any screen whose layout changes.
- Counts reported: tai chi students migrated, parked rows resolved vs ambiguous, students touched by a testing-date save.
