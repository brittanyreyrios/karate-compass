# Round 17 — a programme boundary for tier-wide curriculum

## Section A — Data model

Add one nullable column, no second source of truth:

```
ALTER TABLE public.curriculum_items ADD COLUMN program_id uuid REFERENCES public.programs(id);
```

Meaning, enforced by a `NOT VALID` check so existing rows are untouched:
- `belt_rank_id IS NOT NULL` (rank-targeted) → `program_id` must be NULL. The rank's belt
  system already implies the programme; a second field could only contradict it.
- `belt_rank_id IS NULL` (tier-wide) → `program_id` NULL means **all programmes**,
  a value means **that programme only**.

The programme of a *student* is read exactly where Round 14 AY put it:
`students.belt_rank_id → belt_ranks.system_id → belt_systems.program_id`. No name matching.

New tier-wide predicate in both functions (rank-targeted predicate byte-identical):

```
ci.belt_rank_id IS NULL
AND ci.curriculum_tier IS NOT NULL
AND array_position(v_tiers, ci.curriculum_tier) <= array_position(v_tiers, v_tier)
AND (ci.program_id IS NULL OR ci.program_id = <student's belt system program_id>)
```

Answers to the three questions:
- **Existing tier-wide item with no programme:** behaves exactly as today — visible to every
  programme. Zero rows change audience from the schema change alone.
- **"All programmes" stays expressible:** it is the explicit "Every programme" choice in the
  form, stored as NULL.
- **Belt system with no `program_id`:** the student's programme resolves to NULL, so
  `ci.program_id = NULL` is never true and only "all programmes" items reach them. No crash,
  and they never see another programme's material. (Today all five systems are mapped.)

### Backward compatibility — the rows I propose to change

The schema change alone widens nothing and narrows nothing. But it also does not fix the
reported bug on its own, because all six existing tier-wide items stay cross-programme. They
are the karate "Dojo Basics" block:

| technique | tier |
|---|---|
| Welcome! | beginner |
| How to Tie Your Belt! | beginner |
| Attention Stance & Bowing | beginner |
| Fighting Stance | beginner |
| Voice Commands | beginner |
| Punches from a Fighting Stance | beginner |

Proposed second statement in the same migration: set `program_id` = Karate on exactly these
six ids. **This narrows their audience** — jiu jitsu and tai chi students stop receiving
them; karate students are unaffected. Nothing becomes visible to more students than before,
anywhere. If you would rather keep the six cross-programme and scope only future items, say
so and I will ship Section A without the backfill.

## Section B — Admin form

In "Who sees this", when "A whole curriculum tier" is selected, a required programme choice
appears: "Every programme" plus one entry per row in `programs`. Below the fieldset, a live
sentence in plain English, e.g.:
- "Every Beginner student in Karate will see this."
- "Every Beginner student in all programmes will see this."
- rank mode: "Every student at Camo Purple and above, in the Camo Belt system, will see this."

Save is blocked while the audience is ambiguous (no rank chosen in rank mode; no programme
choice made in tier mode — the selector starts empty rather than defaulting to a programme).
The existing items list gains the programme in each tier-wide row's label so an already-saved
item's audience is readable too.

## Section C — Proof

Test rows created and deleted afterwards, existing records untouched. Over HTTPS against the
published host with a real non-admin parent session (minted per project tooling), calling
`get_curriculum_for_student` / `get_curriculum_for_all_children` for a karate-belt student, a
jiu jitsu student and a tai chi student, reporting actual rows for all five assertions
including the before/after count for the karate student.

## Section D — Invariants

- `cr.system_id = v_system` untouched.
- ORDERING CONTRACT comment and the whole ORDER BY preserved verbatim; verified by asserting
  in the Section C output that `group_label` runs are contiguous per student.
- `is_current` stays a plain boolean CASE, never NULL.
- Both functions are DROPped and recreated (`get_curriculum_for_all_children` is SQL and its
  body changes; signatures stay the same but I will DROP/CREATE for clarity), so
  `REVOKE ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` are the **last** DDL in the
  migration, and the grant audit query is re-run as the final statement with rows pasted.
- Migration is a new append-only file.
