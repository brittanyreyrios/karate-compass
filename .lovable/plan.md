# Tournament Results + Winner's Circle — use the card width

## Scope
`src/components/tournament-results-section.tsx`, `src/components/winners-circle-section.tsx`,
and `PLACEMENT_TILE_BOX` in `src/lib/tournament-results.ts` only if a size genuinely
belongs there (I expect it does not — the tile box is already correct). No migration,
no query change.

## Change 1 — two columns maximum

Both sections: grid becomes `mt-4 grid items-start gap-3 sm:grid-cols-2`
(drop `xl:grid-cols-3`). No `col-span` for a lone card.

In `tournament-results-section.tsx` the per-card `@container` + `@md:grid-cols-2`
events list stays as it is — with wider cards it now genuinely has room for two-up
events, and the row layout below works at either width. If the measured row proves
too tight for the chip at `@md` two-up, I'll report it rather than silently changing it.

## Change 2 — chip to the right, larger text, items-center

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
- `truncate` + `min-w-0` on the name/second line so a long name shortens instead of
  pushing the chip out of the card. Notes keep `break-words` under the division.
- Row alignment back to `items-center` (Round 42 used `items-start`); the text block is
  reliably two lines now, so centering is what lines the tile up with the text.

## Explicitly unchanged
- `placementLabel`, `placementChipClass`, `placementTileClass` — byte-identical.
- Round 43 collapse: `expanded` state, `COLLAPSED_GROUP_COUNT = 3`, `visibleGroups`
  slicing, and the `View all N tournaments` / `Show less` button all untouched.
- `useWinnersCircle`, `useStudentTournamentResults`, `groupWinnersByTournament`,
  `groupByTournament`, `get_winners_circle`, admin panel, RLS.

## Verification
- `git diff --stat` — the two section files (plus lib only if needed).
- Screenshots at 390 / 768 / 1280 px: (a) one tournament with one event,
  (b) one tournament with three events, (c) ≥4 tournaments collapsed then expanded.
- Long-name + long-chip row screenshot proving truncation and the chip staying inside.
- Measured: chip `getBoundingClientRect().right` ≤ card content-box right, and
  `scrollWidth <= clientWidth` on the row, at all three widths.
- Round 43 recheck: 3 groups by default, View all reveals the rest, control absent at ≤3.
- Admin recorded-results chips screenshot unchanged; helper bodies diffed as identical.
- Any test data is `ZZTEST — ignore` labelled, created and deleted in one continuous
  pass, with a post-delete count of zero; the ≤3-group cases use a mocked RPC response
  so live school-wide data is never touched.
