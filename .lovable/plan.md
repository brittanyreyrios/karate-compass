# Round 58: Two guardians per child

## Outcome
A child can be linked to more than one parent account. Only staff can add or remove a link, from the admin panel. Each linked parent sees that child's records in full. If any guardian has photo consent off, the child is treated as no-photos, and staff see when the guardians disagree.

## 1. Migration (one file)
- New table `student_guardians` (`id`, `student_id`, `profile_id`, `is_primary`, `created_at`, `updated_at`). It has a unique constraint on (`student_id`, `profile_id`), a partial unique index allowing only one primary per child, and deletes cascade with the student or the profile. GRANTs, then RLS:
  - Admins can do everything.
  - A parent can read only their own link rows.
  - Parents cannot insert, update or delete. There are no such policies, so those actions are denied.
- Backfill: one primary row per student from `students.parent_id`.
- Sync trigger, mirroring `student_classes_sync_label`. It fires on `AFTER INSERT OR UPDATE OF parent_id` only, so belt or points changes never touch it. When `UPDATE OF parent_id` fires but the value is unchanged (`OLD.parent_id IS NOT DISTINCT FROM NEW.parent_id`), it exits without doing anything. The final order is:
  1. **Demote** every primary row for this `student_id` (`UPDATE ... SET is_primary = false WHERE student_id = NEW.id AND is_primary`).
  2. **Upsert** the incoming parent as primary: `INSERT ... ON CONFLICT (student_id, profile_id) DO UPDATE SET is_primary = true, updated_at = now()`. This promotes an existing secondary guardian instead of creating a duplicate.
  3. **Delete** the old parent's row (`profile_id = OLD.parent_id`, on UPDATE only, and only when it differs from `NEW.parent_id`).

  The partial unique index can't be deferred, which is why demoting comes first. The child has at least one guardian row at every step, and running it twice gives the same single primary row. Secondary guardians are kept. The report will show the trigger body as written.
- Last-guardian guard: a BEFORE DELETE trigger. **How it spots a cascade:** if the referenced `students` row or `profiles` row no longer exists (`NOT EXISTS (SELECT 1 FROM students WHERE id = OLD.student_id)`, and the same for `profiles`), the delete is allowed through. It does not use `pg_trigger_depth()`. Otherwise it refuses in two cases, with readable messages:
  - removing the child's last remaining guardian row
  - removing the row for the parent `students.parent_id` currently points at: "This is the child's main family. Move the child to another family instead."

  When the sync trigger deletes the old parent's row, `parent_id` has already changed and the new primary row already exists, so the guard lets it through.
- Helper `is_guardian_of(_student_id)`: STABLE, SECURITY DEFINER, `search_path = public`. Execute is revoked from PUBLIC and anon, and granted to authenticated and service_role.
- **Seven policies**: read live from `pg_policies`, then recreated with only one change. `s.parent_id = auth.uid()` (or `auth.uid() = parent_id` on students) is replaced by a `student_guardians` membership check. Everything else in each condition is copied verbatim. I'll quote each one before and after.
- **Four functions**: `get_curriculum_for_all_children`, `get_curriculum_for_student`, `get_my_division`, `get_technique_library`.
  - Each is read with `pg_get_functiondef`, and only the parent access check changes to a guardian check. Every other line is copied verbatim.
  - I'll quote each one before and after.
  - Owner, SECURITY DEFINER and search_path are preserved, and grants are proven with `proacl` before and after.
  - Any use of `parent_id` that isn't the access check is left alone, and I'll say where it is.
  - I'll report the row count each function returns for zz.test.negative before and after; they must be identical.
  - None of the four returns a profiles row or an email; the report will show their return columns to prove it.
- **Not touched**: `handle_new_user`, `admin_reassign_student`, `award_points`, `change_attendance`, `has_role`, `pending_student_imports`, leaderboard last-initial logic, and every admin policy. `parent_id` stays NOT NULL and is still written.
- A view `student_photo_consent`, set to `security_invoker`, returning rows only when `has_role(auth.uid(), 'admin')`. Per child it shows the guardian count, how many guardians have consent off, `no_photos` (true if any has it off), and `conflict` (some yes, some no). A parent querying it gets zero rows.

### Co-guardian privacy (hard requirement)
- A parent can read only their own `student_guardians` row, so a co-guardian's row is invisible to them.
- The consent view returns nothing to parents.
- No parent screen, query, function result or error message names a co-guardian or reveals that one exists:
  - Refusal messages are admin-only, because only admins can delete links.
  - Poll uniqueness is per account, and the existing indexes include `profile_id`, so a second guardian voting never hits a conflict that would reveal the other parent.
- **Verification**: logged in as each test parent, run `select * from student_guardians`, the consent view, and every parent screen's queries, and show that no co-guardian identity appears.

## 2. Admin screens
- **Manage Students row**: list every guardian's email, with the primary marked. Staff get "Add guardian", which searches existing parent accounts only and asks for confirmation naming the child and the account. Each non-primary guardian gets "Remove". On the primary, Remove is disabled with the tooltip "The main family can't be removed — move the child to another family instead." If the server refuses, its message is shown word for word.
- **Photo Consent**: the screen switches to one row per child, read from the view. It shows each guardian's choice. When the guardians disagree, it shows a clear red "Guardians disagree — treat as NO photos" label; otherwise "No photos". The existing per-parent consent log and acknowledge flow stay as they are.
- **Take Attendance no-photos marker** (`admin.tsx:905`): stop using `consentOffIds.has(s.parent_id)` and use the view's `no_photos` value per student, so consent-off from a secondary guardian also shows the marker.
- **Other consumers**, from a search of the code:
  - `useConsentOffProfiles` is also used by `PhotoConsentBanner` (`admin-photo-consent.tsx:84`). The banner counts families, not children, so it stays per-account. I'll say so in the report.
  - `NoPhotosMarker` is used only at `admin.tsx:905`.
- **Settings consent**: unchanged.
- **Delete-parent refusal**: also counts secondary guardian links. It names those children and says to remove the link first.
- **Noted, not fixed**: `parent-accounts.functions.ts:61` archives by `parent_id`, so archiving a primary guardian deactivates a child who still has an active secondary guardian. This is left alone and will be flagged in the report.

## 3. Verification (real output, test accounts and SQL only)
- **Backfill check over the whole table.** All of these must be 0:
  - students whose guardian row doesn't match `parent_id`
  - students with no guardian row
  - students with more than one guardian row
  
  Also: the student count before the migration (expected 129) must equal the guardian-row count after.
- **Attendance marker**: with the secondary guardian's consent off, the fixture child shows "No photos" on Take Attendance, captured as a real screenshot. With consent back on, the marker is gone.
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

