# Round 6 — curriculum ordering, calendar months, curriculum redesign, mobile speed

Sections U, V, W and X are planned below and will be built together. **Section Y is deferred**
until Britt's reference belt image arrives, as instructed — nothing in `belt-chip.tsx` will change
this round.

## Section U — curriculum sort order

**Migration (one file, also covers X4):**
- Backfill: for each group (each `belt_rank_id`, and separately each `curriculum_tier` where rank is
  null), assign `sort_order = row_number() over (partition by group order by created_at)` starting
  at 0. No renumbering across groups.
- Indexes on `curriculum_items`: `(belt_rank_id, sort_order)` — matches the rank branch of
  `get_curriculum_for_student` plus its ordering; `(curriculum_tier, sort_order) where belt_rank_id
  is null` — matches the tier-wide branch; `(active)` partial-friendly filter used by every read.
- `get_curriculum_for_student` is **not touched**. Its ORDER BY contract stays byte-identical.

**Insert fix** (`admin-content-tabs.tsx`): a small `next_curriculum_sort_order` SQL function
(security definer, admin-only check) returning `COALESCE(MAX(sort_order) + 1, 0)` for the target
group, called inside the insert so two concurrent admins cannot both land on the same value in a
read-then-write race. Insert then writes the returned value.

**U2 — reordering UI:** each item row in Admin → Content → Curriculum gets Up / Down buttons,
44px targets, `aria-label="Move Front kick up"`, disabled at the ends. Reorder is computed
client-side within the group, then persisted in **one** round trip via an `upsert` of the affected
rows' ids + `sort_order`. On failure the list is reverted to server order (query invalidate) and the
error is shown. Drag-and-drop is **not** added this round — the buttons are the accessible baseline
the spec requires; adding `@dnd-kit` on top is a follow-up, and I will say so plainly rather than
claim drag shipped.

Reordering is group-scoped by construction: the buttons only ever swap with the previous/next item
in the same rendered group.

## Section V — list view month navigation

`calendar.tsx` keeps one `month` state, already shared with the grid. List view gains the same
header component the grid uses (extracted so there is one pattern, not two): Prev / Next with
`aria-label`, 44px targets, `aria-live="polite"` heading. List items are filtered to the selected
month instead of `>= todayKey`, past dates included, today still marked. Today button resets
`month` to the current month in both views. Empty month copy names the month.
No navigation bounds added; the data window stays month−1 → month+2.

## Section W — curriculum typography and layout

- Type scale steps down: section heading `text-xl`/`text-2xl` font-display → group heading
  `text-base`/`text-lg` → technique name `text-lg font-semibold` → category `text-xs` → notes
  `text-sm`.
- Tracking scales with size: keep wide tracking only on the large display heading; eyebrow and
  small headings move to `tracking-wide`/normal.
- Video items become YouTube-style: full-bleed thumbnail at the top of the card, no card border, no
  inner border on the thumbnail; title directly under it; one compact metadata line (category ·
  runtime · group). Text-only items stay bordered, compact, and are allowed to be short — the grid
  becomes `items-start` with `sm:grid-cols-2` max, one column on phones.
- The number badge becomes a light inline `01` prefix on the metadata line rather than its own box.
- Notes promoted to `text-foreground`; muted reserved for genuinely secondary lines. Contrast
  ratios stated in the report; nothing lowered.
- Verified at 360 / 768 / 1280px.

## Section X — mobile speed

- **X1/X2:** new `get_curriculum_for_all_children()` RPC — same entitlement logic, resolved from
  `auth.uid()` server-side, returning every child's rows in one call with a `student_id` column.
  One round trip replaces hydrate → students → N × RPC. Called from a route loader via
  `ensureQueryData` so it starts as the route resolves. Student names come from the same call.
  Entitlement stays server-side; no filtering moves to the client.
- **X3:** the earned accordion renders its contents only after it is opened (controlled `<details>`
  with `onToggle`), summary and count always visible.
- **X5:** explicit `width`/`height` and `decoding="async"` on the facade `<img>`; `mqdefault` for
  phone widths via `srcSet`/`sizes`, `hqdefault` above. Facade stays — no real embed.
- **X6:** `useDelayedLoading` untouched.
- Before/after timings measured on a throttled connection and reported, along with an explicit
  entitlement confirmation.

## Section Y — deferred

Waiting on the reference image before changing the viewBox, size classes or outline weight.
