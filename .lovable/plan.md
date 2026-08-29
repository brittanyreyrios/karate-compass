# Tournament Results — visual rework

Front-end only. Two files at most: `src/components/tournament-results-section.tsx` and
(only if medal styling needs it) the chip helpers in `src/lib/tournament-results.ts`.
No query, ordering, wording, database, or other-component changes.

## 1 — Card grid, matching "Next up at the dojo"

The section keeps its current shell (`mt-10 rounded-2xl border border-border bg-card p-6`),
which already matches Next Up. Tournament cards adopt Next Up's card language exactly:
`rounded-xl border border-border bg-background/50 p-4`, `grid gap-3`.

Making every count look deliberate:

- Grid: `grid gap-3 sm:grid-cols-2 xl:grid-cols-3` — never a 3-up row on a mid-width screen,
  so one card is at worst half a row, not a lonely third.
- One tournament only: that single card spans the full row (`sm:col-span-2 xl:col-span-3`
  applied when `groups.length === 1`), so it reads as a full-width feature panel rather
  than an orphan in a wide empty row.
- Two: one card each in a 2-up row; at `xl` they stay 2-up (the 3-col track only kicks in
  from 3 groups upward, chosen with a conditional class on the grid).
- Five+: 2-up then 3-up at `xl`, `items-start` so a tournament with many events does not
  stretch its neighbours. Cards are content-height, not forced equal, so nothing looks padded out.

## 2 — Medal-forward rows

Each event row becomes a left-anchored flex row: placement badge first, event name, notes
and discipline chips beside it in a `min-w-0` column. `sm:justify-between` is removed
entirely, which is the cause of the desktop canyon.

- Badge becomes a fixed-width (`w-16`/`w-[4.25rem]`) centred medal tile with a small icon
  (trophy 1st, medal 2nd, award 3rd) above/beside the ordinal, so all rows align in a column.
- Gold/silver/bronze use the same HSL accents already in `placementChipClass`, which were
  taken from the leaderboard podium; I will extend that helper (not `placementLabel`) with
  slightly stronger presence — heavier border, ring, subtle glow for 1st — keeping the same hues.
- NULL placement: "Competed" in a solid bordered neutral tile of the identical size, muted
  text, no icon-less blankness — same footprint as a medal so it never reads as missing data.

## 3 — Unchanged

`groupByTournament` run-length grouping, no client-side sorting anywhere, tournament name +
`formatDateRange(g.tournament_date, null)` header, empty/loading/`QueryErrorState` states,
single selected child only, `DisciplineTags` + `cleanDisciplines`.

## Verification

`git diff --stat`; full reworked source; authenticated parent screenshots at desktop and
phone for 1, 2 and 5+ tournaments including a multi-event tournament with medals and a
"Competed"; confirmation that events render in server order with no client sort; ZZTEST
rows created then deleted with a zero-row count pasted.
