# Round 54b — "Email not confirmed" shown plainly, with a resend button

## What I observed (real output, throwaway account `zz.test.r54b.unconfirmed@example.com`)

```
signUp:  {"user":"94bcb529-...","session":false,"error":null}
signIn error: {"name":"AuthApiError","code":"email_not_confirmed","status":400,"message":"Email not confirmed"}
resend (immediately after signup):
  {"error":{"name":"AuthApiError","status":429,"code":"over_email_send_rate_limit",
   "message":"For security purposes, you can only request this after 58 seconds."}}
resend (62s later): {"data":{"user":null,"session":null},"error":null}
```

- The code is confirmed as `email_not_confirmed`, status 400.
- Resend works for an existing, unconfirmed account. It is limited to one email every
  60 seconds per address. That 429 already maps to the existing "Too many attempts just
  now" message, and I will leave that as is.
- Side effect: the test sign-up used one use of real invite code `9HLG5W95`. I will put
  its `used_count` back when I clean up, and say so in the report.

## Changes

1. **`src/lib/auth-errors.ts`**: add `isEmailNotConfirmed(error)`. It checks
   `code === "email_not_confirmed"` first, then falls back to `/email not confirmed/i` on
   the message. Add a branch in `authErrorMessage` after the rate-limit branch that
   returns: "Your email address hasn't been confirmed yet. Check your inbox — including
   spam and Promotions — for a confirmation link from Tiger's Den. You can also resend it
   below." `console.error` stays. The weak-password and malformed-email branches do not
   change.
2. **`src/routes/auth.tsx`**:
   - `signIn`: the "Invalid login credentials" check stays exactly as it is. If the error
     matches `isEmailNotConfirmed`, set new state `unconfirmedEmail = email.trim()`, which
     makes the button appear.
   - `resendConfirmation` becomes `resendConfirmation(target = awaitingConfirm)`. It is the
     same function and the same `supabase.auth.resend({ type: "signup" })` call, now taking
     the address as an input. The "Check your email" screen still calls it with no argument,
     so its behaviour does not change.
   - On the sign-in tab, a "Resend confirmation email" button appears under the form only
     while `unconfirmedEmail` is set. It sends to the email in the sign-in field at the
     moment of the click, not an older value. Editing the email field clears the button.
     After a successful send it shows "Confirmation email sent to {email}."

## Not changing

Email confirmation stays on, and nobody is auto-confirmed. No migration, RLS, grant or
database function change. The "Invalid login credentials" wording, the Round 53
weak-password branch, and the invite, consent and family-name guards all stay as they are.

## Verification to report

- `git diff --stat`, with nothing under `supabase/migrations/`.
- Playwright on /auth with the unconfirmed test account: the old message (the same error
  run through the previous function) next to the new message, with the button visible.
- Click resend and capture the network request body, proving it used the typed email.
  Before clicking, I will type a second address and then change it back, to show the
  button follows the field and not an older value.
- A confirmed account with a wrong password still gets "That email and password don't
  match an account".
- Cleanup: delete the test account and restore the invite code's `used_count`. Zero test
  accounts will remain.
