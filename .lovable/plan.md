# Convert audited imports to unclaimed students

## Scope and approval
Add conversion actions to the existing **Unlinked Students Audit** only. Keep **Retry link**, **Remove**, email editing, signup gates, confirmation, claim-code behavior, attendance, points, and family privacy intact. No app or database changes until this plan is approved; approval does not run Convert all on real imports.

Read-only checks found **49 pending imports**, **138 students**, **138 guardian links**, and **ZZTEST54 inactive at 7/20**. Capture fresh full-row fingerprints before implementation tests; today's fingerprints are recorded below.

## Staff actions and results
- Each row gets **Convert to unclaimed student**.
- Add **Convert all** with a confirmation showing the number of currently displayed pending rows. Submit those exact row IDs, not a moving list that could include newly imported rows.
- Disable overlapping conversion/retry/remove actions while conversion or email saving is in progress, so the stored email is the one converted.
- Show a result summary: **Converted**, **In no class**, **Skipped — likely duplicate**, and **Failed**. List affected children and reasons staff can act on. Duplicates and failed rows remain in the audit; successful rows disappear.
- Refresh Manage Students, Master Attendance, enrollments, no-class listings, and the audit. Converted students immediately use the existing unclaimed badge, generated claim code, and no-photo handling.

## Conversion rules
Each row is one all-or-nothing database operation:
1. Verify the caller is an admin and lock the pending row; serialize conversions so repeated clicks/bulk requests cannot create two students.
2. Match trimmed, case-insensitive `class_name` against `class_schedules.class_name` (the application's classes table). Do not fuzzy-match or guess. If more than one class matches, treat it as unresolved and report it rather than pick one.
3. Skip likely duplicates with the same trimmed, case-insensitive first and last names and class, across claimed/unclaimed and active/inactive students. Check actual enrollments, with existing `students.class_name` as a legacy fallback. For unresolved class names, also check retained source-class labels for previously converted children; do not treat every unrelated no-class child as a duplicate.
4. Insert `students` with `parent_id = NULL`, `created_by_staff = true`, and the source first name, last name, `belt_rank_id`, `current_belt`, and `start_date`. Preserve null rank instead of guessing another belt system. If start date is missing, use the existing student date default. Existing belt synchronization and claim-code triggers remain authoritative.
5. With a unique class match, create a primary `student_classes` enrollment. With no match, create no enrollment and store the existing `Unassigned` display value; the existing enrollment editor shows **In no class**. Include the original class text in the result.
6. Save the private future-parent email reference described below.
7. Delete the source pending import only after all required steps succeed. Any failure rolls back this row's student, enrollment, email reference, and deletion. Bulk conversion isolates each row, retaining successful conversions when a different row fails.

Photo permission remains **OFF while unclaimed**, using the existing staff-created/null-parent rule; no family consent is changed. Once linked, the family's existing consent rules apply.

## Proposed private email storage
Create a separate `public.unclaimed_student_parent_links` table, not an email field on `students` or `profiles`:
- `student_id`: primary key, references `public.students`, cascading on student deletion.
- `parent_email`: trimmed/lowercase source email.
- `source_class_name`: original class text for audit/duplicate handling when no class matches.
- `created_at`: creation timestamp.

Explicit grants and RLS allow **only admins** to read/manage these references; anonymous callers have no access and ordinary parents cannot read them. The signup trigger accesses them privately. No parent query, view, result, or log exposes the email. Add a normalized-email index. Remove the reference when the student is assigned to any family, including a claim-code claim or staff reassignment, so an old email can never move an already claimed child.

## How confirmed-sign-in auto-linking works
Leave `handle_new_user` unchanged: its existing invite-or-claim gate, profile/parent-role creation, parked-import linking, pending claim intent, and secondary-guardian handling remain intact. Converted rows are no longer parked imports, so signup must not assign these children.

Extend the existing deferred first-sign-in processing with a private email-link RPC:
1. Require an authenticated caller and derive the email and confirmation state from the trusted auth account, never from client input or editable profile metadata. Reject unconfirmed callers.
2. Match private references by the confirmed account's trimmed/lowercase email and lock the referenced students.
3. Link **only students still having `parent_id IS NULL`** to the confirmed caller; never replace an existing parent or guardian.
4. Set `claimed_at`. Existing student triggers clear the claim code and create the primary guardian link.
5. Remove consumed references. Keep the same student ID, enrollment, start date, belt, attendance events/count, points/events, and staff provenance—do not create a second student.

An unconfirmed signup with a matching email leaves the child unclaimed and the private reference in place. The link happens only after confirmation and successful sign-in, through the same deferred orchestration used for pending claims. A matching email does **not** become a third signup credential; the parent still needs the existing invite or claim code.

Use a shared normalized-email transaction lock in conversion and deferred linking, plus student locks, to avoid races. If the account predates conversion, keep the child unclaimed; a confirmed account can link on its next sign-in, while an unconfirmed account cannot. On linking errors preserve the reference for retry, return a generic family-facing failure, and log no email or claim code.

## Technical implementation
- Add the private reference table, grants/RLS/indexes, admin-only conversion RPC, reference cleanup trigger, and confirmed-email deferred-link RPC in one additive platform migration in authoritative `drizzle/migrations/`. Leave frozen migration history and `handle_new_user` untouched.
- Conversion RPC uses an explicit `has_role(auth.uid(), 'admin')` check, a fixed search path, authenticated execute grant, no anonymous execute, and per-row exception isolation. Database logic owns atomicity and duplicate checks; no client-side insert/delete chain.
- Keep UI/result handling in a focused audit-conversion module using existing dialogs/buttons and query invalidation patterns. Do not rewrite other staff screens.
- Record transaction/private-storage boundaries in `AGENTS.md` during implementation. Add focused rule tests and opt-in fixture-only integration coverage next to existing tests.
- Expected `package.json` and `bun.lock` changes: **none**.

## Fixture-only verification, cleanup, and scans
- Fresh baseline: capture the exact IDs/full-row fingerprints for all 138 original students and 138 guardian links, their enrollments, and all existing pending imports. No real pending row is converted, retried, removed, or edited during testing.
- Use the dedicated staff fixture for every admin check; it never gets a student. Do not modify the permanent zero-point child.
- Proposed temporary signup alias: **brittanyreyrios+zzauditconvert@gmail.com**. Approval permits this isolated fixture; first verify it is unused. Use only ZZTEST54 for signup, temporarily enable it, report usage before/after, and disable it immediately. Britt confirms the new account in Cloud → Users; never weaken confirmation or write auth records directly.
- Through the actual audit, convert a temporary Tiny Tigers pending row, verify source values/private reference/claim code/no-photo state, and check the resulting child in through **Master Attendance**.
- Sign up the fixture parent with that matching email and a normal invite; before confirmation, verify the child remains unclaimed and the private reference remains. After Britt confirms the email, sign in and verify the same child appears with the same attendance count/events, enrollment, and student ID. Verify the private reference is consumed and parents cannot read that storage.
- Test one no-match conversion and **In no class** result, likely-duplicate skips (including repeated/bulk conversion), bulk count confirmation/mixed results, rollback on enrollment failure, and refusal of non-admin conversion. Check signup-by-claim and staff reassignment remove stale email references without changing those flows.
- Remove all temporary pending rows, students and dependent records, references, and accounts using the existing approved deletion workflow. Report anything waiting on owner confirmation rather than claiming completion.
- Compare the original 138 students/138 links and original pending imports/enrollments against the baseline after cleanup. Today's student fingerprint: `7eb1858d85b6e50fcdea68ec28faec1f`; guardian fingerprint: `50deda8c30f12d81364d0229aa70d488`.
- Run focused tests, browser checks on phone/desktop, and quick/deep security scans; report new versus existing findings, explicit `package.json`/`bun.lock` diffs, cleanup, and invite status. Inspect tracked source and served output for private credentials without exposing them.
