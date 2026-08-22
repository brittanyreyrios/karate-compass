# Archive/restore/delete students, and parking a student before the parent signs up

Front-end only. No migrations, no schema changes. Verified already in place:
`students.active` exists, admins already have update and delete permission on
students, and deleting a student already cascades to attendance records, point
entries, poll votes and class enrolments. `pending_student_imports` holds 92 rows
and the signup linking already consumes them case-insensitively.

## Section A — Manage Students: archive, restore, delete

- **All Students list** shows only active students. Each row gets an **Archive**
  action that writes `active = false` — one boolean write, nothing else. No new
  column, no new table.
- **New "Archived" section** below the list, collapsed by default with a count.
  Each archived row shows name, belt and former class label, plus **Restore**
  (`active = true`).
- **Delete** appears only inside the Archived section. Active rows have no delete
  control at all — an admin must archive first, then find the student in the
  archive.
- **Delete confirmation dialog**:
  - On open, queries the real counts for that student: attendance records, point
    entries, class enrolments (and poll votes, if any) — read from the database,
    never estimated.
  - Sentence built from those counts: "This permanently deletes Billy Bishop,
    47 attendance records, 12 point entries and 2 class enrolments. This cannot
    be undone."
  - States plainly that archiving is reversible and deleting is not.
  - The delete button stays disabled until the admin types the student's full
    name exactly.
  - One student at a time. No bulk or multi-select delete.

Reader functions, RLS policies and points/attendance recording are untouched.

## Section B — Add Student: parent has no account yet

The Add New Student form gets a two-way choice:

1. **Parent already has an account** — current behaviour, unchanged.
2. **Parent hasn't signed up yet** — the student is saved as a parked row in
   `pending_student_imports`, carrying `belt_rank_id` and `class_id` straight
   from the form's selectors (no belt text re-resolution).

Rules:

- The CSV importer's parking insert is extracted into one shared helper used by
  both the importer and the form, so there is a single writer with one set of
  rules. Email is trimmed and lowercased there, exactly as the importer does.
- **If a profile already exists with that email**, parking would create a row
  nobody ever consumes. The form refuses and names the existing account, telling
  the admin to switch to the "already has an account" path. That state is never
  created.
- **Duplicate guard**: before parking, check for an existing parked row *and* an
  existing active student with the same first and last name under that parent
  email. If either exists, refuse with a clear message and create nothing.
- Plain-language preview under the form: "Ellie Rodriguez will be held until a
  parent signs up with sarah@example.com, then linked automatically."
- Rows created this way appear in the existing parked-row management view exactly
  like imported ones (same table, same columns).

`handle_new_user` is not touched.

## Verification (real output, ZZ-labelled test rows, deleted afterwards)

Section A: archive a ZZ student and show `active` before/after plus their
disappearance from the leaderboard and class counts; restore and show attendance
and points intact; screenshot showing no delete control on an active row; delete
an archived ZZ student and paste the exact counts the dialog displayed, then show
zero remaining rows in all four child tables. Report `students` row count before
and after.

Section B: park a ZZ student for an unknown email and show the stored row with a
trimmed, lowercase email; sign up with that email in mixed case and show the
child linked and the parked row consumed; attempt to park for an email that
already has an account and show the refusal; attempt a duplicate park and show
the refusal. Report `pending_student_imports` and `students` counts before and
after and confirm the 92 pre-existing parked rows are untouched.

## Technical notes

- New file `src/lib/park-student.ts`: normalisation, duplicate/profile checks and
  the single `pending_student_imports` insert; the CSV importer switches to it.
- Changes confined to `src/routes/_authenticated/admin.tsx` plus that helper.
- `server.ts`, the CSP, `client.ts` and all database functions unchanged.
