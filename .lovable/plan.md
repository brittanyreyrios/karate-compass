# Winner's Circle — collapse to three tournaments with "View all"

## Scope
`src/components/winners-circle-section.tsx` only. No query change, no migration, no helper changes, no other file.

## Change

- Add `const [expanded, setExpanded] = useState(false)` to `WinnersCircleSection`.
- Slice the **grouped** array, never the row list:
  ```tsx
  const groups = groupWinnersByTournament(q.data ?? []);
  const visibleGroups = expanded ? groups : groups.slice(0, 3);
  ```
  and render `visibleGroups.map(...)` instead of `groups.map(...)`.
- Below the grid, render the control only when `groups.length > 3`:
  - Collapsed: `View all {groups.length} tournaments` — clicking sets `expanded` true.
  - Expanded: `Show less` — collapses back to three.
  - Real `<button type="button">` with `aria-expanded={expanded}`, centered under the grid.
- Style it to match the existing "View all" affordance used elsewhere (the dashboard
  "View all" School News / Next Up links use `text-sm font-semibold text-primary
  hover:underline`-style link buttons); I'll match that exact class treatment so it
  reads as the same affordance, as a `<button>` not a `Link` since there is no
  navigation.
- Expansion is pure client state — the data is already in the query cache, so no
  second request fires.

## Explicitly unchanged
- `groupWinnersByTournament`, `useWinnersCircle`, `get_winners_circle`, `PLACEMENT_TILE_BOX`,
  `placementTileClass`, card markup, grouping, ordering — all byte-identical.
- `tournament-results-section.tsx` and everything from Rounds 41/42 untouched.

## Verification

- `git diff --stat` — winners-circle-section.tsx only.
- Paste the slicing code.
- ZZTEST data: insert featured results across 5 distinct labelled ZZTEST tournaments
  so the section has ≥5 groups (existing featured rows already produce groups; test
  rows push it past five), then screenshots at 1280px and 390px:
  (a) collapsed — exactly 3 tournament groups visible, "View all N tournaments" present;
  (b) after clicking — all groups visible, "Show less" present;
  (c) after deleting down to exactly 3 groups — control absent;
  (d) 2 groups — control absent.
  For (c)/(d) I'll use a fresh authenticated context after cleaning test rows so the
  real remaining count drives it.
- Network proof: capture requests during the View all click and show none fire.
- Delete all ZZTEST rows; confirm zero remain.
