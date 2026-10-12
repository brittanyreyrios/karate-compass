# Round 68 — Gym-time calendar, dashboard thumbnails, image framing, announcement-delete events, event times

Starting commit: `81562c998447b2fa474f8ecc107d8dacd6e567e0`. App code only, no migration, no data changes.

## Part A — every event day/time in gym time

One new helper set in `src/lib/schedule-time.ts`, built on the existing `GYM_TIMEZONE` and `instantToChicago` (no new constant, no library):
- `chicagoDateKey(iso)` → yyyy-mm-dd in Chicago (`instantToChicago(iso).date`)
- `chicagoMinutes(iso)` → minutes since Chicago midnight, for sorting
- `formatChicagoTime(iso)` → "5:00 PM" via `Intl.DateTimeFormat({ timeZone: GYM_TIMEZONE })`

**Time-zone suffix: none** on parent screens (one Houston gym; "5:00 PM CDT" on every chip is noise). The admin-only Scheduled badge keeps its existing "CDT" suffix.

### toDateKey / date-derivation call sites

Changed:
- `calendar-data.ts:352` event `dateKey` → `chicagoDateKey(e.starts_at)` (the Fall Festival bug)
- `calendar-data.ts:241,362-363` `formatTime` → `formatChicagoTime`
- `calendar-data.ts:364` `sortMinutes` (getHours/getMinutes) → `chicagoMinutes`
- `calendar.tsx:97-98` query bounds `${key}T00:00:00Z` → `chicagoStartOfDay(fromKey)` / `chicagoEndOfDay(toKey)` (end widened to 23:59:59.999 inside the helper call site, not by changing the helper)
- `announcements.ts:60` `localDateKey(starts_at/ends_at)` for event-sourced tournaments → `chicagoDateKey`
- `index.tsx:707,714` dashboard "Next Up" event date and time → gym time
- `admin-events-tab.tsx:46` `toLocalInput` and `:115-116` save, and `:388` list label (Part E)
- `admin.tsx:2372` "attach existing event" picker label → gym date

Deliberately left, with reason:
- `month-grid.tsx:60`, `calendar.tsx:196`, `index.tsx:306` `toDateKey(new Date())` — "today" is the viewer's own day (highlight, and next-belt-test "today or later" from Round 54, which compares date-only columns).
- `month-grid.tsx:61,82`, `calendar.tsx:69-70,210`, `calendar-data.ts:433,438` — these operate on grid cells / `dateFromKey` dates that are already pure calendar days built from yyyy-mm-dd keys; no instant is involved, so device zone cannot shift them.
- `announcements.ts:53` "today" for the still-current tournament filter — viewer-relative, a one-day edge at most, and changing it alters which tournaments list. Flagged, not changed.
- All `date-only.ts` helpers and `next_test_date` / `event_date` (date columns) — Round 36/54 date-only path, untouched.
- `created_at` / `changed_at` "Posted…/updated…" labels — audit timestamps, not event days.

### Other parent places that turn starts_at into a day/time
- Calendar list + month grid: **fixed** (above).
- Dashboard "Next Up" event: **fixed**.
- Tournament cards from events (no announcement): **fixed** via `announcements.ts`.
- Tournament cards from announcements and announcement event links: **not affected** — they use the date-only `event_date`.

### Proof
Staff fixture, browser time zone forced to America/Denver, Los_Angeles, New_York: Calendar screenshots showing Fall Festival Fri 30 Oct 5:00–9:00 PM and SWAT prep 4:00 PM on 30 Oct (real rows, read-only). All-day proof: a test all-day event on 30 Oct with `publish_at` 2099 (hidden from every parent by existing RLS; staff can see it), shown on 30 Oct in all three zones, then deleted.

## Part B — dashboard School News thumbnail
- One extra read of the shown news IDs (`id, image_url, image_alt`, same RLS) like the Announcements page, then **one** `usePostImageUrls(allKeys)` call for the whole list.
- 72px square, `object-cover`, rounded, `loading="lazy"`, to the right of the title/body, `shrink-0` so text wraps; alt = `image_alt` or title. No image = card unchanged.
- Dashboard tournament cards stay text-only.
- Proof: 390 and 1536 screenshots, card `scrollWidth <= clientWidth`, network log showing a single sign request.

## Part C — no backdrop around post images
`PostImage`: drop the bordered muted box; the `<img>` itself gets `mx-auto block h-auto w-auto max-w-full max-h-80 rounded-xl`. Portrait stays capped at 320px with no bars; landscape fills the card width. Shared by announcement, poll and full tournament card.
Proof: Fall Festival flyer at 390 and 1536; a landscape image on a 2099 test post injected into the browser only, at both widths.

## Part D — deleting an announcement with calendar events
- FK today (read from pg_constraint): `events_announcement_id_fkey … ON DELETE SET NULL`. Not changed.
- The delete dialog lists each linked event with its gym-time date/time ("Fall Festival — Fri 30 Oct, 5:00 PM"), replacing today's "the event itself stays" sentence, with a choice: **Delete the event too** (default) / Keep it on the calendar.
- Order: delete announcement row(s) → delete the pre-read event IDs (if chosen) → delete images. A failed announcement delete removes nothing.
- Orphan count, read-only: 8 events have `announcement_id IS NULL`; **0** have the shape Post Announcement creates (all-day starting exactly at Chicago midnight), so none look like deleted-announcement leftovers. I'll show the query and rows.

## Part E — entering times
1. Events editor: load with `instantToChicago`, save with `chicagoToInstant` (split the datetime-local value into date + time). All-day keeps its date and saves `chicagoStartOfDay`. No new conversion code.
2. Post Announcement: optional Start time / End time beside the event date. Blank = all-day exactly as today. Filled = `all_day false`, `chicagoToInstant(eventDate, time)` (end on end date if set, else same day); end must be after start, else a plain error.
3. Test on a 2099 test post only, verify the saved instants in SQL, delete afterwards.

## Not touched
Database data (except temporary 2099 test rows, deleted), publish_at/published logic, the four `.eq("published", true)` filters, R57 points period, R62 attendance dating, leaderboard, FK.

Report will include `git diff --stat` with package.json and bun.lock (expected: no dependency changes).
