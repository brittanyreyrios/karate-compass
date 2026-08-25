# One writer for students.points: route the Edit Student field through awardPoints

No migration, no database change, no change to `get_leaderboard`, and no change to `points.ts`. One file changes: `src/routes/_authenticated/admin.tsx`.

## The change

`StudentEditRow`'s save mutation (admin.tsx ~1489–1508):

1. `points` is removed from the `students` update payload entirely. That update keeps `first_name`, `last_name`, `belt_rank_id`, the `current_belt` fallback, and `attendance_count` — all saving exactly as they do today.
2. The form captures a baseline when it opens: `const [pointsBaseline] = useState(student.points)`, populated from the same value as the input's `useState(String(student.points))`. The delta is computed against that baseline, never against the live prop. I will not re-sync the field or the baseline when the prop changes — the displayed number and the baseline stay the same number for the life of the open form, which is the only way the correction means what the admin sees.
3. After the profile update succeeds, compute `const entered = Math.max(0, parseInt(points || "0", 10) || 0)`. If `entered !== pointsBaseline`, call
   `awardPoints({ studentId: student.id, currentPoints: pointsBaseline, delta: entered - pointsBaseline, reason: "Manual correction (edit student)" })`.
   Negative deltas are already supported — `awardPoints` clamps the new total at 0 and logs the actually-applied amount, so the ledger row and the balance always agree.
4. If `entered === pointsBaseline`, nothing is written: no `students.points` write, no `point_events` row. Changing only a name or belt therefore produces no ledger row — and an award that landed from elsewhere while the form was open survives untouched.
5. `awardPoints` is imported from `@/lib/points` in this file if it is not already; `onSuccess` also invalidates `["leaderboard"]` alongside `["admin-students"]` so the corrected month total is visible immediately.

Order matters: the profile fields save first, then the points correction, so a failing ledger write surfaces as an error toast rather than silently leaving the balance edited without an audit row.


## Other writers to students.points

Grep over `src/` for writes returns exactly three, matching your list — `src/lib/points.ts:27` and `:59` (inside the funnel, correct) and `src/routes/_authenticated/admin.tsx:1503` (the bug being removed). `admin.tsx:1380` is the `point_events` count for the delete dialog, untouched. There is no fourth writer; the CSV importer and the parking path never set `points`. I will paste the grep output in the report.

## Verification I will paste back

`git diff --stat` (admin.tsx only); the final save mutation; the grep output for `students.points` writes; on a test student with a nonzero balance — edit the points value, save, then the student's `points` plus their full `point_events` rows showing the correcting delta; and a second save changing only the name/belt, showing the `point_events` row count unchanged.
