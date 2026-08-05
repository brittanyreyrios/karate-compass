# Round 5 — Section R rebuild, belt icon refinements, parked items

First, plainly: Section R was never written. Nothing from it exists in the code. It is rebuilt from scratch below. Sections P and Q stay as they are.

## Section R1 — Belt tests on the calendar and in announcements

**Migration** (new, append-only): add `test_announcement_id uuid REFERENCES public.announcements(id) ON DELETE SET NULL` to `class_schedules`.

**Calendar — derived, no rows created**
- `useCalendarData` gains a fourth query: `class_schedules` where `next_test_date` is not null and falls inside the visible window (month ±1).
- `CalendarItem.kind` gains `"testing"`. `buildCalendarItems` takes a `tests` source and emits **one item per date**, not per class: classes testing on the same day are collapsed into a single "Belt Testing" chip, with the class names listed in the day detail panel (`audienceLabel` / `description` carry the list). `eventType: "testing"`, so the existing testing chip styling and legend entry apply unchanged.
- Because it is derived from `next_test_date`, moving or clearing a date updates the calendar immediately; no sync logic, no stale rows.

**Announcement lifecycle in the Class Schedules & Testing tab**
- Each class row gets a checkbox "Also post an announcement", ticked by default, mirroring the `postToAnnouncements` lifecycle already in `admin-events-tab.tsx`.
- On "Save & push" with the box ticked: create an announcement (`category = 'school_news'`, `event_date = next_test_date`) if `test_announcement_id` is null and store the id; otherwise update the existing one. Never a second announcement for the same class.
- Unticked on a later save: delete the linked announcement, clear the column.
- Clearing the date (allowing an empty date to be saved, which is new): removes the calendar entry, deletes the linked announcement, clears the column.
- Title/body from real values only — class name and date. No invented time, location, or requirements.

## Section R2 — Announcements management

New admin tab **"Manage Announcements"** (the Post Announcement form stays where it is; a separate tab keeps the mobile `<Select>` tab strip readable).

- All announcements, newest first: title, category, `event_date`, created date.
- Filters: category (All / School News / Tournament) and "posted before" date.
- Inline edit of title and body per row.
- Per-row delete behind a confirmation dialog naming the announcement.
- Multi-select with "Delete selected", same confirmation rules applied to the selection.
- Confirmation warnings, honest and specific:
  - `category = 'tournament'` → "This is a tournament — deleting it also removes it from the calendar and the dashboard."
  - referenced by `events.announcement_id` → warn that the Events tab will show that event as no longer posted (FK is `ON DELETE SET NULL`, nothing breaks).
  - referenced by `class_schedules.test_announcement_id` → same warning; the column is cleared.
- No soft-delete, no archive flag. Deleted means gone.

## Section S — Belt icon refinements

All inside `src/components/belt-chip.tsx`; it stays the single shared component.
- **Longer tails**: roughly as long as the band is tall, drawn as tapered/angled paths so they read as hanging fabric, not two notches.
- **Rounder knot**: soft rounded bundle, slightly wider than the band, reads correctly at 24px.
- **Thin light outline on every belt** (band, knot, tails) so coloured belts separate from the dark card — kept thin enough not to dominate at 24px.
- Unchanged: lengthwise stripe, camo treatment, `role="img"` with the full aria-label, `sm`/`md` sizes.
- Verified with element screenshots at 24px (leaderboard) and podium size before reporting.

## Section T — Parked items

- **T1**: new no-op migration containing only the correction comment about the private `album-covers` bucket, exactly as specified. No existing migration touched.
- **T2**: CSV importer gains a "Belt system for this import" selector alongside "Assigned class"; matching is restricted to the chosen system, with exact `name` match preferred over `short_name`. Ambiguity still resolves to NULL with the candidate-naming warning. No global solid-system preference.
- **T3**: I cannot run this. Git operations are not available to me in this environment — `git rm --cached .env` has to be run by you locally. `.env` is confirmed tracked, and `.gitignore` does already contain `.env`, so the single command plus a commit is all that is needed. I will not report it as done.

## Technical notes

- Only additive migrations: one for `test_announcement_id`, one no-op correction comment.
- Testing items are read-only on the calendar; `class_schedules` already has a read policy for signed-in users (to be confirmed before shipping, and a policy added in the same migration if not).
- Verification before reporting: typecheck, existing tests, and a signed-in browser pass over `/calendar` (grouped testing chip + day detail), the admin schedules tab (checkbox lifecycle), the new announcements tab (filters, inline edit, both delete paths and each warning), and belt icon screenshots at both sizes.
