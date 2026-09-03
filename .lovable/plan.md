# Archive, then delete, parent accounts (admin-only)

## Mechanism decision (before code)

**Chosen: a TanStack server function using the service role and the GoTrue Admin API
(`supabase.auth.admin.deleteUser`) — not a Supabase edge function, and not a
SECURITY DEFINER SQL function.**

Why:
- This project's backend convention is `createServerFn` for app-internal logic; edge
  functions are not used here, so no new infrastructure is stood up.
- `auth.admin.deleteUser` is GoTrue's own delete path, so its internal state
  (sessions, identities, refresh tokens, MFA factors) stays consistent. A SQL
  `DELETE FROM auth.users` bypasses GoTrue and is exactly the inconsistency risk you
  named — and it would also mean touching the `auth` schema, which is off limits.
- Consequence: **no new database function is created**, so there is no new
  `pg_proc.proacl` to harden. I will still show `proacl` evidence — that no new
  function exists — and confirm existing function ACLs are unchanged.

Server-side authority for every action in this feature: the server function runs
`requireSupabaseAuth`, then re-checks `has_role(<caller>, 'admin')` through the
caller's own RLS-scoped client. Non-admins get a thrown error before any write.

## 1 — Archive state on accounts

- Migration: `ALTER TABLE public.profiles ADD COLUMN archived_at timestamptz` (nullable).
  No policy, grant, trigger, or auth setting changes.
- Note: `profiles` has no admin UPDATE policy today (only "Users update own profile"),
  so archiving cannot be a client write. It goes through the same admin server function,
  which is why no RLS change is needed. Sign-in is untouched — archiving is display state
  only. No login gate (asking first if you ever want one).
- Archive: set `archived_at = now()` and `active = false` on every student with that
  `parent_id`. Restore: `archived_at = null` and `active = true` on those students.
- Accounts list: archived accounts drop out of the default list and appear behind an
  "Archived" filter with a Restore control, mirroring `ArchivedStudentsPanel`.

## 2 & 3 — Delete, only from archived state

- The Delete control renders only on an already-archived account (two deliberate steps).
- Server refusal (authoritative, independent of the UI): count **all** rows in
  `students` with that `parent_id` — no `active` filter. If > 0, throw with the count and
  the children's names, pointing at the existing "move student to another family" tool.
- On success, delete all three pieces explicitly, in order: `user_roles` rows for that
  user, the `profiles` row, then the `auth.users` row via the Admin API. Each step's
  result is checked; the report proves all three are gone.

## 4 — Zero-child badge / filter

- Accounts list gets a "No students" badge plus a filter toggle, computed from a
  `students` count grouped by `parent_id`. Display only — it gates nothing, and no delete
  behaviour keys off it.

## Files

- `supabase/migrations/*` — the one `ALTER TABLE`.
- `src/lib/parent-accounts.functions.ts` — new: `archiveParentAccount`,
  `restoreParentAccount`, `deleteParentAccount` (admin-verified, service-role writes).
- `src/routes/_authenticated/admin.tsx` — `ParentsTab`: archived filter, no-students
  badge/filter, archive/restore/delete controls with confirm dialogs.

## Test plan (real output in the report)

Throwaway accounts I create and remove myself, clearly labelled
(`zz-throwaway-*@example.com`). Never touching `brittanyrey1214@gmail.com` or
`falconpllc@gmail.com`; `brittanyrey1214@utexas.edu` left alone unless you say otherwise
(it is not needed for testing).

Evidence: `git diff --stat`, the full migration, refusal called directly on the server for
both an active child and an archived child, archive/restore round trip, a clean delete
with post-delete queries against `auth.users`, `profiles`, `user_roles`, a policy/grant
diff showing nothing else changed, and a final sweep proving zero test accounts remain.
