# Extract a shared TournamentCard component

## Problem

The tournament card is hand-built twice — `src/routes/_authenticated/announcements.tsx` (lines ~175-215) and `src/routes/_authenticated/index.tsx` (lines ~559-590) — and the copies have drifted in heading font, padding, radius, days-counter wording, and available fields.

## Approach

Create one shared component and render it from both pages. Display-only: no database, migration, query, or `useTournaments` changes.

### New file: `src/components/tournament-card.tsx`

- Props: `tournament: Tournament` (the existing type from `@/lib/announcements`) and `variant: "full" | "condensed"`.
- Styling taken from the **announcements page** (the reference): `article rounded-2xl border border-border bg-card p-5`, `font-display uppercase` title.
- Shared parts (identical on both variants):
  - Timeline dot wrapper (`li relative` + the primary-ringed dot) — using the announcements page's larger dot style.
  - Discipline chips row: `disciplinesOf(t)` chips via `DisciplineTags`, or the neutral "Event" badge when no tags resolve. Unknown tags still render as neutral chips — no filtering added.
  - Days counter: one wording, **`{days} days`** (the announcements page wording — it's unambiguous, whereas "Nd away" reads like shorthand), in `font-display text-xs font-bold uppercase tracking-widest text-primary`.
  - Location line (MapPin icon, `venue · address` fallback to `location`).
  - Dates line (Calendar icon, existing `formatDateRange(event_date, event_end_date)`).
  - Official event page link (ExternalLink icon, `target="_blank" rel="noreferrer"`), shown only when `event_url` is set — now present on **both** pages.
- `variant="full"` (announcements page) additionally renders: body paragraph, Divisions / Register by (via existing `formatDateOnly`) / spectator info.
- `variant="condensed"` (dashboard) omits body, divisions, register-by, spectator info, and instead renders a small muted footnote: *"Full details in Announcements"* — a `Link` to `/announcements`, styled `text-xs italic text-muted-foreground` so it reads as a pointer, not a data field.

### Edits

1. `src/components/tournament-card.tsx` — new component (imports `Calendar, MapPin, ExternalLink` from lucide-react, `Badge`, `DisciplineTags`, `disciplinesOf`, `formatDateOnly`, `formatDateRange`, `Link`).
2. `src/routes/_authenticated/announcements.tsx` — replace the inline `<li>` markup with `<TournamentCard tournament={t} variant="full" />`; drop now-unused imports.
3. `src/routes/_authenticated/index.tsx` — same swap with `variant="condensed"`; drop now-unused imports. The list wrappers (`ol`, headers, skeleton/error/empty states) stay in each page unchanged.

### Out of scope

- Calendar page — it uses its own item renderer; untouched.
- No query/data changes, no migration, no new filtering of unknown discipline tags.

### Verification

- Build log shows `build OK`.
- `git diff` output (or `git diff HEAD~N` if auto-committed) showing the three files.
- Sign in as a parent via Playwright, capture the ISKF Open card on the dashboard and on /announcements, confirm identical styling/fields per variant and the new link + footnote on the dashboard.
