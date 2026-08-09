# Round 11 — Belt icon rebuild (AQ) and attendance card layout (AR)

## Section AQ — Rebuild the belt icon as band + tails, not an X

All work in `src/components/belt-chip.tsx`. The two crossing full-width straps are deleted outright; the arrangement is what reads as a spider, so details are not adjusted.

New geometry — five shapes, taller viewBox:

- `viewBox="0 0 100 62"` (the tails need vertical room). `SIZES` is re-derived from the same 100:62 ratio in the same edit, so nothing squashes:
  - `ladder`: `h-[21px] w-[34px] sm:h-[30px] sm:w-12`
  - `sm`: `h-[30px] w-12`
  - `md`: `h-[45px] w-[72px]`
- **Left band arm** — from the knot (~x 44) out to `x=2`, near level: centreline drops only ~3 units across the whole run, rising slightly at the outer end, tapering from the knot outward, cut end angled.
- **Right band arm** — mirror.
- **Left tail** — starts under the knot (~x 46, y 26), falls to about y 48 (≈78% of height) while drifting left only to ~x 34: vertical travel ~22, horizontal ~12, so well steeper than 45°. Gentle outward curve, tapering, angled cut end.
- **Right tail** — mirror, ending slightly shorter (~2 units) so the pair is not mechanically identical.
- **Knot** — the existing rounded bundle, kept, sitting over the band/tail junction and drawn last so it overlaps both.

Preserved unchanged: camo `<pattern>` fill, lengthwise accent stripe on both band arms and both tails (each tail gets its own stripe path), Round 7 outline (`rgba(255,255,255,0.92)`, `strokeWidth 1.3`), `role="img"` + `aria-label` + `<title>` with the pattern spelled out in words, and `uses_belts === false` still routing to `LevelChip` (untouched — that decision lives outside this file).

Verification: a Playwright page rendering solid / stripe / camo at `sm` and `md`, element-screenshotted and viewed next to the reference image before reporting. If it still reads as a spider or the tails read as legs, the geometry gets another pass before I reply.

## Section AR — Attendance card layout

In `src/routes/_authenticated/admin.tsx`:

1. Master Attendance grid: `sm:grid-cols-2 lg:grid-cols-3` → `sm:grid-cols-2 lg:grid-cols-2` (≈480px per card).
2. Card wrapper: drop `sm:flex-row sm:items-center`, keep the vertical stack at every width. Comment updated to record that the card width comes from the grid, not the viewport.
3. `FollowUpBadge`: visible text becomes the icon plus `2 absences`; full phrasing `Follow up needed · 2 absences` moves into `aria-label` and `title`.
4. `AdminBeltBadge` gains a `dense` prop used by the attendance card and StudentRow: badge shows `rank.short_name ?? rank.name` with no ` · System` suffix; the `title` carries the full `Name · System`. Non-dense callers are unchanged.
5. StudentRow: inspected at 360/480/640/768/1280 with screenshots and reported honestly — patched only if it is actually squeezed.

Verification: 360px `scrollWidth` vs viewport on `/admin` (both tabs), plus screenshots at 480/768/1280.

## What these fixes exclude

- Two columns means on a very wide monitor each attendance card is ~700px+ wide with the controls still stacked under the name, so there is visible empty space to the right of the name row and fewer cards visible per screen than before (2 instead of 3 per row). That is the deliberate trade: the card never starves.
- No container queries are introduced; the three-column option is dropped, not deferred.
- The belt icon gets taller relative to its width, so every belt now occupies slightly more vertical space in rows and dropdowns.
- Nothing in the leaderboard, dashboard ladder, or tai chi level rendering changes behaviourally.

## Technical notes

- No migration; `short_name` already exists on `belt_ranks` and is already selected by `useBeltRanks`.
- No new dependencies, no changes to `level-chip.tsx` or `belts.ts`.
