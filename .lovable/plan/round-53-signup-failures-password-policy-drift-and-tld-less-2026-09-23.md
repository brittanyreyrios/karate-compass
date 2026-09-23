# Round 53 — signup failures: password policy drift and TLD-less email

## What I found (before writing any code)

I probed the live auth service directly with three throwaway passwords. The service
returns its full policy in the rejection message:

```
"aaaaaaaa" -> reasons: ["characters","pwned"]
"aaa"      -> reasons: ["length","characters","pwned"]
"Aa1aaaaa" -> reasons: ["characters","pwned"]
msg: Password should be at least 8 characters. Password should contain at least one
character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789,
!@#$%^&*()_+-=[]{};'\:"|<>?,./`~. Password is known to be weak and easy to guess.
```

So:

- **Minimum length: 8** — our rule already matches.
- **Symbol set: `!@#$%^&*()_+-=[]{};'\:"|<>?,./`~`** — byte-identical to
  `SPECIAL_CHARACTERS` in `src/lib/password-rules.tsx`. Backtick and tilde **are**
  accepted. Your suspicion was reasonable but the evidence clears it.
- **The actual culprit: leaked-password protection (HIBP) is ON.** Every probe came back
  with a `pwned` reason. That is a check no client-side checklist can ever perform, which
  is exactly why the parent saw all-green then a server refusal, and why a different
  password worked instantly.

Consequence for item 1: there is **nothing to correct** in `SPECIAL_CHARACTERS` or the
length rule — they already match the server exactly. I will not invent a change to look
busy. The checklist can never turn green on a character/length rule the server refuses;
the only remaining gap is the breach check, which is unknowable in the browser and must
be handled by the error path. I will add a line to the checklist block stating the
password is also checked against known breached passwords, so the all-green state is
honest about what it does and does not prove.

## What I will change

1. **`src/lib/password-rules.tsx`** — add an exported `SERVER_POLICY` note and a small
   non-rule footnote under the checklist: "Also checked against known leaked passwords
   when you submit." No rule is added, removed, loosened or tightened. The existing five
   rules and `SPECIAL_CHARACTERS` string stay byte-identical.

2. **`src/routes/auth.tsx` — `authErrorMessage`** (the durable fix). Add a
   password-policy branch ahead of the generic fallback that reads the structured
   `reasons` array off the error when present (`AuthWeakPasswordError.reasons`) and falls
   back to matching the message text. Maps to parent-friendly sentences:
   - `pwned` → "That password has appeared in a known data breach, so it can't be used
     here. Please choose a different one — something unique to this account."
   - `length` → "That password is too short. Please use at least 8 characters."
   - `characters` → "That password is missing a required character type. Please include an
     uppercase letter, a lowercase letter, a number and a symbol."
   - unknown/multiple → the matching sentences joined, or a single
     "That password doesn't meet our security requirements" line.
   No raw GoTrue string is ever shown; the real error still goes to `console.error`.
   This runs for sign-up, sign-in, reset and the new-password page path that shares it.

3. **Email domain guard.** New `isEmailWithTld()` helper in `src/lib/password-rules.tsx`'s
   sibling — I will put it in a new `src/lib/email-check.ts` so it is not mixed into
   password concerns. Requires a single `@`, a dot in the domain, and a 2+ letter TLD.
   Wired as a guard in:
   - `signUp` — alongside the existing invite/consent/family-name/password guards, placed
     after the invite checks so invite feedback keeps priority;
   - `signIn` — same check before calling the API;
   - `forgotPassword` — same check after the existing empty-field check.
   Message: "That email address is missing its domain ending — for example
   name@gmail.com, not name@gmail."

## Untouched

`handle_new_user`, `check_invite_code`, every RLS policy, grant and database function. No
migration. Invite-code flow, consent checkboxes, Media Release acceptance and the Round 51
family-name requirement are unchanged, as are the existing invalid-invite-code and
already-registered messages.

## Verification I will report

`git diff --stat` (no `supabase/migrations/` entry); the probe output above as the policy
evidence; the before/after of `SPECIAL_CHARACTERS` and the length rule (identical, called
out explicitly); a real signup with an all-green-but-breached password on the new build
showing the breach message, and the same attempt showing the old generic one; `test@gmail`
blocked with no network call to the auth service, `test@gmail.com` accepted; one valid
signup completing end to end; the invite-code and already-registered messages still firing
for their own cases; every test account deleted with a zero-remaining query.
