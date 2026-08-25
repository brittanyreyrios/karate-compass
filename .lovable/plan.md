# Discipline tags on events + tournaments, and a parent calendar filter

You are right: tournaments come from `announcements` (category = 'tournament'), and `announcements.discipline` is already populated — the four real rows read `Jiu Jitsu`, `Jiu Jitsu`, `Karate`, `Jiu Jitsu` (confirmed against the database). Revised accordingly.

## Part 1 — one migration, two columns, one backfill

```sql
ALTER TABLE public.events ADD COLUMN disciplines text[];
ALTER TABLE public.announcements ADD COLUMN disciplines text[];

UPDATE public.announcements
SET disciplines = ARRAY[btrim(discipline)]
WHERE discipline IS NOT NULL AND btrim(discipline) <> '';
```

Nullable, no defaults, no CHECK constraint, no policy/function/grant/trigger change, no other column touched. `announcements.discipline` stays exactly as it is — three readers still use it (`announcements.tsx` 169, `index.tsx` 534, `calendar-data.ts` 263 audience fallback). Before/after for the four tournament rows will be shown.

## Part 2 — one source of truth for the list, in code

New exports in `src/lib/calendar-data.ts`:

- `DISCIPLINES = ["Karate", "Jiu Jitsu", "Wrestling", "Striking"]` — adding a fifth is one line, no migration.
- `DISCIPLINE_META` — badge classes built on the existing `CHIP_BASE` recipe (same shape, padding, radius, text size as `EVENT_TYPE_META`), backed by four new `--dsc-*` token trios in `src/styles.css` following the existing `--ev-*` pattern for the dark theme. Karate red-orange, Jiu Jitsu blue, Wrestling green, Striking violet — distinct from the event-type hues, contrast measured in the browser.
- Every tag renders its text label; colour is never the only signal. Existing event-type badges are not restyled.

`CalendarItem` gains `disciplines: string[]` populated from **both** sources — `events.disciplines` for events, and the tournament row's `disciplines` for tournaments — so the filter works on one field regardless of origin. Closures and testing dates get `[]`.

## Part 3 — the hyphen inconsistency

Standardise on `Jiu Jitsu` (no hyphen), matching the stored data:

- `admin.tsx` 1652 default state and 1711 `SelectItem` value/label — the tournament form now writes the `disciplines` array *and* keeps `discipline` populated with the first selected value, so legacy readers keep working.
- `announcements.tsx` 169 and `index.tsx` 534 badge comparisons — currently compare to `"Jiu-Jitsu"` and therefore never match real data; fixed to `"Jiu Jitsu"`.

Every changed location will be reported by file and line.

## Part 4 — admin forms (there are three, not two)

- Events form (`admin-events-tab.tsx`): four discipline toggles (`aria-pressed`); none selected is valid and stores `null`. Event type unchanged.
- Tournament **create** form (`admin.tsx` ~1652–1711): the single-value `Select` becomes the same multi-select, writing `disciplines` plus legacy `discipline` = first selected value.
- Tournament **edit** form (`admin.tsx` ~1845–1846): the free-text `discipline` `Input` is replaced by the same multi-select, writing both fields the same way. Confirmed by reading the file. Leaving it free-text would let one editor change `discipline` while the array went stale, so the badge and the filter would disagree about the same tournament — the free-text field does not survive.
- Existing values outside the four (none today, but possible) are preserved: the multi-select seeds from the stored array/`discipline` and keeps any unknown value selected rather than dropping it on save.
- Both `events` selects (admin + calendar), the calendar tournament select, and the announcements/tournament column lists gain `disciplines`.

## Part 5 — parent-facing filter chips

- Session-only `useState` on the calendar page. No preference stored, no new query, no change to query shape, filtering purely client-side over loaded items.
- Chips render only when at least one item currently in view carries a **known** tag.
- **The rule:** no chips selected = everything. Chips selected = every item that has no known-discipline tag, plus every item carrying at least one selected discipline. This covers three cases identically: no tags at all, and tags that are entirely outside `DISCIPLINES` (e.g. "Judo" or a typo) — such an item is treated as untagged and is always shown. Unknown values are never dropped from the data or rewritten; they simply cannot hide an item. Its unknown tag still renders as a neutral chip so the admin can see the typo.
- Closures and belt testing dates have no tags and therefore never disappear.
- One filtered array feeds the agenda list, month grid and selected-day panel.
- "Show everything" reset. Real `<button aria-pressed>` chips, 44px targets, existing focus rings, polite `aria-live` count. Mobile-first wrapping row.


## Verification (real output, ZZ rows deleted afterwards)

1. Migration file contents plus `information_schema` proof of exactly the two new columns and no new constraint.
2. Before/after of the four tournament rows' `discipline` and `disciplines`.
3. A ZZ event tagged with two disciplines: stored value and both tags rendering.
4. Filter to one discipline: matching ZZ event present, differently-tagged ZZ event gone, untagged ZZ event still present.
5. **Filter to "Jiu Jitsu": a real Jiu Jitsu tournament visible, the Karate ISKF Open gone, and a school closure plus a belt testing date still visible.**
6. A ZZ event tagged `{Judo}` only: with a filter active, it still appears.
7. A ZZ tournament edited through the **edit** form: `discipline` and `disciplines` agreeing afterwards.
8. Page with no tagged items in view: chip bar absent.
9. The four real events still render, untagged and unmodified; `events` and `announcements` row counts before/after; all ZZ rows deleted; RLS policies and functions unchanged.
