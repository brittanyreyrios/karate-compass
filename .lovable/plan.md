# Album-cover storage access security

## Scope — approval required
Restrict reads and new signed-link creation in the private **album-covers** bucket. No database or application changes before approval. Reuse `public.is_active_member()` unchanged. Leave UI, dependencies, all admin INSERT/UPDATE/DELETE policies, and every unrelated policy unchanged.

Read-only inspection confirms the current SELECT policy permits every authenticated user to read every bucket object. `can_read_album_cover` does not exist. The bucket is private, its limit is **5 MB (5242880 bytes)**, and its MIME list already contains `image/jpeg`, `image/png`, and `image/webp`. No bucket-setting change or workaround is needed or proposed.

## Full SQL for approval
Apply exactly this SQL through the platform migration tool into authoritative `drizzle/migrations/`, never frozen `supabase/migrations/`.

```sql
CREATE OR REPLACE FUNCTION public.can_read_album_cover(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
    OR (
      public.is_active_member()
      AND EXISTS (
        SELECT 1
        FROM public.gallery_albums AS a
        WHERE a.cover_image_url = _object_name
          AND a.active = true
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_read_album_cover(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_album_cover(text) TO authenticated;

DROP POLICY "Signed-in users can read album covers" ON storage.objects;

CREATE POLICY "Signed-in users can read album covers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'album-covers'
  AND public.can_read_album_cover(name)
);
```

The helper derives the caller from `auth.uid()`. Its fixed-search-path SECURITY DEFINER lookup checks album state independently of gallery table read policies and returns only a boolean. Matching is exact equality to the bare storage key: no URL conversion, prefix matching, or fuzzy matching. A key attached to any active album is readable to active members; inactive-only and unattached keys are not. Admins retain access to all objects. PUBLIC and anonymous execution are revoked; authenticated execution is granted. Existing `is_active_member` and `has_role` definitions/privileges stay unchanged.

## Comment-only application edit
In `src/lib/album-covers.ts`, correct the introductory description to state that staff can read every cover and active members can read only covers attached to active albums. Preserve all executable code, signing lifetime, caching, filename format, uploads, and deletes. No other application-code edit.

## Fixture tests after approval
Use only the permanent `zz.test.negative` parent and approved `zzstaff` account. No signup, invite use, real-family account testing, or permanent-child changes.

Through staff-authorized APIs create uniquely marked temporary active and inactive albums plus their JPEG objects, and one unattached JPEG to verify orphan protection. Record exact album IDs and object keys in a private temporary manifest before testing. Capture the original object inventory and policy/helper definitions for comparisons.

Report each result separately:

**a. Parent, active cover:** `createSignedUrls` returns a usable link; fetching it returns the JPEG successfully.

**b. Parent, inactive cover:** inspect the per-object result/error and verify there is no usable link, regardless of overall HTTP status. Also verify the unattached JPEG is denied.

**c. Parent, listing:** page through `list()` results, descending into folders if present; check each returned object key against the active-album reference set obtained through staff-authorized reads. Inactive and unattached fixture keys must be absent. Do not reproduce real album content in the report.

**d. Staff:** sign and retrieve both active/inactive covers; page through all objects and compare with the original inventory plus every fixture object, including inactive and unattached JPEGs.

**e. Signed out:** signing yields no usable links, listing exposes no objects (an empty response is an acceptable denial), and direct private-object downloads fail for known keys. This does not mean revoking possession of a signed link already issued to an authorized user.

Keep a small opt-in integration test next to the existing storage tests and run it against only these fixtures. No dependency additions. Use temporary private session files; never commit tokens or credentials.

## Cleanup, readback, and quick scan
Delete every temporary album and JPEG through staff-authorized APIs, even after a failed test. Verify recorded IDs/keys are absent and the original object inventory is preserved; permanent fixtures stay untouched.

Read back and report:
- All final `storage.objects` policies; compare admin album-cover INSERT/UPDATE/DELETE and every unrelated policy byte-for-byte with the baseline.
- New helper definition, STABLE/security-definer/fixed-search-path settings, authenticated EXECUTE allowed, anonymous/PUBLIC EXECUTE absent.
- Existing `is_active_member` definition and privileges unchanged.
- Bucket remains private with the 5 MB limit; report existing MIME list without modifying it.

Run the quick security scan and report new versus existing findings without dismissing or marking any finding. Document `package.json` and `bun.lock` diffs explicitly: **no dependency changes**. Verify no credentials committed. Drizzle is used because it is the project's authoritative, platform-managed migration history; the frozen earlier folder remains untouched.

## Known limitation — unchanged
Already-issued signed links can remain usable until their existing one-hour expiry, including after an album becomes inactive. This database policy restricts subsequent reads and link creation; changing signed-link lifetime is outside this request. Other open security items, including post-image MIME configuration and role lookup, are untouched.
