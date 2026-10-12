# Round 60 — View and change a parent's email

Starting commit: `1a8826745eca030abb36c51e047ba8b398e38372`

## Answers to the two pre-build questions

**Can `sendLovableEmail` send a non-auth message?** Yes. It is a plain exported function, not tied to the auth webhook. Source (`node_modules/@lovable.dev/email-js/dist/index.js`):

```js
async function sendLovableEmail(payload, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error("Missing Lovable API key");
  ...
  const url = sendUrl || `${resolveApiBaseUrl(options.apiBaseUrl)}${DEFAULT_SEND_PATH}`; // "/v1/messaging/email/send"
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
```

Its payload type (`EmailSendRequest`) takes `to, from, sender_domain, subject, html, text, purpose, label, idempotency_key` — nothing restricts it to auth action types. `createAuthEmailHandler` is simply one caller, using `purpose: "transactional"`. The notification will use the same sender domain the auth webhook already uses (`notify.tigersdenmartialarts.com`), `purpose: "transactional"`, `label: "parent_email_changed"`. No new package, key, provider or edge function. One honest caveat: the platform may reject non-auth sends for its own reasons — I will only know at the first real call. If it does, the change still stands and staff see "notification not sent: <reason>"; I report it rather than work around it.

**Does the Admin API email update send a GoTrue email itself?** Expected: no. `updateUserById(id, { email, email_confirm: true })` sets the address as confirmed directly and skips the email_change flow (that template is sent only by the user-side `updateUser`). I will verify empirically: check the email log for both the old and new address after the test change, and report exactly what appears.

## What gets built

1. **Migration** (one file, `drizzle/migrations/0006_r60_email_change_events.sql`) — audit table modelled on `role_change_events`:
   - `email_change_events(id uuid pk, target_user_id uuid not null, old_email text not null, new_email text not null, changed_by uuid, changed_at timestamptz default now())`
   - Grants: SELECT to authenticated, ALL to service_role. RLS on; one policy "Admins can read email change history" using `has_role(auth.uid(),'admin')`. No insert policy — only the server function (service role, after `assertAdmin`) writes rows.
2. **Server function** `changeParentEmail` added to `src/lib/parent-accounts.functions.ts`, same shape as the existing archive/delete functions:
   - `requireSupabaseAuth` → `assertAdmin` → only then `await import(client.server)`.
   - Validate: `isEmailWithTld` (reused, no new validator); trimmed/lowercased new address differs from current; no other profile or auth user has it — refusal names the owning family and email.
   - Step 1: `auth.admin.updateUserById(id, { email, email_confirm: true })`. On error: change nothing, return the reason.
   - Step 2: update `profiles.email`. On error: return a loud "OUT OF STEP — login is X, panel still shows Y" error, never swallowed.
   - Step 3: insert audit row (failure reported, change stands).
   - Step 4: look up `pending_student_imports` and `pending_guardian_links` for the new address and return them as warnings — nothing applied.
   - Step 5: send the notification to the new address; failure reported, no rollback.
   - Never touches password, never triggers a reset.
3. **Function** `listEmailChangeEvents(profileId)` — admin-only read of the history.
4. **UI** in Parents & Premium (`admin.tsx`): a "Change email" action on each parent row opening a dialog — current address, new address field, confirmation, then a result panel showing warnings (pending rows, notification failure, out-of-step) and a short change history for that account. On success, invalidate the admin profiles query so the Manage Students parent line and the Parents list show the new address at once.
5. **AGENTS.md**: one rule — login-email changes go through the auth-first server function; never edit `profiles.email` alone.

Untouched: `admin_reassign_student`, the parked-student email editor, `handle_new_user`, the sign-in/54b path, signup, `.env`.

## Testing (fixtures only — no real family, angoralashane@gmail.com untouched)

- zz.test.negative@example.com → leaguecity.tigersden+zzr60@gmail.com: show auth.users.email and profiles.email before/after; capture the real Admin API response; sign in through the normal form with the new address; then change back and show both again.
- Duplicate refusal targeting zz.test.secondary@example.com (unchanged afterwards) — exact staff message.
- Invalid address refusal (e.g. `name@gmail`) via `isEmailWithTld`.
- Non-admin refusal: call the function signed in as the negative fixture.
- Audit rows read back from the database.
- Notification: check the email log for delivery to the +zzr60 address; Britt can confirm arrival in the inbox.
- Bounce marker: confirm it matches on current address only, so the old address stops matching.
- Report git diff --stat including package.json and bun.lock (expected: no dependency changes).
