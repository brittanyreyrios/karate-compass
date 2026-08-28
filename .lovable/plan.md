# Rankless students on the leaderboard + dashboard "View all"

## Part 1 — one migration, `public.get_leaderboard` only

`CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month')` with the identical signature, return column list and order, `LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'`.

Only two changes to the body:
- `JOIN public.belt_ranks r` → `LEFT JOIN public.belt_ranks r`
- `JOIN public.belt_systems sy` → `LEFT JOIN public.belt_systems sy`
- plus `sy.uses_belts` → `COALESCE(sy.uses_belts, false)` (see below)

Everything else byte-identical: bounds CTE, the point_events sum subquery, `COALESCE(pts.total, 0) > 0`, `_division = ANY (public.divisions_of(st.id))`, `st.active = true`, ordering, `LIMIT 10`, and the last-initial truncation expression verbatim.

### What a rankless student returns
- `rank_name` → NULL (no placeholder invented)
- `rank_short_name` → NULL (`COALESCE(r.short_name, r.name)` of two NULLs)
- `pattern`, `color_primary`, `color_accent` → NULL
- `uses_belts` → `false`, via `COALESCE(sy.uses_belts, false)`. Chosen because the front end renders `BeltSwatch` for anything that is not exactly `false`, so a NULL would draw a belt from NULL colours. `false` routes the row to the `LevelChip` branch instead, which is the truthful answer for a student with no belt system.

No grant statements needed — `CREATE OR REPLACE` preserves the existing ACL (`postgres`, `authenticated`, `service_role`); it will be re-verified after applying, not assumed.

## Part 2 — `src/routes/_authenticated/index.tsx`

Wrap the existing School News "View all" `Button` with `asChild` around a `<Link to="/announcements">` (the `Link` import already exists in this file). Identical `variant`, `size`, `className`, label and `ChevronRight` icon. Nothing else changes.

## Verification
- Capture all six boards before and after, plus function hashes/ACL and the truncation expression.
- Confirm `get_leaderboard('jiu_jitsu','month')` now includes Celeste and print her rank columns.
- Parent-side screenshots of the Jiu Jitsu board (no broken belt graphic) and a karate board (unchanged).
- `git diff --stat` should show one migration plus `index.tsx`.
