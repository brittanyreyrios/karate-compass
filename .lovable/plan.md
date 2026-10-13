# Round 69 — Black belt degrees, Black Belt Journey bar, personal test date

Starting commit: `4e4fcde6b32c818bab6ed866de799a99c19d8ae0`

## A. Degree ranks (one migration in drizzle/migrations/)

Six rows in the Solid system, sort_order 9–14, names/short names exactly as the brief, curriculum_tier 'advanced', active true. Existing "Black" row (sort 8, solid, #0a0a0a) untouched. No student's belt_rank_id changes.

Chip proposal — no new pattern value, no constraint change:
- `pattern = 'stripe'`, `color_primary = '#0a0a0a'`, `color_accent = '#d4af37'` (gold).
- Add nullable `belt_ranks.degree smallint CHECK (degree BETWEEN 1 AND 6)`; six new rows have degree 1–6, existing Black stays NULL. Never parse short_name. Degree-aware features use degree IS NOT NULL plus the Solid-system Black row.
- Final direction: no numbers on belts at any size; BeltSwatch draws N thin gold bars across a hanging belt end at every size, perpendicular to its length with small even gaps just inside the tip. Compact badges retain a readable adjacent rank label.
- Plain Black keeps its solid chip (no bars), so Black and 1st Degree stay distinguishable.
- Before the migration runs render all seven chips (Black, 1st–6th) at sm and md plus a small chip in a leaderboard-row preview on the dark background; rows are only inserted after visual approval.

Rank-label tint (beltLabelColor): accent differs from primary, so labels take a readable gold tint — reported with the read-back.

Per-component check, to report with real output after the migration:
- ranksOfSystem / computeBeltProgress: new rows extend the Solid ladder to 14 — handled by Part B.
- get_curriculum_for_student / _for_all_children: "sort_order <= my rank" — a degree holder (9–14) still includes all of 1–8; there is no curriculum on 9–14, so nothing new appears. Verified by query on a test child, functions unchanged.
- get_leaderboard rank_name: returns the full name ("6th Degree Black Belt"); ranking/division logic untouched.
- Admin belt dropdown (BeltPicker): lists the six new rows in order after Black.
- Report the admin curriculum editor rank groups for all six new ranks: empty is fine, errors or broken ordering are not.
- Belt chips everywhere: via BeltSwatch, so bars show on every screen.

## B. Progress bar after Black (dashboard only, app code)

- Identify Black-path by explicit degree IS NOT NULL plus Solid Black; Journey ladder = Black + 1st..5th (6th excluded). Black = 0%, 5th = 100%. Colour-belt ladder remains eight steps and is shown alongside on Black-path too.
- Journey uses larger labelled belts, two rows of three at 390; colour strip labels show at all widths, two rows of four at 390 without shrinking or horizontal scrolling.
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
All answered. Build browser-only previews: all seven chips at ladder/sm/md/lg; labelled sixth-degree leaderboard row; Black/2nd/5th/6th Journey at 390 and 1536; colour strip at Green and Black-path at 390. Include unlabelled-badge report, then STOP for approval before any database writes.
