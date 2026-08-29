# Tournament Results + Winner's Circle — use the card width

## Scope
`src/components/tournament-results-section.tsx` and
`src/components/winners-circle-section.tsx` only. `PLACEMENT_TILE_BOX` in
`src/lib/tournament-results.ts` stays untouched unless a size genuinely belongs
there (expected: no). No migration, no query change.

## Change 1 — two columns maximum

Both sections: grid becomes `mt-4 grid items-start gap-3 sm:grid-cols-2`
(drop `xl:grid-cols-3`). No `col-span` for a lone card.

## Change 2 — remove the container-query two-up events list

In `tournament-results-section.tsx`:

- Delete `@md:grid-cols-2` from the events list — events go one per row, full
  card width, always. The Round 40 container query existed only to fill a wide
  card whose events stacked narrow; the chip-right row layout now fills that
  width horizontally, and keeping both would cramp ~320px cells with a 96px
  tile plus a right-aligned chip.
- Remove `@container` from the card (nothing else uses it).
- Update the stale Round 40 comment to say the container query was removed in
  this round and why (chip-right rows made it redundant and conflicting).

## Change 3 — chip to the right, larger text, items-center

Each event row in both sections becomes:

```tsx
<li className="flex min-w-0 items-center gap-3 ...">
  <span className={`${PLACEMENT_TILE_BOX} ${placementTileClass(r.placement)}`}>…</span>

  <div className="min-w-0 flex-1">
    <p className="truncate text-base font-semibold text-foreground">{name}</p>
    <p className="truncate text-sm text-muted-foreground">{event/division}</p>
    {notes && <p className="mt-0.5 break-words text-xs text-muted-foreground">{notes}</p>}
  </div>

  <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
    <DisciplineTags disciplines={cleanDisciplines(r.disciplines)} />
  </div>
</li>
```

- `ml-auto` on the chip wrapper, `flex-1 min-w-0` on the text block — **not**
  `justify-between` on the row, which would push the medal tile away from the name.
- Size bump one step each, name stays stronger:
  - Results: event name `text-sm` → `text-base font-semibold`; notes stay `text-xs`.
  - Winner's Circle: student name `text-sm font-semibold` → `text-base font-semibold`;
    event line `text-xs` → `text-sm`.
- `truncate` + `min-w-0` on the name/second line; notes keep `break-words` under
  the division and are not moved.
- Row alignment `items-center` — the text block is reliably two lines, so
  centering lines the tile up with the text.
- Chip wrapper keeps `flex-wrap`: a three-discipline row may wrap to two lines
  and grow taller than the tile — accepted; wrapping beats overflowing.

## Explicitly unchanged
- `placementLabel`, `placementChipClass`, `placementTileClass`,
  `PLACEMENT_TILE_BOX` — byte-identical.
- Round 43 collapse: `expanded` state, `COLLAPSED_GROUP_COUNT = 3`,
  `visibleGroups` slicing, `View all N tournaments` / `Show less` button.
- `useWinnersCircle`, `useStudentTournamentResults`, `groupWinnersByTournament`,
  `groupByTournament`, `get_winners_circle`, admin panel, RLS.

## Verification
- `git diff --stat` — the two section files only.
- Measured inner width of a card at 1280px and at 1920px in the new two-column
  grid — actual numbers, which also answer whether `@md` (28rem) was ever going
  to fire.
- Screenshots at 390 / 768 / 1280 px: (a) one tournament with one event,
  (b) one tournament with three events, (c) ≥4 tournaments collapsed then
  expanded via View all, (d) a deliberately long event name + long chip in one
  row proving truncation, (e) a three-discipline row showing the chip wrap.
- Measured: chip `getBoundingClientRect().right` ≤ card content-box right, and
  row `scrollWidth <= clientWidth`, at all three widths.
- Round 43 recheck: 3 groups by default, View all reveals the rest, control
  absent at ≤3 groups.
- Admin recorded-results chips screenshot unchanged; helper bodies diffed as
  byte-identical.
- Test data labelled `ZZTEST — ignore`, created and deleted in one continuous
  pass with a post-delete count of zero; ≤3-group cases use a mocked RPC
  response so live school-wide data is never touched.
