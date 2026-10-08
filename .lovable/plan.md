# Round 63 — archive/restore must not reactivate children who had quit, plus R58 polish

Starting point: commit 50b9ba1387dec5faea61ce470fe256be62740908 (package.json and bun.lock as of that commit). Archived families right now: 0, so no backfill. I will check again just before the migration and stop if it isn't 0.

## Part A — the bug

**Migration (one file in drizzle/migrations/):**
```sql
ALTER TABLE public.students ADD COLUMN deactivated_by_family_archive_at timestamptz NULL;
COMMENT ON COLUMN public.students.deactivated_by_family_archive_at IS
  'Set only when a family archive deactivated this child; family restore reactivates only these rows, then clears it.';
```
Why this name: it says exactly who deactivated the child (the family archive) and when. A null value means "a person made this decision about this child", so a family restore leaves it alone. No changes to RLS, grants or functions.

**setParentAccountArchived** (the order stays the same: admin check → privileged client → profile update; login settings are never touched):
- Archive: find this profile's active children (by parent_id). For each one, check student_guardians for another linked guardian whose profile is not archived. Children with no such guardian get `active=false, column=now()`. Children that do have one are left alone, and their names are returned in `keptActive`.
- Restore: `update active=true, column=null where parent_id=this profile and column is not null`. A child moved to another family no longer has this parent_id, so restore can't touch it (test 3 proves this).
- `studentsChanged` = the number of rows actually updated. The success message shows "Mia stays active — linked to another guardian." for each child kept active.

**Archive/Restore buttons on a single student** (admin.tsx lines ~1454 and ~1506): also set `deactivated_by_family_archive_at: null`.

## Part B — admin polish
1. Add guardian search: limit results to accounts that have the `parent` role and `archived_at IS NULL`. Roles are read with a browser query, `supabase.from("user_roles").select("user_id, role")`. The existing policy "Admins can view all roles" (`has_role(auth.uid(),'admin')`) already lets admins read it, so no new policy is needed. Any account with the admin role is left out, even if it also has the parent role, which removes the zzstaff fixture.
2. Remove on a secondary guardian: add a confirmation dialog matching the Link dialog: "Remove {email} as a guardian of {first} {last}?"
3. Both refusal messages change to "Manage Students → the student's card → …" (that is the exact label in ADMIN_TABS).

## Part C — settings copy
Add one muted `text-xs text-muted-foreground` line under the photo toggle in settings.tsx, with the approved sentence word for word. It shows the same for every account, with no per-account check.

## Testing
- Use the zz.test.negative and zz.test.secondary accounts, plus temporary children labelled "ZZTEMP R63 …". The fixture child is not used.
- Staff steps run as the zzstaff account.
- Run scenarios 1–4 as written, showing active and the new column after each step.
- Search for "zzstaff" and show 0 results.
- Take screenshots of the dialog, both refusal messages, and Settings at 390 and 1536.
- Clean up: delete the temporary children and links, un-archive both fixture accounts, and confirm ZZTEST54 is still off.

## Report
- The migration text.
- `git diff --stat` including package.json and bun.lock. Any dependency or tooling change the platform made on its own will be named.
- Proof that media-release.tsx, privacy-policy.tsx and terms.tsx are byte-for-byte unchanged.

## Not touched
RLS, student_guardians, is_guardian_of, the triggers, the R58 functions, deleteParentAccount's logic (only its two strings change), admin_reassign_student, handle_new_user, the sign-in path, and the legal and media-release pages.
