# Session-loss handling (app-wide) + required family name

## Part 0 — Empirical checks before any code

Run these and report real output, not doc claims:

1. **Auth event on token death vs sign-out.** In a Playwright session on a mounted
   authenticated page, log every `onAuthStateChange` event. Then (a) corrupt the stored
   refresh token in the session and force a refresh, and (b) revoke the session
   server-side, and (c) call `signOut()`. Report the exact event names/sequence seen for
   each case.
2. **Error shape of a query with a dead JWT.** With an expired/invalid access token, run a
   normal table read and print the full error object (`code`, `message`, `details`,
   `hint`, HTTP status). Compare with a genuine network failure (offline) so the fix can
   tell them apart.

The observed values drive the exact predicate used below. No code lands until these are in.

## Part 1 — App-wide session-loss handling

Shared wiring only — nothing per page.

- **`src/lib/session-loss.ts` (new).** `looksLikeSessionLoss(error)` matching the
  empirically observed shapes (expected: PostgREST `PGRST301` / JWT-expired message /
  HTTP 401), explicitly excluding `TypeError: Failed to fetch`-class network errors, and
  `confirmSessionLost()` which calls `supabase.auth.getUser()` and returns true only when
  the server says there is no valid user. A single in-flight guard so a burst of failed
  queries triggers one check and one redirect.
- **`src/router.tsx`.** Add a `QueryCache`/`MutationCache` `onError` to the `QueryClient`
  so every authenticated query and mutation on every page funnels into the handler. This is
  the app-wide seam; individual pages keep their existing `QueryErrorState` UI for real
  network problems.
- **Redirect path.** On confirmed loss: cancel + clear the query cache, `signOut()` locally,
  then navigate to `/auth?expired=1` with history replace. Transient failures fall through
  untouched.
- **`src/routes/auth.tsx`.** Accept `expired` in the existing `validateSearch` schema and
  show "Your session expired — please sign in again." (inline notice on the card, plus the
  toast style already used there).
- **`_authenticated/route.tsx` untouched** — the cold-navigation `beforeLoad` gate stays
  exactly as is.

### The `SIGNED_OUT` invalidate question

`__root.tsx:112` currently skips `queryClient.invalidateQueries()` on `SIGNED_OUT`. That is
**intentional and correct**, and it is not the cause of this bug: invalidating on sign-out
refetches every mounted protected query against a cleared session, producing a 401 storm
and error flashes on the way out. The bug is the *absence* of a failure path, not this
line. Plan: leave it as is, and add cache *teardown* (`cancelQueries` + `clear`) in the
session-loss handler instead of a refetch.

## Part 2 — Family name required (`src/routes/auth.tsx` only)

- Add `required` to the Family name input (and keep its label/placeholder as-is).
- Add a guard next to the existing invite/consent/password guards:
  blank trimmed name → `toast.error("Please enter your family name.")`, no submit.
- Delete the `|| email.split("@")[0]` fallback; send `familyName.trim()`.
- No min length, no allow-list, no capitalisation. Whitespace trim only.
- Nothing else in the signup flow changes.

## Verification to report

- `git diff --stat` (no `supabase/migrations/`, no RLS/grant/DB-function change anywhere).
- Real console output for the auth event and the error shape.
- Reproduction with a genuinely invalidated test session: before/after on two originally
  reported pages plus one page not in the report (e.g. Leaderboard).
- Simulated offline failure showing no redirect.
- `grep` proving `email.split("@")` is gone from `auth.tsx`; blank-name signup blocked;
  "Torres-Hillail" stored byte-exact; test account deleted and confirmed gone.
