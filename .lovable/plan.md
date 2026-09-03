# Winner's Circle — phone row alignment, container-driven columns, orphan-free collapse

Scope: `src/components/winners-circle-section.tsx` only, plus a one-line comment
correction in `src/components/tournament-results-section.tsx`. No query, migration,
data or privacy change; `{r.first_name} {r.last_initial}` stays exactly as is.

## 1 — Phone row reads as one unit

Today the row is `flex flex-wrap` with the chip group in `ml-auto … justify-end`,
so at 390px the chip wraps to its own full-width right-aligned line. Fix: move the
discipline chips out of the `ml-auto` right-aligned group and render them inside
the text column, on their own line directly beneath the event/division, left-aligned
with the name. At wide container widths the chips return to the right of the row.
The switch is driven by the section's container query (same mechanism as §3), not a
viewport breakpoint, so the 1024/1025 inversion cannot break it.

Tournament Results keeps its current row layout untouched — its row has one text
line, so the chip never wraps there; matching it means "chip sits with its text",
which is what this change produces.

## 2/3 — Columns from a container query, collapse = exactly one row

- `@container` goes on the section (or the grid wrapper), and the grid resolves
  1 / 2 / 3 columns from measured container-width thresholds — no `lg:`.
- Thresholds are derived from a measured minimum 3-across card width:
  tile (96px) + gap (12px) + longest realistic name/division text + gap + widest
  discipline chip + card padding (2 × 16px) + grid gaps. I will measure the real
  widths in the browser before fixing the numbers, and report them.
- Collapsed count = the active column count, except single column where it stays 3.
  One source of truth: a single exported-in-file `WC_COLUMN_STEPS` array of
  `{ minWidth, columns }`. The CSS classes and the JS collapsed count both read
  that array — the JS side observes the container with a `ResizeObserver`, so the
  two can never drift.
- "View all N tournaments" / "Show less" unchanged; N stays the total tournament
  count; the control is absent when everything already fits in one row.
- If 3 across does not actually fit, I stay at 2 and say so — no shrinking the tile
  or the text.

## Comment correction

`tournament-results-section.tsx:48` claims content is <768px below 1024 because of
the persistent sidebar. Round 48 made the sidebar a Sheet at ≤1024, so content is
full width there. Comment text only — no code change in that file.

## Verification I will report

`git diff --stat`; the measured min card width and both thresholds; a width →
columns → collapsed-cards table at 390/768/1024/1025/1280/1440/1536; 1024 vs 1025
side by side (columns, card width, `row.scrollWidth <= row.clientWidth`);
screenshots at 390/768/1024/1025/1280/1440 collapsed plus one expanded; a 390px
Winner's Circle vs Tournament Results comparison; Tournament Results screenshots at
390 and 1024 with its isolated one-line diff; and `grep` proving `placementLabel`,
`placementChipClass`, `placementTileClass` and `PLACEMENT_TILE_BOX` are byte-identical.
