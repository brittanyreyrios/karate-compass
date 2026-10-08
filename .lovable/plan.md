# Round 66 — Pre-link a second guardian by email

Starting commit: `30edd3196a13ede2e3d7bad80a614ab104c96197`.

## Checked before planning (real output)
- `handle_new_user` proacl: `{postgres=X/postgres,service_role=X/postgres}`
- `check_invite_code` proacl: `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
- GRANT pattern to follow (0000, student_guardians): `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated; GRANT ALL … TO service_role;` — no anon.

## Migration (one file, drizzle/migrations/0004_r66_pending_guardian_links.sql)
1. `public.pending_guardian_links`: id uuid PK default gen_random_uuid(), student_id uuid NOT NULL → students ON DELETE CASCADE, email text NOT NULL, created_by uuid (plain uuid, no auth.users FK, per project rule), created_at timestamptz NOT NULL default now(). UNIQUE (student_id, email). CHECK `email = lower(btrim(email))` so storage is normalised whatever the caller sends.
2. GRANTs as above, ENABLE RLS, one policy: admins ALL using/with check `has_role(auth.uid(),'admin')`. No parent policy.
3. `CREATE OR REPLACE FUNCTION public.handle_new_user()` — the current body copied byte-for-byte, with one new block inserted after the parked-student block's `END;` and before `RETURN NEW;`:
```text
-- Round 66: attach pre-linked second guardians. Never allowed to block signup.
BEGIN
  FOR r IN SELECT * FROM public.pending_guardian_links
           WHERE email = lower(btrim(NEW.email)) LOOP
    INSERT INTO public.student_guardians (student_id, profile_id, is_primary)
    VALUES (r.student_id, NEW.id, false)
    ON CONFLICT (student_id, profile_id) DO NOTHING;
    DELETE FROM public.pending_guardian_links WHERE id = r.id;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pending guardian link failed for %: %', NEW.email, SQLERRM;
END;
```
   Reuses the existing `r record` variable (no DECLARE change). Never sets is_primary true, never touches students. The sync/guard triggers fire only on students / delete, so this insert does not trip them. No DROP; owner, SECURITY DEFINER, search_path unchanged.

Not touched: invite-code check, profile/role inserts, parked block, student_guardians policies, is_guardian_of, triggers, R58 functions, admin_reassign_student, check_invite_code, auth path, legal pages, email confirmation.

## Admin UI (src/components/admin-guardians.tsx only)
- Add guardian search with no matching parent + `isEmailWithTld(text)` → button "Link this email when they sign up".
- Before showing the confirm dialog, checks (admin reads, all already permitted by existing admin policies):
  - email matches any profile → refuse: "{email} already has an account. Use Add guardian to link it directly." If that profile has the admin role → instead: "{email} is a staff account and can't be linked as a guardian."
  - already pending for this child → "{email} is already waiting to be linked to {first} {last}." (the unique constraint backs this up; a 23505 maps to the same message).
- Confirm dialog, exact text: "When {email} signs up, they'll be linked to {first} {last} automatically and will see their belt, attendance, Dojo Points and tournament results. The main family stays linked and is not told."
- Non-blocking warning inside that dialog when pending_student_imports has rows for the email, naming each parked child: "This email also has parked roster rows ({names}). When they sign up those will be created as NEW students. If one of them is this same child, delete that parked row first or you'll get a duplicate."
- On the student's card under the guardian list: "Pending: {email} — links at signup" with Cancel → confirm dialog → delete row.
- Nothing parent-facing changes.

## Email confirmation
The link attaches to the account at signup, but the new account cannot sign in until the email is confirmed — that is unchanged; the report will show the sign-in refusal before confirmation.

## End-to-end test (test accounts only)
1. Record students / student_guardians counts. Create "ZZTEMP R66 Test" under zz.test.negative.
2. As the zzstaff fixture, pre-link a throwaway address: `leaguecity.tigersden+zzr66@gmail.com` (inbox-capable, so Britt can confirm it; same pattern as the staff fixture). Screenshot the three refusals (zz.test.secondary = existing account, repeat = already pending, zzstaff = staff) and the parked-row warning (via a temporary labelled parked row under the throwaway address, deleted right after the screenshot, before signup).
3. ZZTEST54 on → sign up through the real form → off; report used_count (expected 5 → 6, max 20).
4. Show: one new non-primary student_guardians row for the new account, pending row gone, students count unchanged, temp child's parent_id unchanged.
5. STOP and ask Britt to confirm the account in Cloud → Users; then sign in as it and screenshot the child on its dashboard.

## Failure-safety
Show the EXCEPTION block in the deployed function body. A forced failure would need a deliberately broken pending row or a temporary sabotage of the function on the live signup path, which I don't think is safe; I propose to stop at the structural proof plus a read of the identical existing block's behaviour, unless you want a specific forced-failure method.

## Cleanup
Remove the throwaway account's guardian link first (non-primary, allowed by the guard trigger; the delete flow refuses while a link exists), archive and delete the account via the admin flow, delete the temp child and any pending rows, ZZTEST54 off, fixture child 0 points, counts back to before-values.

## Report
git diff --stat including package.json / bun.lock (expected: no dependency changes), migration text, handle_new_user before/after with diff, proacl for both functions, pg_policies rows for the new table, all of the above output.
