# Tournament result tracking (round 1: single-result entry + parent view)

## 1 — Migration (one, only one)

Create `public.tournament_results` exactly as specified: `student_id` (cascade),
nullable `announcement_id` (set null on delete), denormalised `tournament_name` +
`tournament_date` written on every row, `event_name`, nullable `placement` with
`CHECK (placement IS NULL OR placement > 0)`, `disciplines text[]`, `notes`,
`created_by`, timestamps + `set_updated_at` trigger.

Indexes: `(student_id, tournament_date DESC)` and `(announcement_id)`.

RLS mirroring `point_events`:
- parents SELECT where the row's student belongs to them
- admins SELECT everything
- INSERT / UPDATE / DELETE admin-only via `public.has_role(auth.uid(),'admin')`

Grants last, in this order:
```
REVOKE ALL ON public.tournament_results FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_results TO authenticated;
GRANT ALL ON public.tournament_results TO service_role;
```
Then paste `relacl` proving no bare `=` entry and no `anon=` entry.

No change to any existing table or function.

## 2 — Admin entry

New "Results" admin tab (`src/components/admin-tournament-results.tsx`), wired into
the existing `ADMIN_TABS` list + `TabsContent` in `admin.tsx`, following the same
mobile Select/desktop tab strip already there.

Form:
- student picker (searchable, same pattern as existing student pickers)
- tournament source: pick an existing `announcements` row with
  `category = 'tournament'`, or "Enter manually" for name + date. Picking one
  prefills name, date and disciplines into editable fields; the stored row always
  carries its own name and date.
- `event_name`, optional `placement`, optional `notes`
- disciplines via the existing `DisciplinePicker` (no second picker)
- "Save and add another event" keeps student + tournament + disciplines and clears
  only event name / placement / notes, so multiple events at one tournament need
  one tournament entry.
- list of existing results with inline edit and delete (confirm on delete)

`created_by` = `auth.uid()`.

## 3 — Parent dashboard section

New "Tournament Results" section in `src/routes/_authenticated/index.tsx` for the
currently selected child only, fetched by that child's id.

- newest `tournament_date` first, rows grouped per tournament (name + date), each
  group one card with one line per event
- placement: 1/2/3 read as gold / silver / bronze using the leaderboard podium
  accents, 4+ shown plainly, `NULL` renders "Competed"
- discipline chips via `DisciplineTags` + `cleanDisciplines`
- empty state: one short encouraging line
- error state: existing `QueryErrorState`

No realtime subscription, no publication change.

## 4 — Verification I will report

- full migration SQL, and that it is the only one
- `git diff --stat`
- `relacl` output
- RLS both directions over REST as a real non-admin parent: own child's rows
  readable (non-zero), another family's not (zero/error), parent INSERT rejected —
  naming the accounts used
- clearly-labelled test rows incl. two events at one tournament and one NULL
  placement, dashboard screenshot showing grouping + "Competed", then deletion and
  a zero-row confirmation
- no existing student data changed; `md5(prosrc)` identical before/after for
  `get_leaderboard`, `divisions_of`, `get_curriculum_for_student`,
  `get_curriculum_for_all_children`, `get_technique_library`
