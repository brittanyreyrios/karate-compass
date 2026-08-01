# Sections H + I — Three Belt Systems & Fair Monthly Leaderboard

## Build order

**H → I.** Section E (Dojo Points audit log, `point_events`) is already built and live from the previous round, so it does not need rebuilding — the monthly leaderboard can read `point_events.delta` / `occurred_on` directly. Confirmed: table exists, currently 0 rows.

## Pre-flight findings

- **H3 backfill risk: none.** There is exactly one student row in the database, with `current_belt = 'Green'`, which matches Solid Green cleanly. Zero unmatched rows expected. The migration will still be written to leave unmatched rows NULL (never defaulted), and I will report the actual result after it runs.
- `curriculum_items` is currently empty (0 rows), so adding the rank/tier columns needs no data backfill.
- Belt logic currently lives in `src/lib/dojo-constants.ts` (`BELT_PROGRESSION`) — not `mock-data.ts`, which no longer exists. Consumers: dashboard, curriculum, leaderboard, admin console, admin content tabs.
- ⚠️ **Camo belt colors are a guess.** I will seed camo ranks as `color_primary = #4b5320` (olive/camo green) with `color_accent` = the matching solid hex, and stripe ranks as `color_primary = #f8fafc` with the solid hex as accent. Both fields will be admin-editable so you can correct them with no migration. Please confirm what our camo belts actually look like.

## Migrations

**Migration 1 — belt systems and ranks**
- `belt_systems` and `belt_ranks` exactly per H2 (including `UNIQUE (system_id, sort_order)` and the `ON DELETE RESTRICT` FK).
- GRANTs, RLS enabled; signed-in users read, admins full write (via `has_role`).
- Seeds all three systems and all 22 ranks in the H1 order, with `curriculum_tier` set per your mapping (youth_stripe + camo all beginner; solid White/Gold/Orange beginner, Green/Purple/Blue intermediate, Brown/Black advanced). Idempotent on slug/name.

**Migration 2 — student rank FK + denormalized display value**
- `students.belt_rank_id uuid REFERENCES belt_ranks(id)`.
- Backfill matching `current_belt` case-insensitively against solid-system rank names only. Unmatched rows stay NULL.
- Trigger keeps `current_belt` in sync as the rank's display name whenever `belt_rank_id` changes. `current_belt` is **not** dropped this round.

**Migration 3 — curriculum gating**
- `curriculum_items.belt_rank_id uuid REFERENCES belt_ranks(id)` and `curriculum_items.curriculum_tier text`, both nullable, plus a CHECK enforcing exactly one is set (the legacy `belt` text column stays for now, nullable).

**Migration 4 — leaderboard rewrite**
- Drop and recreate `get_leaderboard(_system_slug text, _period text DEFAULT 'month')`, SECURITY DEFINER, `search_path = public`, EXECUTE granted to `authenticated`, revoked from `anon`/`public`.
- Returns `id, first_name, last_initial, rank_name, rank_short_name, pattern, color_primary, color_accent, class_name, period_points`.
- Privacy behavior preserved exactly: first name plus uppercased last initial and a period, never a full surname.
- `'month'` sums `point_events.delta` for the current calendar month; `'all_time'` sums the whole log. Top 10 per system, no padding.

## Frontend changes

**New files**
- `src/lib/belts.ts` — belt-system/rank types, queries, progress computation per system, and the H6 label map (Solid → "Road to Black Belt" step X of 8; Camo → "Camo Belt Progress" step X of 7; Stripe → "White Belt Progress" step X of 7).
- `src/components/belt-chip.tsx` — renders solid / stripe (white chip with a colored band) / camo (camo-patterned chip with accent) plus an optional system-name suffix ("Camo Purple · Camo Belt"). Every chip gets an `aria-label` with the full rank name; pattern is also conveyed by shape/text, never color alone.
- `src/components/belt-picker.tsx` — dependent system → rank dropdowns with the system's `age_guidance` as a muted hint. No age validation or blocking anywhere.

**Edited files**
- `src/lib/dojo-constants.ts` — `BELT_PROGRESSION` reduced to a color reference for the solid system; belt ordering logic moves to the database.
- `src/routes/_authenticated/index.tsx` — per-system progress bar and label, belt chip with system name, and "Dojo Points — all time: N · this month: N".
- `src/routes/_authenticated/curriculum.tsx` — fetches entitled items per child (`belt_rank_id = rank` OR `curriculum_tier = rank tier`); groups by child when a family has students on different systems.
- `src/routes/_authenticated/leaderboard.tsx` — three tabs (stripe / camo / solid) with `role="tablist"` keyboard semantics, rank position rendered as text, the H5 belt chips, the H6 reset explainer line, and the H5 empty state copy.
- `src/routes/_authenticated/admin.tsx` — student add/edit uses the belt picker; roster and attendance cards show pattern-correct chips.
- `src/components/admin-content-tabs.tsx` — Curriculum tab gains an explicit either/or toggle (Specific rank | Tier) so both fields can never be filled; new **Belt systems** editor to correct rank names, short names, pattern and both color fields without a migration.

## Accessibility
WCAG AA maintained: tab semantics, text rank positions, aria-labelled belt chips, and no information conveyed by color alone.

## Reported back after implementation
Backfill match results row by row, the camo color confirmation request, and anything left blank.
