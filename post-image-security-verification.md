# Post-image security verification — November 16, 2026

## Applied scope
- Applied the approved SQL byte-for-byte in `drizzle/migrations/0017_post_image_publication_access.sql` through the platform migration tool. Drizzle is the project's authoritative migration history; frozen Supabase migration history was untouched.
- Only production application edit: corrected the explanatory comment in `src/lib/post-images.ts`. Signing lifetime, caching, uploads, deletes, UI and all other application behavior unchanged.
- Added opt-in live integration tests alongside existing tests and updated architecture/roadmap documentation. Generated schema types and migration metadata were updated by the platform tool.

## Six fixture tests — all passed
Executed `RUN_POST_IMAGE_TESTS=1 POST_IMAGE_SESSION_FILE=/tmp/browser/post-image-security/sessions.json bunx vitest run src/lib/post-images.integration.test.ts`.

Used only the permanent negative-test parent and approved staff fixture. No signup, invite consumption, student edits, or real-family login.

| Test | Observed result |
| --- | --- |
| a. Parent signs published announcement | Signed link returned; image downloaded, HTTP 200. |
| b. Parent signs known scheduled announcement key (2099) | No usable link; per-object access error. |
| c. Parent lists bucket | Four keys during testing, all backed by published posts; scheduled, unpublished and orphan fixtures absent. |
| d. Staff signs both and lists everything | Both published/scheduled links returned; inventory exactly original objects plus all five fixture objects. |
| e. Signed-out access | No signed link, no objects listed, private-object download rejected (HTTP 400). |
| f. Poll publication | Published poll link returned; unpublished poll link denied. |

Four temporary rows (two announcements/two polls) and five JPEG objects were removed. Independent database readback: fixture announcements **0**, fixture polls **0**, fixture objects **0**. Original staff-visible object inventory exactly restored. Permanent accounts and permanent child retained unchanged.

## Final readback
Both helpers are SQL, STABLE, SECURITY DEFINER, with `search_path=public`. Anonymous execute **false**, authenticated execute **true**, for both; PUBLIC execute revoked.

Post-image SELECT policy:

```sql
CREATE POLICY "Signed-in users can read post images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'post-images' AND public.can_read_post_image(name));
```

Helper publication conditions match the approved SQL: exact `image_url` key equality; announcements require `publish_at IS NULL OR publish_at <= now()`; polls require `published=true`. Admin bypass remains. Active member means admin or a matching profile whose `archived_at IS NULL`.

All seven other storage policies match the pre-change readback, including all three post-image admin write policies and all four album-cover policies. Admin write predicates still require the post-images bucket and `has_role(auth.uid(),'admin')`, including UPDATE's WITH CHECK.

Bucket readback: `post-images`, private (`public=false`), `file_size_limit=5242880` (5 MB), `allowed_mime_types=null`.

**Open MIME item:** requested JPEG/PNG/WebP bucket restriction was not attempted. Supported bucket tools cannot set it and SQL writes to storage.buckets are prohibited. Client validation and JPEG re-encoding remain unchanged.

Existing previously issued signed links may work until their existing one-hour expiry; this fix restricts new reads/signing, not already issued bearer links.

## Security and change checks
- Quick scan completed at 04:06:45 UTC: **9 existing findings — 1 error, 2 warnings, 6 notices**. The post-images blanket-read error is absent. Remaining error concerns album covers; warnings concern shared app settings/leaderboard divisions; notices concern shared reference lists. No findings dismissed and no unrelated policies changed.
- Deep scan will run against saved changes; its results remain pending until completion notification.
- `package.json` and `bun.lock` have **no diff for this request: no dependency changes**. The pre-existing lock change seen during planning was saved externally before implementation; this request did not edit dependencies.
- Credential inspection found only an environment-variable reference in generated server code, not a stored key. No credentials were committed. Production bundle credential grep was not performed because no production output was generated.
- Latest preview build signal: build OK at 04:06:10 UTC. Existing preview telemetry also contains a hydration-mismatch error; no UI/runtime fix was attempted under the database-only scope. Storage behavior was verified directly through the same client API used by the application, with real fixture sessions.