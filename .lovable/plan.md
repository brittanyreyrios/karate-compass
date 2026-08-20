# Round 17 (re-planned) — curriculum scoped by programme, resolved from classes

## What I found before planning (two things contradict the brief)

1. There are exactly three programmes: **Karate**, **Jiu Jitsu & Wrestling**, **Tai Chi**.
   `Teen Karate`, `Adult Karate` and `Tai Chi` classes are all mapped to the **Tai Chi**
   programme already — so the separation you describe is expressible today with no new
   programme row. Its display name reads "Tai Chi" while your sentence example says
   "Tai Chi & Karate"; I will not rename it unless you ask.
2. 🔴 The single existing rank-targeted item is **not** children's karate material. It is
   `ae04d5c1-3af8-4743-966c-5e0069573597` — "test for jiu jitsu", pinned to the **Jiu Jitsu**
   rank in the beltless Jiu Jitsu system. Setting it to Karate would hide it from the only
   students who can currently see it and show it to nobody new. See Section C for the choice
   I need from you.

## Section A — `program_id` on all curriculum items

```
ALTER TABLE public.curriculum_items
  ADD COLUMN program_id uuid REFERENCES public.programs(id);
```

- Nullable. **NULL = every programme** — deliberately shared material.
- Applies to rank-targeted and tier-wide items alike.

Both predicate branches gain the same programme filter; the rank branch keeps
`cr.system_id = v_system` untouched, so belt-system scoping and programme scoping stack:

```
-- rank-targeted
cr.id IS NOT NULL AND cr.system_id = v_system AND cr.sort_order <= v_rank_order
AND (ci.program_id IS NULL OR ci.program_id IN (student's class programmes))

-- tier-wide
ci.belt_rank_id IS NULL AND ci.curriculum_tier IS NOT NULL
AND array_position(v_tiers, ci.curriculum_tier) <= array_position(v_tiers, v_tier)
AND (ci.program_id IS NULL OR ci.program_id IN (student's class programmes))
```

### One way to resolve a student's programmes

Mirrored from `get_technique_library` exactly — `students → student_classes →
class_schedules.program_id` — expressed as an `EXISTS` correlated on the student, in both
curriculum functions:

```
EXISTS (SELECT 1 FROM public.student_classes sc
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE sc.student_id = <the student> AND cs.program_id = ci.program_id)
```

Keeping the two consistent: I add a header comment in each function naming
`get_technique_library` as the reference implementation and stating that the join path is
`student_classes → class_schedules.program_id` and nothing else, plus the same note on
`curriculum_items.program_id` via `COMMENT ON COLUMN`. Belt systems are no longer consulted
for programme anywhere in curriculum; `belt_systems.program_id` keeps its Round 14 AY job
(the mismatch flag) and is not touched.

- **Student with no class enrolments:** the `EXISTS` is false for every programme, so they
  see only `program_id IS NULL` items. No crash, nothing from another instructor.
- **Student in two programmes** (children's karate + Kid's Jiu Jitsu): the `EXISTS` matches
  both, so they see both programmes' items plus shared ones.
- Programme membership does not consider `students.active` (the caller is that student's
  parent and the row is already scoped); `get_technique_library`'s `s.active = true` filter is
  about "any of my children", a different question.

## Section B — `get_technique_library` untouched. No edits, no re-grant, no DROP.

## Section C — Backfill

Six tier-wide items → **Karate** (children's karate instructor's material):
`048baaee…` Welcome!, `f6729593…` How to Tie Your Belt!, `b9623b9c…` Attention Stance &
Bowing, `557a1ac0…` Fighting Stance, `4d05fab8…` Voice Commands, `13f8454d…` Punches from a
Fighting Stance.

Seventh row — `ae04d5c1-3af8-4743-966c-5e0069573597` "test for jiu jitsu". It is jiu jitsu
material, so I plan to set it to **Jiu Jitsu & Wrestling**, not Karate. Tell me if you want
it set to Karate anyway or deleted as a leftover test row; I will do exactly what you say.
Either way seven rows change and I will report the count.

Audience direction: all seven narrow or stay level. Nothing becomes visible to more students
than before — NULL-programme is the widest state and no row moves *to* NULL.

## Section D — Admin form and editing

- A **Programme** selector appears in both modes (rank and tier), starting empty, offering
  "Every programme" plus each row in `programs`. No default — an unmade choice blocks save.
- Live plain-English audience sentence under the fieldset, updating on every change:
  - "Every student at Yellow and above in the Solid Belt system, in the Karate programme,
    will see this."
  - "Every Beginner student in the Tai Chi programme will see this."
  - "…in every programme will see this." for shared material.
- The same selector and sentence appear in the **edit** row for an existing item, saving
  `program_id` alongside the existing rank/tier control.
- The item list shows the programme (or "Every programme") on every row.
- Wording avoids "tier" and "programme boundary" jargon in the parent-facing explanation
  text; it names the actual classes/levels instead.

## Section E — Proof

Over HTTPS against the published host with a real non-admin parent session, calling
`get_curriculum_for_student` and `get_curriculum_for_all_children`. Clearly labelled
`[R17 TEST]` items and temporary students/enrolments, deleted afterwards; no existing record
touched. I will paste actual returned rows for all six assertions, including the
both-programmes child and the "every programme" control item. If any assertion cannot be
demonstrated I will report the round incomplete.

## Section F — Invariants

- `CREATE OR REPLACE` only, no DROP, returned columns unchanged; grant audit run as the final
  statement and rows pasted regardless.
- Dashboard belt display and `division_of`/`get_leaderboard` untouched — I will confirm a
  Teen Karate student's rank chip and division are unchanged before/after.
- ORDERING CONTRACT comment and ORDER BY preserved verbatim; verified by checking
  `group_label` runs are contiguous per student in the Section E output.
- `is_current` stays the same plain boolean CASE.
- New append-only migration file.

## What this now excludes

Curriculum material no longer crosses programmes unless someone explicitly marks it "every
programme": teen/adult karate and tai chi students stop receiving the children's karate
instructor's items even though they share the Solid Belt system, and a student with no class
enrolment gets shared material only instead of everything.
