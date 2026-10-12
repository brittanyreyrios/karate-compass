# Round 69 — Black belt degrees, Black Belt Journey bar, personal test date

Starting commit: `4e4fcde6b32c818bab6ed866de799a99c19d8ae0`

## A. Degree ranks (one migration in drizzle/migrations/)

Six rows in the Solid system, sort_order 9–14, names/short names exactly as the brief, curriculum_tier 'advanced', active true. Existing "Black" row (sort 8, solid, #0a0a0a) untouched. No student's belt_rank_id changes.

Chip proposal — no new pattern value, no constraint change:
- `pattern = 'stripe'`, `color_primary = '#0a0a0a'`, `color_accent = '#d4af37'` (gold).
- Today a stripe renders as one long line down the belt. For black-primary stripe ranks, BeltSwatch instead draws N short vertical gold bars across the right band end (1 to 6), where N = the leading digit of `short_name` ("1st Degree" -> 1). The pattern word in the accessible label becomes "black belt with N gold degree bars".
- Plain Black keeps its solid chip (no bars), so Black and 1st Degree stay distinguishable.
- Before the migration runs I will render all seven chips (Black, 1st–6th) at sm and md sizes on the dark card and show the screenshot; rows are only inserted after you approve the look.

Rank-label tint (beltLabelColor): accent differs from primary, so labels take a readable gold tint — reported with the read-back.

Per-component check, to report with real output after the migration:
- ranksOfSystem / computeBeltProgress: new rows extend the Solid ladder to 14 — handled by Part B.
- get_curriculum_for_student / _for_all_children: "sort_order <= my rank" — a degree holder (9–14) still includes all of 1–8; there is no curriculum on 9–14, so nothing new appears. Verified by query on a test child, functions unchanged.
- get_leaderboard rank_name: returns the full name ("6th Degree Black Belt"); ranking/division logic untouched.
- Admin belt dropdown (BeltPicker): lists the six new rows in order after Black.
- Belt chips everywhere: via BeltSwatch, so bars show on every screen.

## B. Progress bar after Black (dashboard only, app code)

- `computeBeltProgress` for the Solid system: if the student's rank sort_order >= Black's, return a "Black Belt Journey" ladder = Black + 1st..5th (6th excluded). Black = 0%, 5th = 100%. Colour-belt ladder unchanged and not shown alongside.
- At 6th: label "6th Degree Black Belt", bar at 100% (5th as the last step) and the line "Master level — beyond the student journey". 6th never appears as a step.
- "Black" is identified as the highest Solid rank whose name is exactly "Black" (the existing row); degrees are Solid ranks above it. Other systems untouched.

## C. Personal test date

- Migration adds nullable `students.personal_test_date date`. `students.next_test_date` stays unread.
- Dashboard: student at Black or any degree -> next-test card uses `personal_test_date` (same date-only.ts helpers). Empty -> "Your instructor will let you know when you're ready for your next degree test." with no date or countdown. Colour-belt path (Round 54) unchanged.
- Edit student: "Personal test date (black belts only)" date field, shown only when the selected rank is Black or a degree; saved with the student. Existing policies already let staff update students; no RLS/grant change.

## D. Kid's Jiu Jitsu — confirm only

Check a Jiu Jitsu test child's dashboard and report what the next-test area shows; change only if a card/placeholder appears.

## Testing and cleanup

zz.test.negative with temporary children "ZZTEMP R69" (Green; Black in Intermediate / Advanced Children; 1st Degree with a personal date; 6th Degree). Screenshots at 390 and 1536, scrollWidth check on the progress card, proof 10 Nov is gone. Student-per-rank counts before and after; temp children deleted. Report includes git diff --stat with package.json/bun.lock.

## Questions
1. Approve the "stripe + gold bars from short_name digit" approach, or prefer a nullable `belt_ranks.degree` number column instead of reading the digit (one extra column, beyond what the brief named)?
2. Black Belt Journey ends at 5th: a 4th Degree holder shows 4 of 5 steps toward 5th — correct?
