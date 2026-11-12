# Phase 3 — parent claims and claimed-only leaderboards

## Step 0 — diagnosis completed; no application changes
- Staff-fixture sign-in succeeded on localhost and the published custom domain. The password-token request and user validation requests returned HTTP 200; both reached the dashboard without page errors.
- The reproduced failed request was `HEAD /rest/v1/attendance_events`, the dashboard’s yearly attendance count, with `net::ERR_ABORTED`. This occurred on both sites, not only preview. The signed-in dashboard remained usable and displayed attendance.
- Earlier automation also cancelled page downloads by submitting before hydration completed; waiting for the page eliminated those cancellations.
- This does not demonstrate failed login for real families. The attendance cancellation can occur on the published site, but its exact cancellation source and frequency for real users remain unverified. Leave it unchanged unless it blocks Phase 3.

## Scope
Extend the existing signup page and parent dashboard; preserve staff screens, class dates, belt rules, confirmation, password policy, consent, media release, normal invite codes, second guardians, and all existing student data. No dependency changes expected.

## Signup with a claim code
- `/auth?claim=CODE` opens signup and fills “Child’s claim code”. Accept a valid invite code OR a valid unclaimed-child code; reject signup with neither on the server, not just in the form.
- Preserve the existing invite validation, locking, usage counters, and failure behavior for invite-only signup. A valid claim must not spend an invite use.
- Check claim eligibility inside the existing signup trigger without exposing student names or permitting anonymous student reads. Do not claim the child in the account-creation trigger.
- Store a pending claim against the newly created profile in protected application data, so confirmation on another browser/device still works. The trigger creates the account/profile and pending claim atomically.
- After verified sign-in, process the pending claim through the existing `claim_student` function, then clear the pending value after the attempt. Handle confirmation returning directly to `/`, manual login, and already-signed-in signup outcomes. Prevent duplicate processing; do not call network operations inside the auth-state callback itself.
- A failed claim never undoes signup. Show exactly: “We couldn't link your child automatically. Please see the front desk.” Never expose the underlying failure reason.

## Existing parent — Add my child
- Add an “Add my child” option on the dashboard, including the no-children state, with a claim-code field and submitting state.
- Call the existing claim function; on success read the newly guardian-visible student and show “Welcome! [First name] already has X classes logged.” Use their all-time attendance count.
- Refresh the child switcher, curriculum/poll child lists, default division, leaderboard, and Winner’s Circle without resetting attendance or points.
- Every claim failure or request error gets the same generic message. Keep the five-failures-per-hour rule enforced by the database; test six rapid attempts and a valid code blocked afterward.

## Parent-facing student-list inventory
| Surface | Current access and planned handling |
|---|---|
| Leaderboard top 10, every division/current and all-time periods | Add `parent_id IS NOT NULL` inside `get_leaderboard`, before ranking/limit; preserve first name + last initial and points calculation. |
| Default “my division” | Already uses the guardian helper that rejects null parents; add an explicit non-null predicate to `get_my_division`. |
| Dashboard Winner’s Circle | School-wide student names from `get_winners_circle`; add the non-null predicate before ordering/limit. |
| Dashboard child switcher, attendance, points, personal testing dates | Own-family reads protected by guardian policies; add an explicit non-null filter to the child query. |
| Belt Curriculum child lists and curriculum functions | Own-family only, guardian helper already excludes unclaimed; add explicit filtering to the child list and verify function access. |
| Poll child picker | Own-family students protected by guardian policies; add explicit non-null filtering. |
| Poll results | Only aggregated counts, no other-child names. Exclude votes attached to unclaimed students for parent results if present; preserve staff reporting and per-family/per-child counting. |
| Child Tournament Results | Only selected guardian-linked child; existing policy already blocks unclaimed. Verify access remains blocked. |
| Calendar and School News/Tournaments | Event/audience descriptions, no student roster or named belt-test list; no student filter needed. |
| Technique Library, Gallery, Settings | No other-student list. Gallery consent behavior is not changed. |

No parent roster, TV leaderboard, or named school-wide belt-test list exists in the current portal. Staff rosters retain unclaimed students.

## Technical details
- Use an additive migration through the platform tool in authoritative `drizzle/migrations/`; frozen history stays untouched. Add only protected pending-claim storage and required function changes, with explicit grants/RLS and narrow authenticated processing.
- Pending claim codes are private: no anonymous reads, no broad profile-field exposure, no logs containing codes or emails. Server handlers verify the caller; existing claim locking/rate-limit rules remain authoritative.
- Keep signup-trigger parked-student and pending-secondary-guardian linking unchanged. Preserve existing function grants, including restrictions on direct division helpers.
- Record claim orchestration/storage boundaries in `AGENTS.md`. Keep focused tests next to existing tests.

## Fixture-only verification and cleanup
- Baseline is currently 138 students and 138 guardian links. Capture IDs and deterministic row/link fingerprints before testing and compare after cleanup; do not modify real children or existing family accounts.
- Use dedicated staff and existing parent fixtures. Staff fixture never receives a student; permanent zero-point fixture never receives points.
- The supplied email already belongs to an account. For a NEW-parent test, use inbox alias `brittanyreyrios+zzclaimphase3@gmail.com`, not the original account. Approval of this plan approves creating this isolated temporary test account; Britt confirms it in Lovable Cloud when prompted. Never disable confirmation or write auth records directly.
- Create temporary unclaimed children with check-ins and points. Verify claim signup, first-login deferred claim, carry-over, Add my child welcome count, invalid/used codes, six rapid failures, normal invite-only signup, and no-code server refusal.
- Temporarily enable only ZZTEST54 for invite tests; report uses before/after, max 20, and turn it off immediately afterward. Never use real invite codes.
- Verify all boards hide an unclaimed child with points and include the same child after claiming; default division follows the claimed child. Exercise parent flows in the browser, including mobile and desktop.
- Remove temporary children and their dependent rows/fixture attempts; remove temporary accounts only through the existing approved account-deletion workflow. If confirmation or cleanup needs owner action, report the exact remaining item instead of claiming completion.
- Run focused tests, quick and deep security scans after changes; distinguish existing findings from new ones. Report constraints/grants/policies changed, real-data fingerprints, cleanup, and explicit `package.json`/`bun.lock` diffs (“no dependency changes” when empty). Check tracked source and served output for private credentials without printing secrets.

## Approval boundary
No application code, database changes, or signup tests have been performed for Phase 3. Approval starts implementation; email confirmation will require your action during testing.
