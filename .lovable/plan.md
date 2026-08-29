# Round 43 — Competed tile overflow + tile/name alignment

## Root cause

Both `tournament-results-section.tsx` and `winners-circle-section.tsx` hardcode the
placement tile classes independently at `w-[4.5rem]` (72px) with `px-1.5`.
"COMPETED" at text-xs bold uppercase tracking-wide needs ~88px, so the label spills
past the rounded border while `getBoundingClientRect()` still reports 72px.

## Changes

### `src/lib/tournament-results.ts` — one new export (additions only)

New exported constant holding the SHARED tile box — everything except the
placement-dependent colors:

```ts
/** Shared placement-tile box: one width fits "COMPETED", used by both sections. */
export const PLACEMENT_TILE_BOX =
  "flex w-24 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-xs font-bold uppercase tracking-wide";
```

Both sections render: `className={`${PLACEMENT_TILE_BOX} ${placementTileClass(r.placement)}`}`.
`placementTileClass`, `placementChipClass`, `placementLabel` stay byte-identical.

### `src/components/tournament-results-section.tsx`
- Tile span uses `PLACEMENT_TILE_BOX` + `placementTileClass(...)` — the hardcoded
  `w-[4.5rem] ...` class string is deleted, not edited in place.
- Row alignment: switch the event row from `items-center` to `items-start` as the
  starting hypothesis, subject to visual proof (below). If the one-line case reads
  as detached, use whatever alignment actually attaches the tile to the event name
  (e.g. keep `items-start` on the row but center the text block against the tile,
  or revert to `items-center` only if it wins on screenshots). No margin nudges.
  The chosen value and the reason get reported.

### `src/components/winners-circle-section.tsx`
- Tile span swaps to `PLACEMENT_TILE_BOX` + `placementTileClass(...)`, and the row
  gets the SAME alignment treatment chosen above. No other layout change.

## Verification

- git diff --stat (three files: the two sections + tournament-results.ts).
- Overflow proof, real browser, both sections: for 1ST / 2ND / 3RD / COMPETED tiles
  paste scrollWidth, clientWidth, offsetHeight, and the label element's own
  getBoundingClientRect().width. Assertion: scrollWidth ≤ clientWidth for all four.
- Alignment proof: screenshots at 390px and 1280px of one card containing a
  one-line event (name only), a two-line event (name + chip), and a three-line
  event (name + notes + chip). The tile must read as attached to the event name in
  all three; report which alignment won and why. If items-start fails the one-line
  case, the fallback is tried and screenshotted before committing.
- Test rows labelled ZZTEST, deleted afterward with a zero-remaining count.
- Admin recorded-results chips screenshot, proving admin unchanged.
- Confirm placementLabel / placementChipClass / placementTileClass byte-identical
  via git diff.
