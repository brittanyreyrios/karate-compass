# Round 52 — mark future-scheduled events for admins

Same gap Round 45 closed for announcements, applied to events. Scope is exactly one
state: `published = true` with `publish_at` in the future. Nothing else changes.

## Rule I am holding to

`publish_at` is added to **select lists only**. No `.eq`, `.gte`, `.lte`, `.or`, `.not`,
or any other predicate mentioning `publish_at` or `published` is added, removed or
altered. RLS stays the only gate. The three existing `.eq("published", true)` filters are
left exactly as they are.

## Admin gate

Reused from Round 45: `useSession()` + `useIsAdmin(user?.id)` from `@/hooks/use-auth`.
Badge renders only when that is true, so a parent's DOM contains no badge markup.
`ScheduledBadge` and `isScheduled` are used byte-identical — no fork, no restyle, no
second future-date check.

## The three surfaces

1. **Calendar** (`src/routes/_authenticated/calendar.tsx` + `src/lib/calendar-data.ts`)
   - add `publish_at` to the events select list and to the `DojoEvent` type;
   - carry it onto `CalendarItem` as `publishAt` (null for closures, testing dates and
     tournament rows, which have no such column);
   - render `<ScheduledBadge>` in `ItemCard` (the day panel) when admin and
     `isScheduled(item.publishAt)`.
   - Honest limitation: the month-grid tiles are single-line chips a few characters wide
     and cannot host the badge as-is. I will not invent a compact variant. The badge
     appears on the day panel card, which is where an event's detail already lives. If
     you want a marker on the tile itself, that is a separate decision.

2. **Dashboard "Next Up" strip** (`NextUpStrip` in `src/routes/_authenticated/index.tsx`)
   - add `publish_at` to the select list; render the badge inside the list item.

3. **Tournaments list** (`useTournaments()` in `src/lib/announcements.ts`, rendered by
   `TournamentCard`)
   - add `publish_at` to the events-branch select list and map it onto the `Tournament`
     shape (announcement-sourced rows carry their own `publish_at`, already covered by
     Round 45's map on the announcements page — the event-derived rows are the gap);
   - `TournamentCard` gains one optional `publishAt` prop; the two call sites (dashboard
     and announcements page) pass it and do the admin check. No change to the card's
     existing layout when the prop is absent, so the parent view is byte-for-byte the
     same.

## Untouched

No migration, no policy, no grant, no database function, no `get_school_news`. Nothing
from Rounds 43, 45, 47 or 50 changes.

## Verification I will report

`git diff --stat` (no `supabase/migrations/` entry); every added/changed line mentioning
`publish_at` or `published`, pasted; admin screenshots of a badged future-scheduled event
and an unbadged normal event on all three surfaces; a real non-admin parent session
(named) showing the scheduled event absent and zero badge markup; before/after rendered
event-id sets per surface for the same account; the grep proving `ScheduledBadge` and
`isScheduled` are byte-identical; test rows deleted with a zero-remaining query.

Plus the report-only analysis of the three `.eq("published", true)` client filters —
what removing them would show an admin and what argues against it. No change to them.
