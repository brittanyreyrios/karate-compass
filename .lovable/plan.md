# Fix silent selection loss in bulk tournament entry

## Root cause (confirmed in source)

`src/components/admin-tournament-bulk.tsx` lines 156–164:

```ts
const selected = shown.filter((s) => {
  const st = state(s.id);
  if (!st.checked) return false;
  return !alreadyRecorded.has(s.id) || st.override;
});

const skippedDuplicates = shown.filter(
  (s) => state(s.id).checked && alreadyRecorded.has(s.id) && !state(s.id).override,
);
```

`shown` is the search/programme/class-filtered list. Ticks live in `picked` and do
survive filter changes, but both derived lists read only the visible rows — so the
save payload and the duplicate-skip report contain only students visible at save
time. Search for child A, tick, search for child B, tick, save → only B is saved,
silently.

## The fix (one file, front-end only)

1. Introduce `allStudents = studentsQ.data ?? []` and derive both `selected` and
   `skippedDuplicates` from `allStudents` instead of `shown`. Nothing else about
   the payload changes — same single `.insert([...])`, same normalisation, same
   duplicate detection, same placement validation, same active-only query.
2. Placement values already live in `picked` keyed by student id and are untouched
   by filtering; deriving from `allStudents` means a placement typed before a
   filter change is now actually read at save time.
3. Selection visibility:
   - Always show total selected across the whole roster.
   - When some selected students are not in `shown`, append the hidden count:
     `12 selected (4 not shown by this filter)`.
   - List hidden selected students' names in a small muted line so nothing is
     invisible.
4. Unambiguous button scope:
   - `Select all shown (N)` — only adds the currently visible, non-duplicate rows;
     never unticks anyone hidden.
   - `Clear all selections (including hidden)` — resets every tick and placement
     across the whole roster, not just the visible ones.
5. Save confirmation keeps naming every student saved (already does) and now
   correctly includes previously-hidden ones; the skip report likewise.

## Out of scope

No changes to the insert call, duplicate detection/normalisation, placement
validation, the active-only student query, the table, policies, or any other file.

## Verification

- `git diff --stat` limited to `admin-tournament-bulk.tsx`.
- Playwright as an admin: search student A, tick; search student B, tick; clear
  search; assert both still ticked and the count reads 2; type a placement before
  a filter change and confirm it survives; save and read back both
  `tournament_results` rows from the database; delete the test rows and confirm
  zero remain.
- Duplicate-skip: re-run the same batch and confirm the skip report counts a
  student hidden by the active filter.
