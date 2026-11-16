# Post-image storage access security

## Scope — approval required
Restrict new reads and signed-link creation in the private **post-images** bucket to staff or active members viewing published posts. No database or application changes until approval. Leave UI, dependencies, album covers, and all existing admin INSERT/UPDATE/DELETE policies unchanged. The only application edit will be the requested explanatory comment in `src/lib/post-images.ts`.

Read-only inspection confirms the current SELECT policy permits every authenticated user to read every object in this bucket. The bucket is private, its size limit is 5 MB, and `allowed_mime_types` is null. Neither proposed helper already exists.

## Full SQL for approval
Apply exactly this through the platform migration tool into authoritative `drizzle/migrations/`; do not add to frozen `supabase/migrations/`. No table or data changes.

```sql
CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.archived_at IS NULL
    );
$function$;

REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_post_image(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
    OR (
      public.is_active_member()
      AND (
        EXISTS (
          SELECT 1
          FROM public.announcements AS a
          WHERE a.image_url = _object_name
            AND (a.publish_at IS NULL OR a.publish_at <= now())
        )
        OR EXISTS (
          SELECT 1
          FROM public.polls AS p
          WHERE p.image_url = _object_name
            AND p.published = true
        )
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_read_post_image(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_post_image(text) TO authenticated;

DROP POLICY "Signed-in users can read post images" ON storage.objects;

CREATE POLICY "Signed-in users can read post images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-images'
  AND public.can_read_post_image(name)
);
```

Both helpers derive identity from `auth.uid()`, not caller-provided user IDs. The SECURITY DEFINER lookup deliberately bypasses announcement/poll table RLS without returning their contents. Exact bare-key matching is required. Staff can read all bucket objects, including drafts and unattached uploads; non-admin members cannot read unattached images, scheduled announcement images, or unpublished poll images. If a key is also attached to any published post, it is readable as requested. No anonymous helper execution or anonymous SELECT access is introduced.

## Bucket MIME restriction — supported-tool blocker
Requested values: `image/jpeg`, `image/png`, `image/webp`.

The available bucket-update tool cannot set `allowed_mime_types`; it supports only public/private and size limits. Platform rules prohibit SQL updates to `storage.buckets`, so no such statement is included or will be attempted. This part remains blocked pending a supported bucket MIME-setting capability. Existing client validation and JPEG re-encoding remain unchanged. Approval of this plan permits the access-policy fix, not an unsupported workaround.

## Comment-only application correction
Replace the old claim that unguessable names are the only protection with an explanation of staff access and active-member publication checks. Preserve the existing filename format, signing lifetime, caching, upload, and delete code. Do not claim bucket MIME enforcement until it reads back successfully.

## Fixture-only tests and cleanup after approval
Use only the permanent `zz.test.negative` parent and approved `zzstaff` account. No signup, invite use, real family tests, or permanent child changes.

Create uniquely marked temporary published/scheduled announcements, published/unpublished polls, and JPEG objects through staff-authorized APIs; keep scheduled announcement dates in 2099. Use distinctive keys and record exact fixture IDs for cleanup.

Report each requested result separately:
1. Parent `createSignedUrls` for a published announcement image succeeds, and the returned link retrieves the image.
2. Parent `createSignedUrls` for the known 2099 announcement image key fails to return a usable link; inspect per-object errors, not only HTTP status.
3. Parent `list()` exposes only published-post objects; page through results and verify each returned key against publication state without displaying real content.
4. Staff signs both keys successfully and lists all objects, including the hidden fixture images.
5. Signed-out signing, listing, and private-object download fail to expose any object.
6. Additional fixture assertions verify published-poll access succeeds and unpublished-poll access fails.

Keep small opt-in integration tests next to existing tests. Remove every newly created fixture row/object, leaving permanent accounts and child untouched. Read back the exact final storage policies, helper privileges, private bucket setting, 5 MB limit, and MIME values; compare admin writes and unrelated policies byte-for-byte with the baseline. Run the security scan and report new versus existing findings, without dismissals.

Existing signed URLs are not revoked by this policy change and may remain usable until their current one-hour expiry; changing that lifetime is out of scope.

## Dependency and credential report
No dependency changes will be made for this request. `package.json` currently has no working-tree diff; `bun.lock` already has an unrelated pre-existing config-package change from 2.26.5 to 2.27.1. Leave it untouched and outside the request's commits. No credentials will be committed.
