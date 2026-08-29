# Tournament Results card layout fix

Three targeted faults in `src/components/tournament-results-section.tsx`; no redesign of concept or medal tile.

## 1 — Card width and event columns
- Remove the single-tournament special case: `gridCols` always becomes `sm:grid-cols-2 xl:grid-cols-3` regardless of group count, so one tournament card takes a normal grid track, not a full-width row.
- Make each tournament card a container-query context (`@container` on the `<li>` card).
- Events list: `grid grid-cols-1 @md:grid-cols-2 gap-2` — one column in narrow cards, two side by side when the card itself is wide. Tailwind v4 container queries are built in; no plugin.

## 2 — "Competed" tile same box
- `PlacementIcon` currently returns `null` for NULL placement, so that tile is shorter. Give the default case a quiet glyph (lucide `Circle`, small, `text-muted-foreground`, no gold/silver/bronze, no ring/glow — `placementTileClass` default already has none). Same `flex-col items-center gap-0.5 px-1.5 py-1.5 w-[4.5rem]` tile wrapper applies to all placements already; adding the glyph makes the Competed tile's height identical to a medal tile's.

## 3 — Vertical alignment
- Change the event row from `items-start` to `items-center` so the tile and the event name/notes/tags block share a common vertical center. (Rows already render `items-start gap-3`; switching to `items-center` fixes the offset without margin nudging.)

## Constraints kept
- No client-side sorting; grouping stays the run-length pass over server order.
- `placementLabel` wording unchanged; query, RLS, functions untouched.
- `placementChipClass` untouched — `placementTileClass` already exists for the parent-facing tile and needs no change; if any tweak is needed it goes in a new export, not in `placementChipClass`. Admin bulk panel untouched.
- No migration.

## Verification
- `git diff --stat` — expect only `tournament-results-section.tsx` (+ possibly a comment-only or small helper addition in `tournament-results.ts`); `admin-tournament-bulk.tsx` must not appear.
- Playwright, signed in as a parent: `getBoundingClientRect()` numbers for a 1st, 2nd, and Competed tile in the same list — widths and heights must match; paste numbers.
- Screenshots at 390px and 1280px: (a) one tournament with two events (two columns at 1280), (b) one tournament with a single event, (c) three+ tournaments.
- Screenshot of the admin bulk-entry chips to confirm they render unchanged.
