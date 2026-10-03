# Round 58: Two guardians per child

## Outcome
A child can be linked to more than one parent account. Only staff can add or remove a link, from the admin panel. Each linked parent sees that child's records in full. If any guardian has photo consent off, the child is treated as no-photos, and staff see when the guardians disagree.

## 1. Migration (one file)
- New table `student_guardians` (`id`, `student_id`, `profile_id`, `is_primary`, `created_at`, `updated_at`). It has a unique constraint on (`student_id`, `profile_id`), a partial unique index allowing only one primary per child, and deletes cascade with the student or the profile. GRANTs, then RLS:
  - Admins can do everything.
  - A parent can read only their own link rows.
  - Parents cannot insert, update or delete. There are no such policies, so those actions are denied.
- Backfill: one primary row per student from `students.parent_id`.
- Sync trigger, mirroring `student_classes_sync_label`. It fires on `AFTER INSERT OR UPDATE OF parent_id` only, so belt or points changes never touch it. It runs in this order:
  1. Upsert the incoming parent with `ON CONFLICT (student_id, profile_id) DO UPDATE SET is_primary = true`. This **promotes** an existing secondary guardian instead of inserting a duplicate.
  2. Only after that, delete the old parent's row.
  3. Make sure exactly one primary remains.

  Because of this order, the child is never without a guardian. Running it twice changes nothing. Secondary guardians are kept. To satisfy the one-primary index, the old primary is demoted before the new one is promoted, all inside the same trigger.
- Last-guardian guard: a BEFORE DELETE trigger refuses to remove a child's only guardian link. It also refuses to remove the primary while `students.parent_id` still points at that parent. The message is readable: "A child must always have at least one guardian. Link another guardian first, or move the child to another family." Deletes that come from a student or profile being deleted are allowed through.
- Helper `is_guardian_of(_student_id)`: STABLE, SECURITY DEFINER, `search_path = public`. Execute is revoked from PUBLIC and anon, and granted to authenticated and service_role.
- **Seven policies**: read live from `pg_policies`, then recreated with only one change. `s.parent_id = auth.uid()` (or `auth.uid() = parent_id` on students) is replaced by a `student_guardians` membership check. Everything else in each condition is copied verbatim. I'll quote each one before and after.
- **Four functions**: `get_curriculum_for_all_children`, `get_curriculum_for_student`, `get_my_division`, `get_technique_library`. Each definition is read from the live database, and only the parent check is changed to a guardian check. I'll quote each before and after. Owner, SECURITY DEFINER, search_path and grants stay as they are, and I'll verify them through `proacl`.
- **Not touched**: `handle_new_user`, `admin_reassign_student`, `award_points`, `change_attendance`, `has_role`, `pending_student_imports`, leaderboard last-initial logic, and every admin policy. `parent_id` stays NOT NULL and is still written.
- A view `student_photo_consent`, set to `security_invoker`. Per child it shows the guardian count, how many guardians have consent off, `no_photos` (true if any has it off), and `conflict` (some yes, some no).

## 2. Admin screens
- **Manage Students row**: list every guardian's email, with the primary marked. Staff get "Add guardian", which searches existing parent accounts only and asks for confirmation naming the child and the account. Each non-primary guardian gets "Remove". On the primary, Remove is disabled with the tooltip "The main family can't be removed — move the child to another family instead." If the server refuses, its message is shown word for word.
- **Photo Consent**: the screen switches to one row per child, read from the view. It shows each guardian's choice. When the guardians disagree, it shows a clear red "Guardians disagree — treat as NO photos" label; otherwise "No photos". The existing per-parent consent log and acknowledge flow stay as they are.
- **Settings consent**: unchanged.
- **Delete-parent refusal**: also counts secondary guardian links. It names those children and says to remove the link first.

## 3. Verification (real output, test accounts and SQL only)
- **Backfill check over the whole table.** All of these must be 0:
  - students whose guardian row doesn't match `parent_id`
  - students with no guardian row
  - students with more than one guardian row
  
  Also: total students = total guardian rows.
- **Isolation test**:
  - Give zz.test.secondary a temporary labelled test child.
  - Each test account sees only its own child across the six tables.
  - Remove a link: that account loses the child in all six tables. Restore the link: access returns.
- **Two guardians**:
  - Link zz.test.secondary to the ZZTEST fixture child. Both accounts see the child; each still sees nothing else.
  - Set one account's consent off. The child reads as no-photos, and the admin screen shows the conflict.
- **Remove and refuse**:
  - Removing the secondary guardian works.
  - Removing the last guardian is refused, with that refusal shown.
  - As a non-admin, inserting a guardian link fails.
- **Sync trigger**:
  - Parked child linked at a fresh test signup arrives with both `parent_id` and a primary guardian row. This briefly turns ZZTEST54 on and back off; I'll report the usage change.
  - Moving the child with R61's Families flow: the guardian row follows the child; the old account loses access and the new one gains it.
  - Promotion case: link the secondary first, then reassign to them. Exactly one primary row, no duplicates.
  - A belt or points change leaves guardian rows unchanged. Points are never changed on the fixture child.
- **Cleanup**:
  - Unlink the test guardian. The fixture child is back to one guardian, parented by zz.test.negative.
  - Delete the temporary child and the fresh signup account. Restore consent values.
  - ZZTEST54 is off with `max_uses` 20.
- **Report**: the full migration text, the file list, and a build/typecheck pass.

## Note
Part of your answer about the four functions was cut off in what I received after "quote the…". If it included requirements beyond "read live, transform, quote before and after", please restate them before approving.
