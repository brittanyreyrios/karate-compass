# Merge discipline tags, union the tournament list, prevent future drift

No migration, no database change. The news feed stays `category = 'school_news'` and stays paginated exactly as it is.

## 1. Calendar de-dup merges tags instead of discarding them

`src/lib/calendar-data.ts`, `buildCalendarItems`:

- Keep the existing `tournamentIds` set and the existing event-skip rule (`if (e.announcement_id && tournamentIds.has(e.announcement_id)) continue;`) exactly as they are.
- Build, before the tournament loop, a `Map<string, string[]>` from `announcement_id` → `cleanDisciplines(event.disciplines)` for each suppressed event, entered only when that list is non-empty.
- In the tournament loop resolve tags as: announcement tags when non-empty, else the suppressed event's tags, else empty. Announcement tags always win.
- `audienceLabel` and the chip list both read the resolved tags, so Westchase WC Kickoff shows Wrestling on the calendar and dashboard.

## 2. `useTournaments()` becomes a union of two ordered branches

`src/lib/announcements.ts`:

- Branch A (unchanged): `announcements` where `category = 'tournament'`, same still-current `.or(...)`, `event_date` ascending nulls last, `.limit(limit)`.
- Branch B (new): `events` where `event_type = 'tournament'`, `announcement_id is null` (that null check is the de-dup), `published = true`, still-current against the timestamp columns, ordered by `starts_at`, same `.limit(limit)`.
- Each event maps into the existing `Tournament` shape: `body` from `description`, `event_date` from the local date of `starts_at`, `event_end_date` from the local date of `ends_at`, `disciplines` from `disciplines`; `venue`, `address`, `divisions`, `registration_deadline`, `spectator_info`, `event_url`, `tag`, `discipline` all null. Ids prefixed `event:<id>` so React keys cannot collide.
- Limit handling: fetch `limit` from each branch, merge, sort by `event_date` ascending nulls last, then slice to `limit`. Because each branch is individually ordered, the merged top-N is provably the true top-N.
- Query key stays under the `["announcements", ...]` prefix.
- Realtime: the parent-facing channels (`ann-live`, `dash-live`) subscribe to `announcements` only — they do **not** listen for `events` changes. This union therefore does not live-update when an unannounced tournament event changes; it refreshes on next fetch/navigation. Not changed in this round unless you ask.

## 3. Prevention in the admin save path

`src/components/admin-events-tab.tsx`: when an event has a linked announcement, the announcement update also writes the event's `disciplines` (same null-when-empty rule), so event and announcement can never disagree again.

## Evidence I will report

`git diff --stat`; the final merge fallback and final `useTournaments`; signed in as a parent — Westchase Wrestling chip on calendar, dashboard and announcements; Grand Oaks Takedown and Brazoria County Hurricane Classic present and tagged in date order in both tournament lists; NAGA exactly once on 31 Oct and once per list; news feed unchanged (school-news only, paginated, no tournament leakage); the exact four titles/dates the dashboard renders via `useTournaments(4)`; and a Westchase discipline edit in the Events tab with the resulting `disciplines` from both the event row and announcement `215378aa-…`.
