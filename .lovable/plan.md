# Discipline tags on events + parent calendar filter

## Part 1 — the column and the tag

**Migration (one column, nothing else):**

```sql
ALTER TABLE public.events ADD COLUMN disciplines text[];
```

No default, nullable, no CHECK constraint, no policy/function/grant change.

**One source of truth in the front end** — a new exported constant in `src/lib/calendar-data.ts`:

- `DISCIPLINES = ["Karate", "Jiu Jitsu", "Wrestling", "Striking"]`
- `DISCIPLINE_META` maps each to a token-based badge class, built with the existing `CHIP_BASE` recipe (same shape/padding/radius/size as `EVENT_TYPE_META`). Adding a fifth discipline later is one line here.
- Four new semantic token trios in `src/styles.css` (`--dsc-karate-bg/-fg/-line`, etc.) following the existing `--ev-*` pattern, so the dark theme is handled the same way. Hues: Karate red-orange, Jiu Jitsu blue, Wrestling green, Striking violet — deliberately distinct from the existing event-type hues, and contrast measured in the browser, not assumed.
- Each tag always renders its text label; colour is never the only signal.

**Admin events form** (`src/components/admin-events-tab.tsx`): four toggle buttons (`aria-pressed`) for the disciplines. None selected is valid and saves `null`. Existing event-type select and badges untouched.

**Rendering:** `disciplines` added to `DojoEvent`, to both event `select` lists (admin + calendar), and to `CalendarItem`; tags shown on the calendar day panel, the agenda list, the month-grid chips row, and the admin event list, alongside the unchanged event-type badge.

## Part 2 — client-side filter chips

- Session-only `useState` on the calendar page. Nothing persisted, no new query, no change to the events query shape.
- Chips render only when at least one item currently in view carries a tag.
- **The rule:** an item with no discipline tags is always shown. With chips selected, visible = untagged items + items carrying at least one selected discipline. No chips selected = everything. Closures (`class_holidays`), belt testing dates (`class_schedules`) and tournaments carry no `disciplines` and therefore always appear.
- Filter applies to the agenda list, the month grid and the selected-day panel from the same filtered array.
- "Show everything" reset button, real `<button aria-pressed>` chips, min 44px targets, existing focus rings, and a polite `aria-live` count of what is shown.
- Mobile first: chips wrap in a horizontal flex row.

## Verification (with ZZ rows, deleted after)

Migration file contents plus `information_schema` proof that `events` gained exactly one column and no constraint. Then, in the real browser: a ZZ event tagged with two disciplines rendering both tags; filtering to one discipline showing the match present, the other-tagged ZZ event gone, and an untagged ZZ event still present; a closure and a testing date still visible with a filter active; the chip bar absent once tagged events are removed. Row counts before/after and confirmation the four real events are unmodified and untagged.
