# Two read-side display fixes: discipline chips everywhere, NAGA drawn once

No migration, no database change, no admin form change — neither is needed. Both bugs are in read code: two pages don't select `disciplines`, and `buildCalendarItems` has no de-duplication.

## Shared helper (extracted, as you suggested)

`src/lib/calendar-data.ts` gains:

```ts
export function disciplinesOf(row: { disciplines?: string[] | null; discipline?: string | null }): string[]
```

`disciplines` when non-empty, else `[discipline]` when the legacy value is set, else `[]` — all through `cleanDisciplines`. Yes, worth extracting: the same three-branch fallback currently exists twice (tournament branch of `buildCalendarItems`, `TournamentEditor` seed in `admin.tsx`) and would become four copies. Both existing copies get replaced by the helper so no reader can drift.

Note this touches `admin.tsx` by one call site — a pure refactor of already-existing logic, no form behaviour change. If you'd rather `admin.tsx` stay out of the diff entirely, say so and I'll leave its copy in place.

## Bug 1 — dashboard and announcements page

`src/routes/_authenticated/index.tsx`
- `disciplines: string[] | null` on the `Announcement` type; `disciplines` added to `DASHBOARD_ANNOUNCEMENT_COLUMNS`.
- Badge block at ~535 becomes: compute `const tags = disciplinesOf(t)`; render `<DisciplineTags disciplines={tags} />` when non-empty, otherwise the existing neutral `<Badge className="bg-foreground/10 …">Event</Badge>` exactly as it looks today, so something always sits beside the "Nd away" counter.

`src/routes/_authenticated/announcements.tsx`
- Same three changes; its neutral fallback keeps that page's own `hover:bg-foreground/15` badge markup verbatim.

No filtering of unknown values anywhere — `DisciplineTags` already renders them as neutral chips.

## Bug 2 — NAGA de-duplication

In `buildCalendarItems`, before the events loop:

```ts
const tournamentIds = new Set(tournaments.map((t) => t.id));
```

The events loop skips an event only when `e.announcement_id` is non-null **and** present in that set. Consequences, deliberately:
- Events pointing at school-news announcements ("After School Program Starts", "Level Up Your Board Breaking") have ids not in the set, so they stay.
- A tournament outside the fetched window puts nothing in the set, so the event copy is the only record of the day and still renders.
- The tournament copy is kept because it carries venue, divisions, registration deadline and event URL.

## Verification I will paste back

`git diff --stat`; the final JSX of both badge blocks; the final de-dup code; a signed-in parent view of 31 October (NAGA once, tagged Jiu Jitsu, plus Belt Testing); the two school-news-linked events on 10 and 28 August; ISKF Open + the three Jiu Jitsu tournaments showing identical chips on calendar, dashboard and announcements; and a temporary two-tag tournament (Karate + Jiu Jitsu) shown on all three surfaces, then reverted and re-confirmed.
