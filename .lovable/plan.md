# Fix Batch 2 — the responsive grid sweep, re-derived after Batch 1

All numbers below are measured today, post-Batch-1, admin session, at the seven widths you named. `main` is the content column's `clientWidth`.

## The boundary, measured

| viewport | 390 | 768 | 1024 | 1025 | 1180 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| content width | 390 | 768 | 1024 | **769** | 924 | 1024 | 1184 |
| sidebar | sheet | sheet | sheet | rail 255 | rail | rail | rail |

Your discontinuity is confirmed exactly: content *shrinks* by 255px from 1024 → 1025. So `lg:` (min-width 1024) is the worst possible place to widen a grid — it fires at the one width where content is widest and is still in force one pixel later at 769px of content. Anything tuned at 1024 must be justified at 1025.

## Manage Students — you were right, `22rem` would have overflowed

Roster column measured today (the split is `src/routes/_authenticated/admin.tsx:959`, `grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]`), with the text column (`div.min-w-0.sm:flex-1`, content `scrollWidth` 193–253):

| viewport | 768 | 1024 | 1025 | 1180 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- | --- |
| content | 768 | 1024 | 769 | 924 | 1024 | 1184 |
| split cols | stacked 720 | 380 + 556 | 380 + **301** | 380 + 456 | 380 + 556 | 380 + 716 |
| roster clientWidth | 718 | 554 | **299** | 454 | 554 | 714 |
| student card inner | 668 | 504 | **249** | 404 | 504 | 664 |
| text column clientWidth | 253 (passes) | 89 | **28** | 183 | 89 | 249 (passes) |

So `sm:min-w-[22rem]` (352px) inside a 249px card inner at 1025 would have turned a starved column into an overflowing one, exactly as you said. Dropped.

### Correction: move the roster split to `xl:` first

`lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]` → `xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]`, on the Manage Students split only (line 959; the identical split at line 3555 and the ones in `admin-technique-library.tsx` / `admin-content-tabs.tsx` are not this tab and are re-derived on their own measurements, not swept blind).

Predicted card inner after the move: 768 → 668, 1024 → ~974, 1025 → ~719, 1180 → ~874, 1280 → 504, 1440 → 664. The 1024/1025 pair both stack full-width, 974 vs 719 — both far above the 193 the text needs, and the rail's return costs 255px of a much larger budget instead of flipping a layout on.

### Does `StudentRow` still need a minimum?

Yes, but a smaller one that every container can honour. At `xl:` the split still narrows the card inner to 504 (1280), and 504 is where the text column measured 89 — the three siblings share one line and `min-w-0` lets the text lose. The minimum only has to force `flex-wrap` to break, so it is sized against the **smallest** card inner after the split change, 504:

`min-w-0 sm:flex-1` → `min-w-0 basis-full sm:basis-auto sm:min-w-[18rem] sm:flex-1`

288px against a 504px floor, and against 668 / 974 / 719 / 874 / 664 elsewhere — comfortable at every one of the seven widths, and it can never exceed its container the way 352 could. When the stepper and actions cannot fit beside 288px of text they wrap to their own line, which is the mobile layout the card already has.

Proof required in the report: measured card inner and resulting text-column `clientWidth` at 1024 and 1025 side by side, plus `body.scrollWidth` at both, showing no overflow appears on either side of the rail.

### `lg:` is suspect for the rest of the batch

Adopted as a rule: no grid gets widened at `lg:` from here on. Every remaining candidate is checked at 1025 first, and if the 769px content area cannot honour the wider grid, the step goes to `xl:` (content 1024) instead. That applies to the 12 other surviving failures and to the dashboard tiles, whose `lg:grid-cols-3` below is justified at 1025 (245px cells) precisely because it was checked there.

## Dashboard stat tiles — the re-derived grid

`src/routes/_authenticated/index.tsx:458`, currently `mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5`. Measured cell widths (cell content box = cell − 42 of padding/border):

| viewport | 390 | 768 | 1024 | 1025 | 1180 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cols now | 1 | 2 | 5 | 5 | 5 | 5 | 5 |
| cell | 358 | 352 | 179 | **128** | 159 | 179 | 211 |
| content box | 316 | 310 | 137 | 86 | 117 | 137 | 169 |

Widest content the tiles must hold: sub-line "Intermediate / Advanced Children" 142px, label "Total Attendance (Yearly Log)" 125px, "Current Belt" 95px. So a tile needs a **142px content box → 184px cell**. Five columns therefore need content ≥ 5×184 + 4×16 = **984px of cell space**, which only exists once content ≥ 984 — i.e. viewport ≥ 1239 without a rail, or ≥ 1494 with one. That is why every measured 5-column width fails, including 1024 and 1280.

Proposed: `sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5`

| viewport | content | cols | cell | content box | 142 fits? |
| --- | --- | --- | --- | --- | --- |
| 390 | 390 | 1 | 358 | 316 | yes |
| 768 | 768 | 2 | 352 | 310 | yes |
| 1024 | 1024 | 3 | 330 | 288 | yes |
| **1025** | **769** | 3 | **245** | **203** | yes |
| 1180 | 924 | 3 | 297 | 255 | yes |
| 1280 | 1024 | 3 | 330 | 288 | yes |
| 1440 | 1184 | 3 | 384 | 342 | yes |
| 1536 (2xl) | 1280 | 5 | 243 | 201 | yes |

The 1024 → 1025 pair is the point of the design: both are 3 columns, 330 → 245, both above the 184 floor, so the rail's return cannot break it. Five columns only return at `2xl:`, where the rail is already priced in.

## The other 12 remaining failures

The rest of the surviving overflow elements sit in `sm:grid-cols-2` panels that become two ~370px columns inside a 769px content area at 1025. Each will be re-derived the same way from the measurement pass, and each gets a step only where a measured cell width justifies it — no speculative `md:` additions. Grids that already pass at all seven widths are not touched.

## Out of scope, explicitly

Dense admin-form touch targets (`h-9` / `size="sm"`) stay. No `use-mobile.tsx`, no sidebar component, nothing from Rounds 41–47. No font-size changes, no container widening, no component restructuring — grid and layout utilities only.

## Report

`git diff --stat`; the final `md:`/`xl:`/`2xl:` table as committed with measured cell widths; Manage Students text column 89 (stale) → 28–89 (actual, above) → after; the full seven-width re-measurement for both roles showing only remaining failures with resolved / still failing / false positive; the explicit 1024 vs 1025 comparison for every grid changed; `document.body.scrollWidth` vs viewport at all seven widths; and side-by-side screenshots of the dashboard and Manage Students at 1024 and 1025.
