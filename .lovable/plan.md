# Round 56 — Remove "Training Since" + fix dead class query key

## What I found (before any change)
- `formatMonthYear` and `yearsSinceDateOnly` are each used exactly once in the dashboard file, both only by the Training Since card (line 365 `yearsTraining`, line 556 the card). Once the card goes, nothing else in that file uses them, so both come out of the import. `src/lib/date-only.ts` stays as it is.
- The `Clock` icon import: I'll check for other uses and remove it only if the card was its only user.
- `["class-schedule-mine"]` appears only at admin.tsx:2436 and :2473. The dashboard class card uses `["class-catalog", className]` (index.tsx:731).

## Changes — dashboard file (index.tsx)
1. Delete the Training Since StatCard (line 556) and the `yearsTraining` line (365).
2. Remove `start_date` from the `Student` type and add a comment saying why (the values are portal-creation dates, not real start dates, and there's no source for the real ones), in the same style as the Round 54 `next_test_date` comment. `.select("*")` stays as it is.
3. Trim the date-only import to `daysUntilDateOnly, formatDateOnlyLong`.
4. Grid: `sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5` → `sm:grid-cols-2 xl:grid-cols-4`.
   - 390: 1 column (4 rows). 768 / 1024 / 1025: 2×2. 1280 and up (including 1536): 4 across.
   - No width uses 3 columns, which would leave one card alone on a second row, and no width uses 5, which would leave an empty column.

## Changes — admin.tsx (only these two lines)
- Lines 2436 and 2473: `["class-schedule-mine"]` → `["class-catalog"]`. This is a prefix match, so it refreshes every `["class-catalog", className]` entry, whichever class the dashboard is showing.

## Not touched
The `students.start_date` column and its data, the CSV importer, the admin roster, the other StatCards, the Round 54 belt-test path and the Round 54b auth path. No migration, access-rule, permission or database-function change.

## Verification (real output)
- List of changed files (git isn't available in this sandbox, so I'll give the file list instead of `git diff --stat`), with nothing under supabase/migrations/.
- Dashboard screenshots at 390 / 768 / 1024 / 1025 / 1536 as the test parent zz.test.negative@example.com, with `document.body.scrollWidth` vs `innerWidth` at each width.
- Read-only query: count and min/max of `students.start_date`, to show the values are still there.
- Invalidation demo in one admin browser session: open the dashboard, change a class's days in the Classes tab, go back to the dashboard without reloading and show the new value, then restore the original value. Because the dashboard shows the admin's own child's class, I'll use the class of a student I can view as admin. If that isn't possible without touching real data, I'll add a clearly-labelled ZZTEST child, delete it afterwards and report the counts.
