# Leaderboard front-end fixes

## Scope
- Edit `src/routes/_authenticated/leaderboard.tsx` only.
- No database, migration, query, or other file changes.

## Part 1 — Jiu Jitsu board hides belt rank
- Key off `divisionKey === "jiu_jitsu"`.
- Pass an `isJiuJitsu` flag into `PodiumCard`.
- In `PodiumCard`: skip the `BeltSwatch`, `LevelChip`, and rank `Badge` entirely when `isJiuJitsu` is true; keep the `class_name` line.
- In the ranks-4–10 list: skip the left-hand `BeltSwatch`/`LevelChip` block when `divisionKey === "jiu_jitsu"`; remove the rank `Badge` from the meta line as well. The name/class block slides left, closing the gap.
- `class_name` and points render unchanged on every board.

## Part 2 — Podium sizing and tiering
- Make all three podium cards equal height by switching the grid container to `items-stretch` and giving each card `h-full` with a flex column layout.
- Remove the padding-based `heightClass` prop (`sm:pt-10`, `sm:-mt-6`, `sm:pt-14`) and delete that prop from `PodiumCard`.
- Keep 1st place most prominent by raising it with a vertical transform offset on desktop (`sm:-translate-y-4` or similar). 2nd and 3rd share the same base position.
- On mobile (single column), no vertical offset, so cards stack cleanly with no odd gaps or leftover padding-based size differences.
- Preserve existing rank badges, icons, colours, ring styling, hover behaviour, and labels exactly.

## Verification
- `git diff --stat` should show only `leaderboard.tsx`.
- Parent screenshots of Jiu Jitsu tab (no belt chip, 1st place raised, equal-height cards) and Solid Belt Int/Adv tab (belt chips present, equal-height cards even when class names wrap).
