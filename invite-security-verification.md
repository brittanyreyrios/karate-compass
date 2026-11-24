# Invite-code security verification

## Applied change
- Platform migration tool applied `drizzle/migrations/0023_revoke_check_invite_code.sql` and registered its journal/snapshot.
- `REVOKE EXECUTE ON FUNCTION public.check_invite_code(text) FROM anon, authenticated, PUBLIC;`
- No changes under the frozen `supabase/migrations/` folder.
- Removed the sole application caller in `src/routes/auth.tsx`, its debounce, validity badges/messages, and validity-based submission gates. Existing form layout, fields, consent, password checks, invite/claim requirement and generic signup refusal remain.
- Remaining source reference is the generated function type, not a caller. Live database function-body search found no callers.
- Live `handle_new_user` is owned by postgres, uses SECURITY DEFINER, directly locks/validates `invite_codes`, and does not invoke `check_invite_code`. No signup-trigger changes.

## Tests and cleanup
1. Signed-out lookup with ZZTEST54 denied: database error code `42501`.
2. Confirmed dedicated negative-parent fixture lookup denied: `42501`.
3. Wrong fixture code (`ZZTEST54-WRONG`) refused through the actual signup screen with the unchanged generic message:
   “We couldn't create your account just now. Please try again, or contact the front desk if it keeps happening.”
   No account created and no invite use consumed.
4. Actual signup with ZZTEST54 succeeded after revocation, created the profile, incremented use exactly once, and showed Check your email. Email confirmation remained required; no confirmation bypass or auth-schema write.

Temporary email: `zz.test.invitecheck@example.com`, matching the tracking exclusion prefix. Neither a real family account nor a real invite code was used. Browser requests showed no invite lookup during form entry; no browser runtime errors. Desktop and 390px mobile screenshots reviewed.

The first wrong-code test failed because its browser selector expected an incorrect generic sentence, not because signup accepted the code. Cleanup still ran: the subsequently successful test account was removed and ZZTEST54 disabled. Corrected the test selector and reran all three access/refusal cases successfully, without repeating successful signup or consuming another use. The successful-signup case had already passed. The two existing student-claim unit tests also passed. Opt-in live tests and their browser driver are retained in `src/lib/`.

Both cleanup jobs run independently in `afterAll` via Promise.allSettled, even when a test fails. Account removal uses Auth Admin deletion first, then explicit profile/role cleanup. Final read-back:
- Temporary auth accounts: **0**; temporary profiles: **0**.
- ZZTEST54: **active=false**, **used_count=9**, **max_uses=20**, **expires_at=null**; before testing **8/20**, inactive.
- Student total **172 before and after**; these tests never write students or attendance. The historical 138 count is not today's live total.
- Invite inventory inspected with only masked non-fixture codes, including active, used_count, max_uses and expires_at; no unused code printed in full.

## Final privilege read-back
`proacl = {postgres=X/postgres,service_role=X/postgres}`
- anon EXECUTE: **false**.
- authenticated EXECUTE: **false**.
- PUBLIC EXECUTE: **absent** (no PUBLIC ACL entry).
- service_role EXECUTE: **true**, unchanged.

## Quick scan, build and dependencies
- Final quick scan completed 2026-11-24 03:13 UTC: **0 new findings, 1 existing warning** about broad app_settings reads. Same finding as the pre-change baseline; nothing dismissed or marked fixed.
- This was a quick fix recheck, not a new deep scan; older deep-scan image-link-expiry/role-lookup items remain outside this change.
- Latest automatic build: **build OK**. Browser signup and refusal verified end-to-end.
- `git diff -- package.json bun.lock`: **empty — no dependency changes**.
- Tracked-file scan: **0 private credential matches**; no credentials added to committed files. Production-bundle credential scan not performed; builds are platform-managed.
- Root AGENTS.md already exceeds its size budget; no new architecture note added.

The database revocation is already active; publish the signup-screen code change to update the live app. Until publishing, its old pre-check may receive a denied lookup and revert to idle, while signup continues validating directly through the unchanged trigger.