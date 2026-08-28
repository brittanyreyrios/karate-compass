# Round 34 — one shared news date block, real pinning, upcoming-first order

One migration (one column + one ordering function). Everything else is front-end.
Tournament cards, `useTournaments`, existing policies, realtime subscriptions,
`get_leaderboard`, `divisions_of` and the curriculum functions are untouched.

## Part 1 — shared date layout

New component `src/components/news-card-dates.tsx`, exporting two small pieces so
both surfaces are laid out from the same source:

- `NewsCardTopRow` — a `flex items-center justify-between gap-3` row: tag badge
  (or the pin indicator, see Part 2) on the left; on the right, only when
  `event_date` is set, the `Calendar` icon + `formatDateRange(event_date,
  event_end_date)`. No `event_date` means the right side renders nothing and the
  row collapses — the posted date is never promoted there.
- `NewsPostedLine` — always rendered as the last element of the card:
  `text-xs text-muted-foreground`, `Posted {created_at.toLocaleDateString()}`.

`src/routes/_authenticated/index.tsx` and
`src/routes/_authenticated/announcements.tsx` both drop their hand-built date
markup and use these. The dashboard keeps `line-clamp-2`; the announcements page
keeps its full body. No other styling changes.

## Part 2 — pinning

Migration adds `pinned boolean NOT NULL DEFAULT false` to `public.announcements`.
No policy change. Grants are the last DDL in the migration, and I will paste
`SELECT relname, relacl FROM pg_class WHERE relname = 'announcements';` after it
to show the table ACL is unchanged.

Admin surfaces:
- `AnnouncementForm` (admin.tsx): a "Pin to top of the feed" checkbox, written
  into the insert payload.
- `ManageRow` (`admin-announcements-manage.tsx`): a pin toggle button on each
  row that updates `pinned` directly and invalidates the existing query keys.

Parent surface: the automatic "LATEST" marker on the first card is **removed**.
In its place, a pinned card shows a `Pin` icon + "Pinned" indicator in the
top-left of the shared top row (next to the tag), and keeps the existing
highlighted border/gradient treatment that used to be tied to index 0. The
indicator therefore only ever means "staff pinned this".

## Part 3 — new default order, done in the database

New `public.get_school_news(_limit integer, _offset integer)` — `STABLE`,
`SECURITY INVOKER` (so the existing RLS policies keep deciding who reads what,
which is why no policy needs to change) — returning the same explicit column list
the feed already selects, ordered:

```sql
ORDER BY
  pinned DESC,
  CASE WHEN pinned THEN 0
       WHEN event_date >= CURRENT_DATE THEN 1
       ELSE 2 END,
  CASE WHEN pinned OR event_date >= CURRENT_DATE THEN event_date END ASC NULLS LAST,
  created_at DESC,
  id DESC
LIMIT _limit OFFSET _offset
```

Groups: pinned, then upcoming (`event_date >= CURRENT_DATE`) soonest first, then
everything else (past event dates and null event dates together) newest-posted
first. Past events are deliberately in their own group, so an August event can
never sit above a November one.

Tie-breakers: within pinned and within upcoming, equal `event_date` falls back to
`created_at DESC` then `id DESC`; the third group is `created_at DESC, id DESC`.
`id DESC` is the final tie-break everywhere, so the order is total and nothing
shuffles between loads.

Pagination: both the announcements page and the dashboard call the function via
`supabase.rpc`, so ordering and slicing happen in the same server-side query.
The announcements page keeps its existing "show older" behaviour by growing
`_limit` (20, 40, …) with `_offset = 0`; page 2 is therefore the same total
ordering re-evaluated with a larger window, never a re-sort of already-fetched
rows. Because the ORDER BY is total, a row cannot appear on both windows or be
skipped between them. The dashboard calls it with `_limit = 8, _offset = 0`.

Grants: `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO
authenticated, service_role;` as the final statements.

## Evidence I will report

- Complete migration SQL, confirmation it is the only one, and the `relacl` check.
- `git diff --stat`.
- Full source of the shared date component.
- The exact `ORDER BY` as applied, plus the page-2 argument above.
- Parent-signed-in phone-width screenshots: dashboard and announcements page,
  each showing a card with an event date and one without — four cards, identical
  layout apart from body length, no posted date in any top-right corner.
- Four clearly-labelled ZZTEST announcements (pinned / upcoming / past event /
  no event date), the feed order before and after pinning one, then deletion and
  a zero-row count.
- Where the pin indicator appears and a grep proving "LATEST" is gone.
