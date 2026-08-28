# Live password requirements checklist

## Shared helper — `src/lib/password-rules.ts` (new, only new file)

- `PASSWORD_RULES`: five rules, each `{ id, label, test(pw) }`
  - At least 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (anything that is not a letter or digit)
- `checkPassword(pw)` → `{ results: {rule, ok}[], allPassed: boolean }`
- `PasswordChecklist` component (same file, so the rules and their rendering can't drift): renders a `<ul aria-live="polite">` with one `<li>` per rule, each showing a `Check` icon + "Met" state or a `Circle`/`X` icon + "Not met" state via `sr-only` text, so it is never colour-only. Uses existing theme tokens (`text-muted-foreground`, `text-emerald-400`, `text-primary`) — matches the invite-code check styling already on the auth page.

## `src/routes/auth.tsx` — sign-UP form only

- Import the helper; derive `pwCheck = checkPassword(password)`.
- Replace the "At least 8 characters." hint under `pw-up` with `<PasswordChecklist>`, and add `aria-describedby="pw-up-rules"` to the input.
- Sign-up submit button: `disabled={loading || !pwCheck.allPassed}` (keeps the existing `bg-gradient-red` / loading label styling).
- Replace the `password.length < 8` guard in `signUp` with the shared `allPassed` check.
- Sign-IN form untouched: no rules, no `minLength`, no extra `disabled` condition, no change to `signIn()`.

## `src/routes/reset-password.tsx`

- Same checklist under the "New password" field, `aria-describedby` wired to `new-pw`.
- Replace `password.length < 8` guard with the shared check; the existing `password !== confirm` mismatch check stays exactly as-is.
- Submit button: `disabled={saving || !pwCheck.allPassed || password !== confirm}`.

## Out of scope

No database, migration, or auth-setting change. No other file touched.

## Verification

- `git diff --stat` (expect 3 files)
- Playwright at 390px width: checklist part-satisfied and fully satisfied screenshots
- Sign in with an existing account whose password is 8 lowercase characters to prove no lockout
