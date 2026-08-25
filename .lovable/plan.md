# Round 20: merge tags instead of dropping, tournaments without announcements, write-through

No migration, no database change. The announcements news feed keeps its `category = 'school_news'` filter and its pagination exactly as they are.

## 1 — De-dup merges the tags instead of discarding them

`src/lib/calendar-data.ts`, `buildCalendarItems`:

- Before the tournament loop, build `eventTagsByAnnouncement: Map<string, string[]>` from the events that are being suppressed — key `e.announcement_id`, value `cleanDisciplines(e.disciplines)`, only when non-empty.
- The existing `tournamentIds` set and the event-skip rule stay byte-for-byte as they are: an event with no linked tournament, or one whose tournament is outside the fetched window, behaves exactly as today.
- In the tournament loop: `const tags = disciplinesOf(t)` becomes "announcement tags when non-empty, else the suppressed event's tags, else empty". Announcement tags always win.
- `audienceLabel` already derives from `tags`, so Westchase picks up "Wrestling" there too when divisions are unset.

Result for Westchase WC Kickoff: one card, the tournament copy (venue, divisions, deadline, URL), tagged Wrestling.

## 2 — Upcoming Tournaments lists every tournament

`src/lib/announcements.ts`, `useTournaments(limit?)` becomes a union of two independently ordered branches, run in parallel:

- **Announcements branch** — unchanged: `category = 'tournament'`, the same "still current" `.or(...)` on `event_date`/`event_end_date`, `event_date` ascending nulls last, `.limit(limit)` when given.
- **Events branch** — `events` where `event_type = 'tournament'`, `announcement_id IS NULL` (that null check is the de-dup, so an announced tournament is never listed twice), `published = true`, and the same still-current rule expressed against the timestamp columns: `ends_at >= todayStart` OR (`ends_at IS NULL` AND `starts_at >= todayStart`), ordered by `starts_at` ascending, same `.limit(limit)`.

Each event row is mapped into the existing `Tournament` shape: `category: 'tournament'`, `body` from `description`, `event_date` from the local date of `starts_at`, `event_end_date` from the local date of `ends_at`, `location` from `location`, `disciplines` from `disciplines`, and `null` for `venue`, `address`, `divisions`, `registration_deadline`, `spectator_info`, `event_url`, `tag`, `discipline`. Ids are prefixed (`event:<id>`) so a React key can never collide with an announcement id.

**Limit handling:** each branch fetches `limit` rows, the two arrays are merged, sorted by `event_date` ascending with nulls last, then `.slice(0, limit)`. Because each branch is individually ordered, the merged top-N is provably the true top-N. Without a limit both branches fetch everything.

Query key stays `["announcements", "tournaments", limit ?? "all", today]` so existing realtime invalidation keeps hitting it. Both realtime subscriptions (dashboard and announcements page) will also invalidate on `events` changes if they do not already — the events admin tab already invalidates `["announcements"]` on save.

Neither the news-feed query nor its pagination is touched.

## 3 — Prevention: single writer for a linked pair

`src/components/admin-events-tab.tsx`, in the save mutation's linked-announcement branch: `announcementPayload(form)` gains `disciplines: form.disciplines.length > 0 ? form.disciplines : null`, so both the update path and the insert path write the event's disciplines onto the announcement row. The event is the single writer; the two rows can no longer disagree. Unlink/delete behaviour is unchanged.

Note the tournament editor in `admin.tsx` can still edit an announcement's disciplines directly — that stays, and since announcement tags win in step 1, an admin edit there is still respected until the event is next saved.

## Verification I will paste back

`git diff --stat` (expected: `calendar-data.ts`, `announcements.ts`, `admin-events-tab.tsx`, plus any realtime-invalidation line); the final merge fallback and the final `useTournaments`; a signed-in parent view of Westchase on calendar, dashboard and announcements page (Wrestling chip on all three); Grand Oaks Takedown (24 Oct) and Brazoria County Hurricane Classic (31 Oct) present in Upcoming Tournaments on both pages, tagged, in date order; NAGA exactly once on 31 October and exactly once in each tournament list; the news feed still school-news-only and still paginated with no tournament leakage; and a real Westchase edit in the Events tab followed by the `disciplines` value of both the event row and announcement `215378aa-…`.
