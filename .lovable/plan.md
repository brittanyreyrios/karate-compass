# One writer for students.points: route the Edit Student field through awardPoints

No migration, no database change, no change to `get_leaderboard`, and no change to `points.ts`. One file changes: `src/routes/_authenticated/admin.tsx`.

## The change

`StudentEditRow`'s save mutation (admin.tsx ~1489–1508):

1. `points` is removed from the `students` update payload entirely. That update keeps `first_name`, `last_name`, `belt_rank_id`, the `current_belt` fallback, and `attendance_count` — all saving exactly as they do today.
2. After that update succeeds, compute `const entered = Math.max(0, parseInt(points || "0", 10) || 0)`. If `entered !== student.points`, call
   `awardPoints({ studentId: student.id, currentPoints: student.points, delta: entered - student.points, reason: "Manual correction (edit student)" })`.
   Negative deltas are already supported — `awardPoints` clamps the new total at 0 and logs the actually-applied amount, so the ledger row and the balance always agree.
3. If `entered === student.points`, nothing is written: no `students.points` write, no `point_events` row. Changing only a name or belt therefore produces no ledger row.
4. `awardPoints` is imported from `@/lib/points` in this file if it is not already; `onSuccess` also invalidates `["leaderboard"]` alongside `["admin-students"]` so the corrected month total is visible immediately.

Order matters: the profile fields save first, then the points correction, so a failing ledger write surfaces as an error toast rather than silently leaving the balance edited without an audit row.

## Other writers to students.points

Grep over `src/` for writes returns exactly three, matching your list — `src/lib/points.ts:27` and `:59` (inside the funnel, correct) and `src/routes/_authenticated/admin.tsx:1503` (the bug being removed). `admin.tsx:1380` is the `point_events` count for the delete dialog, untouched. There is no fourth writer; the CSV importer and the parking path never set `points`. I will paste the grep output in the report.

## Verification I will paste back

`git diff --stat` (admin.tsx only); the final save mutation; the grep output for `students.points` writes; on a test student with a nonzero balance — edit the points value, save, then the student's `points` plus their full `point_events` rows showing the correcting delta; and a second save changing only the name/belt, showing the `point_events` row count unchanged.
