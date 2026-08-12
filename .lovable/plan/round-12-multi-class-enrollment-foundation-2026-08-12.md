# Round 12 — Multi-class enrollment (foundation)

Locked in from your answers: a student may be in zero classes (allowed, flagged in admin), removing the primary class auto-promotes the oldest remaining enrollment, and lists show the primary class only.

Still open: which class belongs to which programme. I will not guess it. The programmes table and the per-class dropdown ship in this round with every class left unassigned, and I'll set them the moment you tell me — either here or by picking them yourself on the Class Schedules tab. Nothing in the app reads programmes yet, so unassigned is harmless.

## AS1 — The `student_classes` join table

`student_id` → `students(id)` on delete cascade, `class_id` → `class_schedules(id)` on delete cascade, `is_primary boolean`, `created_at`, unique on `(student_id, class_id)`, plus a partial unique index guaranteeing at most one primary row per student. Indexes on both columns for the attendance and count queries.

Access: parents can read enrollment rows for their own students; admins can read and write everything. Grants for `authenticated` and `service_role`; no `anon`.

## AS2 — Migrating existing data

One row per student from `students.class_name`, matched with `lower(btrim(...))`, marked primary. The migration reports three counts: students migrated, students whose class name matched no class row, and classes with no students. Unmatched students are listed by name so they can be fixed by hand — never dropped.

## AS3 — What happens to `class_name`

**Kept, but strictly derived — never independently writable.** Reason: dropping it would touch roughly fifty read sites and the CSV importer in the same change as the migration itself, which is how a large structural change goes wrong. Instead:

- A trigger on `student_classes` (insert/update/delete) rewrites `students.class_name` from the primary row, or to an empty-meaning `'Unassigned'` when there is none. That trigger is the **only** writer.
- Application code no longer writes `class_name` anywhere, and no logic compares it. It exists solely as a display convenience and a safety net for anything I miss.

## AS4 — Switching every reader to the relationship

- **Master Attendance filter** — students are fetched through the join table, so a child in two classes appears under both filters. Attendance rows are keyed on `student_id` only, so logging under one class cannot double-count.
- **`division_of`** — rewritten to take the student, keeping the null-rank branch first, and the teen/adult test becomes "is this student in **any** class flagged `is_teen_adult`". `SECURITY DEFINER`, `SET search_path`, REVOKE/GRANT pairs preserved.
- **`class_student_counts()`** — counts through the join table. Admin check stays the first statement.
- **`set_class_test_date`** — pushes the date to students enrolled in that class via the join table instead of a name comparison. Admin check first, announcement lifecycle untouched, still one transaction, still returns `students_updated` and `announcement_action`.
- **`get_leaderboard`** — only the division source changes. The bounds CTE, the covering index and the last-initial truncation `upper(left(btrim(st.last_name), 1)) || '.'` stay exactly as they are; I will quote that line back from the code I write.
- **CSV importer** — resolves the selected class to a `class_id` and creates the enrollment row; it stops writing a text class name.
- **Admin student list and leaderboard** — primary class only, per your answer.

## AS5 — Enrollment at signup

`pending_student_imports` gets `class_id uuid REFERENCES class_schedules(id)`, resolved at import time where a human is watching — the same shape as the belt-rank fix. Existing parked rows are backfilled by normalised name match, with resolved vs unmatched counts reported.

`handle_new_user` then creates the enrollment row from `class_id`, falling back to a normalised name match for rows parked before the column existed. The whole linking block stays inside `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING` — enrollment failing can never stop a parent signing up.

## AS6 — Admin enrollment management

In Manage Students, each student shows their classes as removable chips with an obvious "Add class" control (a dropdown of classes they aren't in yet). One chip is marked Primary, with a control to change which. Removing the primary auto-promotes the oldest remaining enrollment; removing the last one leaves the student in no class.

A **"students in no class (n)"** counter joins the existing "No belt rank set (n)" chip, clickable to filter, so it can be driven to zero after each wave of signups.

## AT — Programmes

- `programs` table: name, sort order, active. Seeded with Karate, Jiu Jitsu & Wrestling, Tai Chi. Admin-editable (add/rename/reorder); readable by any signed-in user.
- `class_schedules.program_id` nullable FK, set with a dropdown on the Class Schedules tab.
- A student's programmes are derived from their classes. Nothing reads programmes this round; nothing families see changes.

## Out of scope

Technique library, jiu jitsu belt system and its leaderboard division, the tai chi tier-scoping fix, and anything about karate belts or the belt progress strip.

## Verification I will report back

- Every changed database function executed for real: `division_of`, `class_student_counts()`, `set_class_test_date` across set/move/clear, all five `get_leaderboard` divisions, and a real signup against a parked row — with what each returned.
- Reconciliation: active students counted through the join table versus the total, matching exactly.
- One student enrolled in two classes, appearing under both attendance filters, with attendance logged once.
- The truncation line quoted back from the shipped code.
- 360px check on the admin screens whose layout changes.
- One line per section, including the ones that go exactly as planned.

## What this still excludes

- A student in zero classes stays on the roster and dashboard, shows "No class set", is counted by the new admin chip, and is simply unreachable by attendance and class counts until enrolled.
- Removing the primary class auto-promotes the oldest remaining enrollment; if none remain, the student has no primary and their derived label reads "Unassigned".
