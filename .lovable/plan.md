# Scheduled announcements + announcement↔event linking

## 1. Migration (one migration, exactly this SQL)

```sql
ALTER TABLE public.announcements ADD COLUMN publish_at timestamptz;
ALTER TABLE public.events        ADD COLUMN publish_at timestamptz;

DROP POLICY "Anyone signed in views announcements" ON public.announcements;
CREATE POLICY "Signed in view published announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    (publish_at IS NULL OR publish_at <= now())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY "Signed in view published events" ON public.events;
CREATE POLICY "Signed in view published events"
  ON public.events FOR SELECT TO authenticated
  USING (
    (published = true AND (publish_at IS NULL OR publish_at <= now()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.get_school_news(...)  -- body unchanged except:
--   ORDER BY ... COALESCE(a.publish_at, a.created_at) DESC, a.id DESC
```

The function is re-created verbatim from the committed Round 34 body — same
signature, same SECURITY INVOKER, same `WHERE a.category = 'school_news'`, same
pinned → upcoming → recent grouping, same grants block at the end. The only
edit is `a.created_at DESC` → `COALESCE(a.publish_at, a.created_at) DESC` in the
ORDER BY. No `publish_at` filter is added inside it — the new SELECT policy does
that, because the function is SECURITY INVOKER.

No INSERT/UPDATE/DELETE policy is touched, no `published` column is added to
announcements, no cron/edge function/scheduled task, no realtime publication
change.

## 2. Timezone helper — new `src/lib/schedule-time.ts`

`publish_at` is a real timestamptz and must never go through
`parseDateOnly`/`formatDateOnlyLong`.

- `chicagoToInstant(date: "yyyy-mm-dd", time: "HH:mm"): string` — resolves the
  America/Chicago UTC offset for that wall-clock instant with
  `Intl.DateTimeFormat(..., { timeZone: "America/Chicago", timeZoneName: "longOffset" })`,
  then builds `yyyy-mm-ddTHH:mm:00±HH:MM` and returns its ISO instant. This is
  DST-correct (CDT −05:00 in August, CST −06:00 in January) and independent of
  the admin's own browser timezone.
- `instantToChicago(iso): { date, time }` — the exact inverse, used when editing.
- `formatChicagoDateTime(iso)` — badge text, e.g. `Sep 4, 2026, 7:00 AM CDT`,
  formatted with `timeZone: "America/Chicago"`.

## 3. Admin UI

**`src/routes/_authenticated/admin.tsx` — `AnnouncementForm`:**
- "Schedule for later" switch; when on, a date input and a time input. Off →
  `publish_at: null` (publish immediately). Submit button reads "Schedule" when
  scheduling.
- Calendar link block: "No calendar event" / "Create a new event from this
  announcement" / "Attach an existing event".
  - **Create** builds an `events` row with `all_day = true`, `starts_at` at
    Chicago midnight of `event_date`, and `ends_at` at Chicago end-of-day of
    `event_end_date` when that is set (otherwise NULL), so a multi-day
    announcement stays multi-day. `event_type` uses an explicit two-entry map:
    `tournament → tournament`, `school_news → other`. Nothing is derived from
    the category string and no new `event_type` value is introduced. The link is
    then stored as `events.announcement_id` — existing direction, no new column.
  - No `event_date` means there is no date to put on a calendar, so the "create
    a new event" option is **disabled** with the reason shown inline ("Add an
    event date first — a calendar entry needs a real date"). No time and no date
    is ever fabricated; there is no publish-instant fallback.
  - **Attach** lists only events whose `announcement_id IS NULL`, plus the event
    already linked to the announcement being edited. An event belonging to
    another announcement can never be selected, so no link is silently stolen.
  - Choosing **No calendar event** on an announcement that has a linked event
    sets that event's `announcement_id` to NULL and leaves the event itself on
    the calendar. It never deletes an event.
- "Hide this event on the calendar until the announcement publishes" checkbox,
  rendered only while the post is scheduled. Checked → linked event's
  `publish_at` = the announcement's instant; unchecked → the event's
  `publish_at` is set back to NULL. Rescheduling a post whose linked event is
  hidden rewrites the event's `publish_at` to the new instant in the same save,
  so the event can never surface ahead of the post.


**`src/components/admin-announcements-manage.tsx`:**
- Query gains `publish_at`.
- A row that is still scheduled gets a distinct amber `Scheduled · <Chicago
  date/time>` badge (live posts keep their current plain look), plus a
  **Publish now** action setting `publish_at = null`, and the same field is
  editable inline while editing a row.

Round 23's discipline write-through from an event to its linked announcement in
`admin-events-tab.tsx` is not modified; the events tab keeps its own path.
Parent-facing components need no scheduling filter — RLS is the gate — so no
front-end-only filtering is introduced.

## 4. Verification I will report

Committed migration SQL and confirmation it is the only one; `git diff --stat`;
the `pg_policy` query showing `USING (true)` gone from announcements; for the
`CREATE OR REPLACE`d function, `proname, proacl` confirming no bare `=X` and no
`anon=X`, plus `md5(prosrc)` before and after with a plain statement that the
only textual difference is the ORDER BY line; the ORDER
BY from the committed `prosrc` with the COALESCE; then, with named real

accounts, a REST proof in both directions — a parent's `select *` and
`get_school_news` missing a +1h scheduled post, an admin session seeing it
badged Scheduled, then the same parent request returning it after
`publish_at` is moved one minute into the past with no code change; the same
both-directions proof for a linked event with hide-until-publish checked; a
parent realtime subscription receiving no payload on the future-scheduled
insert; `SELECT count(*) FROM announcements WHERE publish_at IS NOT NULL` = 0
before and after; and deletion of every test row with a zero count.
