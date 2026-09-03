# Scheduled-post marker on the parent-facing pages (admin only)

Presentational only. No migration, no filtering, no change to `get_school_news`, policies or grants.

## New files

### `src/components/scheduled-badge.tsx`
The single copy of the amber marker, lifted verbatim from `admin-announcements-manage.tsx:495`:
`<Badge className="border-amber-400/60 bg-amber-500/15 text-amber-200" variant="outline">` with the
`CalendarClock` icon and `Scheduled · {formatChicagoDateTime(publishAt)}`. No new date logic —
`formatChicagoDateTime` supplies the zone abbreviation itself.

### `src/lib/scheduled-announcements.ts`
`useScheduledAnnouncementIds()` — an admin-only read:

- `supabase.from("announcements").select("id, publish_at").not("publish_at", "is", null)`
- `enabled: isAdmin`, using the app's existing `useSession()` + `useIsAdmin()` from `@/hooks/use-auth`
- returns a `Map<string, string>` of announcement id → `publish_at`, keeping only ids where the
  existing `isScheduled(publish_at)` from `src/lib/schedule-time.ts` is true

The `.not("publish_at","is",null)` is a *presence* test, not a future/past comparison — the
future-vs-now decision stays in `isScheduled()` on the client. RLS is the only visibility gate:
a non-admin gets zero rows regardless.

## Edited files

- `src/routes/_authenticated/index.tsx` — dashboard news list item: render `<ScheduledBadge>` when the
  id is in the map. No filtering, no ordering change, no layout change.
- `src/routes/_authenticated/announcements.tsx` — same, inside the existing article.
- `src/components/admin-announcements-manage.tsx` — replace the inline badge with `<ScheduledBadge>`;
  the `Live` badge and everything else stays.

## Verification I will report

- `git diff --stat` (no `supabase/migrations/` entry).
- Every added line mentioning `publish_at`, to show none filters on time.
- Admin screenshots: dashboard, Announcements page (scheduled marked, live unmarked), Manage Announcements.
- As a real non-admin parent over REST: `get_school_news` and a direct `announcements` select both lack
  the scheduled id; the new admin query returns 0 rows. Account named.
- Rendered announcement id set identical before and after, same account.
- A note on whether `events` has the same unmarked-admin gap (report only, no change).
