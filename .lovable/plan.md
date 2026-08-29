# Winner's Circle — school-wide tournament celebration

## 1. Migration (one migration, only DDL in this round)

```sql
ALTER TABLE public.tournament_results
  ADD COLUMN featured boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_winners_circle(_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid, first_name text, last_initial text, event_name text,
  placement smallint, tournament_name text, tournament_date date, disciplines text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT tr.id, st.first_name,
    CASE WHEN st.last_name IS NULL OR btrim(st.last_name) = '' THEN ''
         ELSE upper(left(btrim(st.last_name), 1)) || '.' END,
    tr.event_name, tr.placement, tr.tournament_name, tr.tournament_date, tr.disciplines
  FROM public.tournament_results tr
  JOIN public.students st ON st.id = tr.student_id
  WHERE tr.featured = true AND st.active = true
  ORDER BY tr.tournament_date DESC, tr.placement ASC NULLS LAST, tr.event_name ASC
  LIMIT COALESCE(_limit, 20)
$$;

REVOKE EXECUTE ON FUNCTION public.get_winners_circle(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_winners_circle(integer) TO authenticated, service_role;
```

No column beyond the eight listed is returned — no `notes`, no `student_id`, no
full `last_name`, no `created_by`, no `parent_id`. Grants are the last DDL. No
existing policy on `tournament_results` is touched, so direct table reads stay
family-scoped; the function is the only widened path.

## 2. Front-end

**`src/lib/tournament-results.ts` — additions only.** New `featured` field on the
`TournamentResult` type (added to `TOURNAMENT_RESULT_COLUMNS`), a new
`WinnersCircleRow` type and `useWinnersCircle()` query hook, and a
`groupWinnersByTournament` run-length grouper. `placementLabel`,
`placementTileClass`, and `placementChipClass` are left byte-identical.

**New `src/components/winners-circle-section.tsx`** — school-wide (never filtered
to the selected child), same card language as School News / Upcoming Tournaments
(`rounded-2xl border border-border bg-card p-6`). Groups by tournament (newest
first, order straight from the function, no client sorting). Each row: medal tile
from `placementTileClass` + the shared trophy/medal/award/Circle glyph,
`placementLabel` for wording (NULL → "Competed"), `First L.` name, event name,
and `DisciplineTags` with `cleanDisciplines`. Loading line, short empty line, and
`QueryErrorState` on error.

**`src/routes/_authenticated/index.tsx`** — render the section alongside the
existing dashboard sections.

**Admin `featured` control (default on):**
- `admin-tournament-results.tsx`: a "Show in Winner's Circle" switch in the
  single-entry form (part of the saved row, and editable when editing), plus a
  per-row toggle in the recorded-results list with a clear Featured / Hidden
  badge.
- `admin-tournament-bulk.tsx`: one switch for the whole batch, written into the
  single existing `.insert([...])` call — insert shape, duplicate detection,
  normalisation, validation, and the active-only query all unchanged.

## 3. Verification I will report

Migration SQL as committed and confirmation it is the only one; `git diff --stat`;
`proacl` showing no bare `=X` and no `anon=X`; the `last_initial` expression from
the committed `prosrc`; md5(prosrc) before/after for `get_leaderboard`,
`divisions_of` and the three curriculum readers; two-family ZZTEST rows (one NULL
placement, one `featured = false`) proving the unfeatured row is absent
school-wide yet still visible to its own parent; a real non-admin parent session
over REST proving cross-family rows come back from the function with no last name
or notes, while direct `tournament_results` selects stay own-children-only; a
dashboard screenshot; then deletion of every test row with a zero count.
