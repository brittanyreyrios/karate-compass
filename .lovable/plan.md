# Round 14 — assignment that survives an import, a mismatch flag, one stale label

## AX — Jiu Jitsu level assignment as a callable function

Migration (append-only) adds `public.assign_jiu_jitsu_levels()`:
- `SECURITY DEFINER`, `SET search_path = public`, admin guard `IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'`.
- Predicate lifted unchanged from migration `20260812035157`: `belt_rank_id IS NULL`, `active = true`, enrolled in >= 1 class whose programme is Jiu Jitsu & Wrestling, and enrolled in no class of any other programme (classes with `program_id IS NULL` count as another programme).
- Keeps the existing exception when the `jiu_jitsu` level or the Jiu Jitsu & Wrestling programme row is missing.
- Returns `jsonb`: `assigned`, `skipped`, `skipped_students` (array of `{id, first_name, last_name}` — rankless children who also train another programme).
- `REVOKE EXECUTE FROM anon, public`; `GRANT EXECUTE TO authenticated, service_role`.
- No trigger on `student_classes`, per the instruction.

Frontend:
- CSV importer calls the function after a successful import and appends a plain sentence to the summary block the admin already reads ("3 jiu jitsu students were given the Jiu Jitsu level. 1 rankless student was skipped because they also train another programme — check their belt.").
- New "Assign jiu jitsu levels" button beside the "No belt rank set" filter in Manage Students, counts reported in a toast, roster queries invalidated after.

Verification: execute on live, report JSON; create a clearly labelled throwaway rankless student enrolled only in a Jiu Jitsu & Wrestling class, re-run, report JSON; delete the throwaway row plus its enrollment and any point rows; confirm the "No belt rank set" count returns to its starting value.

## AY — mismatch flag (built together with AX)

Migration adds nullable `belt_systems.program_id` referencing `programs(id)` and sets it for existing rows: `solid`, `camo`, `youth_stripe` -> Karate; `jiu_jitsu` -> Jiu Jitsu & Wrestling; tai chi system -> Tai Chi. This is the single mapping location — no slug lists in queries or components.

Admin students list gains a third filter chip "Rank doesn't match programme (n)". A student is mismatched when: has a rank, is active, is enrolled in >= 1 class with a non-null `program_id`, and the `program_id` of their rank's belt system matches none of the programmes they are enrolled in. Dual-programme children (karate belt + karate and jiu jitsu classes) match one programme and are therefore never flagged; verified explicitly with a throwaway row. Belt-system rows with a null `program_id` never flag anyone.

Also: one muted line beside the class enrolment editor — "Changing a student's classes does not change their belt or level — set that separately." Flag only, never auto-correct a rank.

## AZ — stale belt name in the sibling switcher

Taking option (a) plus (b): the dashboard "Viewing" dropdown resolves the rank like the rest of the page (`rank?.name ?? s.current_belt`), and the admin save path writes `current_belt` alongside `belt_rank_id` so the column stops drifting at source. (a) alone leaves a column that keeps drifting; (b) alone leaves the raw read for the next writer to break. `current_belt` is neither dropped nor renamed.

## Notes

- `get_leaderboard` is not touched this round, so its truncation is not re-quoted.
- No existing record is modified or deleted; all test rows are labelled and removed.
