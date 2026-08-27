# Announcement date labelling

Only two files change; no queries, no database.

## What to change

### `src/routes/_authenticated/announcements.tsx`

In the school-news article bottom date block (~line 141):

- When `event_date` is set, render it as the prominent date with a `Calendar` icon, using the same `formatDateRange(event_date, event_end_date)` format the tournament cards use.
- Render the posted date beneath it, smaller and muted, prefixed with **"Posted"**.
- When `event_date` is null, render only the smaller muted **"Posted"** date.

### `src/routes/_authenticated/index.tsx`

In the dashboard school-news list item date area (~line 516):

- Apply the identical pattern: prominent `formatDateRange` event date with `Calendar` icon when `event_date` is set, otherwise only the smaller muted **"Posted"** date.
- The posted date must always carry the **"Posted"** label.

## What stays the same

- `ANNOUNCEMENT_COLUMNS` and `DASHBOARD_ANNOUNCEMENT_COLUMNS` already include `event_date` and `event_end_date`; no query or type changes.
- No database migration.
- Reuse the existing `formatDateRange` helper and `Calendar` icon import.

## Evidence I will report

- `git diff --stat` (expecting exactly the two files above).
- Final JSX of both date blocks.
- Playwright screenshots signed in as a parent showing the "HAPPY BIRTHDAY GMZ" card on both the dashboard and the announcements page with September 6 as the event date and today's date labelled "Posted".
