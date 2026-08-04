# Round 3 follow-ups: tournaments on the calendar, one colour system, real loading states

No database changes are needed. Tournaments already exist in `announcements`; this is a read-only third source for the calendar.

## 1. Tournaments on the calendar (read-only)

- Add a third query in `useCalendarData`: `announcements` where `category = 'tournament'` and `event_date` is not null, overlapping the visible month window (`event_date <= windowEnd` and `coalesce(event_end_date, event_date) >= windowStart`).
- Extend `CalendarItem.kind` to `"closure" | "event" | "tournament"` and add `"tournament"` handling in `buildCalendarItems`.
- Multi-day: expand each tournament into one item per day between `event_date` and `event_end_date` inclusive, each with a "Day 1 of 2" style label so IBJJF Houston Fall Open (Oct 10–11) renders on both cells. Verified in the browser, not assumed.
- Detail panel shows venue/address, discipline, divisions note, and registration deadline where present. No edit controls — tournaments stay editable only in the Tournaments admin.
- `announcements` remains the single source of truth; nothing is copied into `events`.

## 2. One coherent event-type colour system

- Replace `EVENT_TYPE_META` badge strings with one shared chip recipe (same padding, radius, text size, weight, 1px border) where only the hue changes. Hues added as semantic tokens in `src/styles.css` for both light and dark themes:
  - Belt Testing — brand red
  - Tournament — amber/gold
  - Special Class — blue
  - SWAT Team — purple
  - Seminar — teal
  - Event (other) — neutral grey
  - Closure — slate + dashed border (non-chromatic differentiation)
- Fixes the accessibility bug: `text-destructive-foreground` on a 10%-opacity background is dropped. Each hue gets a paired foreground token designed for its own tinted background.
- Contrast verified by computing the actual rendered colours in the browser (`getComputedStyle` on real chips, composited over the card background) and reporting measured ratios for all seven types in both themes — not asserted.
- Labels always ship alongside colour, including truncated on month-grid chips.
- Applied everywhere event types render: month grid, agenda list, day panel, dashboard "Next up", admin Events tab. Calendar legend lists all seven plus tournaments/closures.

## 3. Loading states that are actually visible

- `src/router.tsx`: add `defaultPendingComponent` (a route-shell skeleton matching the existing ones, not a spinner), `defaultPendingMs: 150`, `defaultPendingMinMs: 400`.
- App shell first paint: render the Tiger's Den header chrome plus a skeleton body instead of white during boot/hydration.
- Query skeletons get the same delay/minimum treatment via a small `useDelayedLoading(isLoading)` hook (show after 150ms, hold 400ms) used on every data page, so nothing appears for a single frame.
- Verification: Playwright with CDP network throttling at Slow 4G, hard reload, then navigate `/` → `/curriculum` → `/calendar` → `/leaderboard`, screenshotting each step. Reported per step; any blank or unstyled flash is treated as not done.

## Technical notes

- Files touched: `src/lib/calendar-data.ts`, `src/routes/_authenticated/calendar.tsx`, `src/components/month-grid.tsx`, `src/components/admin-events-tab.tsx`, `src/routes/_authenticated/index.tsx`, `src/components/skeletons.tsx`, `src/router.tsx`, `src/routes/__root.tsx`, `src/styles.css`, plus a new `src/hooks/use-delayed-loading.ts`.
- No migration, no seeded or invented data.
