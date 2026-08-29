# Fix Batch 2 — the responsive grid sweep, re-derived after Batch 1

All numbers below are measured today, post-Batch-1, admin session, at the seven widths you named. `main` is the content column's `clientWidth`.

## The boundary, measured

| viewport | 390 | 768 | 1024 | 1025 | 1180 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| content width | 390 | 768 | 1024 | **769** | 924 | 1024 | 1184 |
| sidebar | sheet | sheet | sheet | rail 255 | rail | rail | rail |

Your discontinuity is confirmed exactly: content *shrinks* by 255px from 1024 → 1025. So `lg:` (min-width 1024) is the worst possible place to widen a grid — it fires at the one width where content is widest and is still in force one pixel later at 769px of content. Anything tuned at 1024 must be justified at 1025.

## Manage Students — the stale 89px, re-measured before touching anything

`div.min-w-0.sm:flex-1` (student name / belt / enrolment column), content `scrollWidth` 193 throughout:

| viewport | 1024 | 1025 | 1180 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- |
| clientWidth | 89 | **28** | 183 | 89 | 193 (passes) |

So 89 was not merely stale, it was optimistic: at 1025 the column is 28px. It still needs work.

Cause, and it is not the select any more: `StudentRow` (`src/routes/_authenticated/admin.tsx:1187`) is `sm:flex sm:flex-wrap` with three siblings on one line — the text column (`min-w-0 sm:flex-1`), the Dojo-points stepper, and the action buttons. `flex-wrap` never fires because `min-w-0` lets the text column shrink to nothing instead, so the row stays on one line and starves the text.

Fix (layout utilities only, no restructuring): give the text column a real wrap threshold so the row breaks instead of collapsing —
`min-w-0 sm:flex-1` → `min-w-0 basis-full sm:basis-auto sm:min-w-[22rem] sm:flex-1`.
At any content width where 352px is not available beside the stepper, the stepper and actions wrap to their own line and the text column keeps the full row. Predicted: clientWidth ≥ 352 at every width from 390 to 1440, so 193 of content always fits.

`admin-enrollment.tsx` is left alone this batch — its select is no longer the binding constraint.

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
