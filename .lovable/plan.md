# Next Belt Test card — read the class's date, not the per-student copy

## What changes

On the parent dashboard, the "Next Belt Test" card stops reading each child's own
copy of the test date and instead derives it from the classes that child is
enrolled in — exactly as the Calendar already does. The ~30 children whose class
has a date but whose individual copy is blank will start seeing the card.

## How the date is chosen

- Collect every class the selected child is enrolled in.
- Keep the classes that have a test date of today or later.
- Take the earliest of those. That single value feeds both the countdown number
  and the date label, so they can never disagree.
- If nothing qualifies (all dates past, or none set), the card renders exactly as
  it does today with no date: "—" days and "No test scheduled".

## Technical detail

- `src/routes/_authenticated/index.tsx` only.
- Add one query, `["student-test-dates"]`: `class_schedules` → `id, class_name,
  next_test_date` with `.not("next_test_date","is",null)`, combined with the
  existing `useEnrollments()` hook from `src/lib/enrollment.ts` (both readable by
  a parent under current RLS — `class_schedules` SELECT is `true` for
  authenticated, `student_classes` SELECT allows a parent their own children; no
  policy change needed).
- One `useMemo` returns `{ date, className } | null` for the selected student,
  using `parseDateOnly` for the today-or-later comparison. `daysToTest` becomes
  `daysUntilDateOnly(testDate)`; the label becomes `formatDateOnlyLong(testDate)`
  — both off the same memo value.
- Remove `next_test_date` from the dashboard `Student` type so the old field
  cannot be read again by accident.
- No writes, no backfill, no trigger, no migration, no RLS/grant/function change.
  Calendar untouched.

## Not doing unless you say so

Showing which class the test belongs to when a child is in several. The memo will
carry the class name so it is a one-line addition later.

## Verification

Playwright over HTTPS signed in as the real parent `falconpllc@gmail.com`
(non-admin, data untouched): screenshot of Lily Khan / Eliza Khan showing the
countdown and the 2026-11-10 label together; a temporary clearly-labelled test
student in two classes with different dates proving the soonest wins, deleted
afterwards; a student with no class date proving unchanged behaviour; Calendar
screenshot unchanged; `git diff --stat`; grep proving `students.next_test_date`
is gone from the dashboard path.

Plus a report (no fix) of everywhere `students.next_test_date` is still written
or editable.
