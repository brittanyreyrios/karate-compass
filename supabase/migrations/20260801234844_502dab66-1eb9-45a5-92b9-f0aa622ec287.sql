-- album-covers is PRIVATE: this workspace blocks public buckets
-- (cloud_block_public_buckets), so covers are served via short-lived signed URLs
-- to signed-in users instead of open public URLs.
--
-- MANUAL RESTORE STEP: the bucket itself CANNOT be created in a migration —
-- writes to storage.buckets are rejected by this project's tooling. On a fresh
-- database create it manually BEFORE relying on these policies:
--     bucket id / name : album-covers
--     public           : false (private; signed URLs)
--     size / mime      : enforced client-side (image/* only, max 5 MB)
-- Without the bucket, every album cover upload fails with a confusing error.

DROP POLICY IF EXISTS "Album covers are publicly readable" ON storage.objects;

DROP POLICY IF EXISTS "Signed-in users can read album covers" ON storage.objects;
CREATE POLICY "Signed-in users can read album covers"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'album-covers');