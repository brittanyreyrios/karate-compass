# Round 61 — parent email on the student row, and linking a child from the account

Front-end only, one file: `src/routes/_authenticated/admin.tsx` (plus a `roadmap.md` entry). Nothing under `supabase/migrations/`, no access rule, permission or database function change.

## A — Parent email on the student row (Manage Students)

- Look up each student's `parent_id` against the profiles list the page already loads; no new query for this.
- Show the email on the row itself, under the name/class line, as plain selectable text (`select-text`, `break-all` so long addresses wrap instead of causing sideways scroll). If no profile matches, show "No linked account".
- Round 58 (multiple guardians) has not landed — there is no guardians table in the app — so one email per student.
- Check 390 / 768 / 1024 / 1025 and record `document.body.scrollWidth` vs viewport at each.

## B — "Link a student" from a family with no students (Families tab)

- On a family card where the child count is 0, add a "Link a student" button. Filter logic of "No students only" untouched.
- Opens a search box: type a student name, results show name, current family name (and their email), and class — enough to tell two same-named children apart. Search runs over students already loaded on the page.
- Picking a result opens a confirmation dialog: "Move {child} from the {current} family to the {target} family? They keep their belt, Dojo Points and attendance." Requires an explicit Confirm.
- Confirm calls the existing `admin_reassign_student(_student_id, _new_parent_email = target account email)` — the same call the student-record panel makes. No second path.
- Success: "{student_name} moved to the {new_family_name} family." from the function's own result; same cache refreshes as the existing panel.
- Refusal: the function's own message shown as-is.
- Not changed: `admin_reassign_student`, the existing "Move to another parent" panel, any email, accounts, parked students, Round 54/54b/58 work.

## Testing

- Child: the ZZTEST Fixture-DoNotEnroll student on zz.test.negative@example.com. Read `students.parent_id`, belt, points and attendance count from the database before and after each move.
- Move it to a second test account from the Families side, then back to zz.test.negative@example.com.
- **Second test account:** none exists yet. Proposal: create one permanent confirmed account `zz.test.secondary@example.com`, switching ZZTEST54 on only for that sign-up and off again (uses 1 of its 20 uses), and save its password to project knowledge next to the first one. Alternative: use Britt's own test account brittanyrey1214@gmail.com (zero students) as the temporary target — only with your say-so.
- Refusal path: this flow only targets existing accounts, so a missing account can't be chosen in the UI. I'll exercise it by calling the same function with a non-existent email from the admin session and show the message staff would see in the same toast.
- Confirm no real family's student moved: compare every student's `parent_id` before and after the run.
- Also: the saved password for zz.test.negative@example.com was rejected last round. I'd reset it to a new one and update project knowledge, unless you say otherwise.

## Questions before building

1. Second test account: create `zz.test.secondary@example.com` (burns one ZZTEST54 use), or use brittanyrey1214@gmail.com temporarily?
2. OK to reset and re-save the zz.test.negative@example.com password?
