# Round 43 — Competed tile overflow + tile/name alignment

## Root cause

Both `tournament-results-section.tsx` and `winners-circle-section.tsx` hardcode the
placement tile at `w-[4.5rem]` (72px) with `px-1.5`. "COMPETED" at text-xs bold
uppercase tracking-wide needs ~88px, so the label spills past the rounded border
while `getBoundingClientRect()` still reports 72px. The row also uses
`items-center`, which centers the tile against the whole text block; with
name+notes+chip (three lines) the tile floats away from the event name.

## Changes

### `src/components/tournament-results-section.tsx`
- Tile width: replace `w-[4.5rem]` with a single fixed width that comfortably fits
  "COMPETED" — `w-24` (96px) — on the shared tile span. Same width for all four
  placements, so the text column stays aligned. This is the only styling change
  candidates: the width lives in the JSX class string today, so it changes there.
- Row alignment: change the event row from `items-center` to `items-start`, so the
  tile's top aligns with the event name's first line instead of the centroid of a
  1–3 line text block. No margin nudges.

### `src/components/winners-circle-section.tsx`
- Same two mechanical changes on its tile/row (it duplicates the same classes), so
  the school-wide section inherits the fix. No other layout change.

### `src/lib/tournament-results.ts`
- No change needed: width/alignment live in the JSX class strings, not in
  `placementTileClass`. `placementTileClass`, `placementChipClass` and
  `placementLabel` stay byte-identical.

## Verification
- git diff --stat (expect the two section files only).
- Overflow proof in a real browser at both sections: for 1ST / 2ND / 3RD / COMPETED
  tiles paste scrollWidth, clientWidth, offsetHeight, and the label element's own
  rect width; assert scrollWidth ≤ clientWidth for all four.
- Screenshots at 390px and 1280px of a card with a medal placement and a
  notes+discipline "Competed" row (create labelled test rows, then delete and
  confirm zero remain).
- Admin recorded-results chips screenshot, proving admin unchanged.
- Confirm placementLabel / placementChipClass byte-identical via git diff.
