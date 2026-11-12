# Phase 3 final verification

Verified 2026-11-12 after owner confirmation of the isolated new-parent account.

## First-login claim

- Used the actual email/password sign-in form at `http://localhost:8080/auth`, in a fresh browser context.
- First sign-in reached the dashboard and automatically linked the pending temporary child; no manual claim RPC was used to perform the initial claim.
- Dashboard displayed the child, 3 classes of attendance, and 5 all-time points. Authenticated readback confirmed the correct parent and a cleared claim code.
- Reload retained the linked child. Pending intent count was zero; a subsequent finish-pending RPC returned `{ "attempted": false }`, proving the intent was consumed once.
- No browser page errors were observed. This follow-up exercised the current local preview, not the published version.

## Uniform refused signup

- Submitted bad and already-used claim codes through the actual signup form with an isolated refused-signup alias; both displayed exactly:

  > We couldn't create your account just now. Please try again, or contact the front desk if it keeps happening.

- Neither showed a confirmation screen or created an account.
- Compared actual signup HTTP responses for bad, used, and missing codes. All three returned HTTP 500, `unexpected_failure`, and `Database error saving new user`; the app does not expose this internal error to families.
- Client-side password, consent, and invite protections were not changed. No signup rate-limit setting was changed or verified; supported hosted-settings reads remain unavailable.

## Cleanup and unchanged baseline

- Explicitly set ZZTEST54 inactive. Before and after: inactive, 7 uses, maximum 20; no invite was consumed in this follow-up.
- Deleted only the remaining isolated temporary child, then archived/deleted the isolated temporary parent through the existing staff-authorized, auth-first account workflow.
- Database readback: zero temporary child records, zero temporary auth accounts/profiles/roles, zero pending claim intents, and zero remaining attendance/point rows for the deleted child. The earlier invite-only temporary account is also absent; the refused-signup alias has no auth account.
- Full-row deterministic comparison uses `md5(string_agg(to_jsonb(row)::text, '' ORDER BY id))`:

| Data | Count | Baseline and final fingerprint |
| --- | ---: | --- |
| Students | 138 | `524f7f5c7900b7a958a3c9ee636f2563` |
| Guardian links | 138 | `24e4797b1068bc1a50fbe79b3d73a1c3` |

Both match the saved baseline exactly, including the permanent test fixture; no real student or family link changed.

## Security and dependencies

- Reviewed the completed Phase 3 deep scan: zero app-code findings; the same 10 previously reported database findings remain. Scan results are marked not up to date by the tool; no application code or database rules changed in this cleanup follow-up.
- `package.json` diff: empty. `bun.lock` diff: empty. **No dependency changes.**
- This follow-up changed only completion records; browser scripts, credentials, and screenshots remain outside the repository under `/tmp/browser/p3/`.