# Album-cover security verification

Approved SQL was applied verbatim through the platform migration tool as `drizzle/migrations/0018_album_cover_active_album_access.sql`. The frozen `supabase/migrations/` folder was not changed. Drizzle is used because it is this project's authoritative platform-managed migration history.

## Scope
- Reused `public.is_active_member()` unchanged.
- Added `public.can_read_album_cover(text)` and replaced only the album-covers SELECT policy.
- Corrected only the introductory comment in `src/lib/album-covers.ts`; all executable application code, UI, signing/cache lifetime, dependencies, and bucket settings stayed unchanged.
- Added opt-in fixture integration tests next to the existing storage tests. Generated database types/journal/snapshot were updated by the migration tool.

## Tests a–e
Command: `RUN_ALBUM_COVER_TESTS=1 ALBUM_COVER_SESSION_FILE=/tmp/browser/album-cover-security/sessions.json bunx vitest run src/lib/album-covers.integration.test.ts`.

Only permanent `zz.test.negative` and approved `zzstaff` accounts were used. No signup, invite use, real-family account tests, or permanent-child writes.

| Test | Result |
| --- | --- |
| a. Parent signs active-album cover | PASS: usable signed URL; JPEG retrieved with HTTP 200. |
| b. Parent signs inactive cover | PASS: per-object errors checked; neither inactive nor unattached JPEG returned a usable link. |
| c. Parent lists bucket | PASS: all six returned keys checked against exact active-album references; inactive/unattached fixtures absent. Listing helper pages through results and recursively traverses folders. |
| d. Staff signs/lists | PASS: active and inactive JPEGs signed and retrieved; listing matched original inventory plus all three temporary objects, including hidden/unattached fixtures. |
| e. Signed-out access | PASS: no usable links, empty/denied listing, and all three direct private-object downloads rejected with HTTP 400. |

## Fixtures and cleanup
Created through staff-authorized APIs:
- Active album: `d9259b40-2557-4202-8d83-eaa52e2995f4`.
- Inactive album: `eecbec55-3416-40b6-994f-7657419117a5`.
- JPEG keys:
  - `zz-album-security-1d15e667-5dc9-4679-b153-c1affeeab183-active.jpg`
  - `zz-album-security-1d15e667-5dc9-4679-b153-c1affeeab183-inactive.jpg`
  - `zz-album-security-1d15e667-5dc9-4679-b153-c1affeeab183-orphan.jpg`

All two albums and three objects removed. Cleanup returned no errors. Full original album rows and storage object inventory matched the pre-test baseline. The permanent child's complete row matched its pre-test baseline. Staff was not linked to any student; no account changes were made.

The confirming re-run also passed all five tests and cleaned up its separate two albums (`79fac272-a332-4e51-a31c-411779829dda`, `1c3bfd66-40c0-4b77-abbf-7a27385c1fc1`) and three JPEGs (`zz-album-security-879a42d0-60ac-4669-bc42-550736bee224-active.jpg`, `zz-album-security-879a42d0-60ac-4669-bc42-550736bee224-inactive.jpg`, `zz-album-security-879a42d0-60ac-4669-bc42-550736bee224-orphan.jpg`). Original albums/object inventory/permanent child again matched baseline. Temporary session file was deleted after verification. Preview build readback at 01:40:35 UTC: build OK.

## Database readback
- New helper is SQL, STABLE, SECURITY DEFINER, `search_path=public`.
- It allows admins, or active members when an active album's `cover_image_url` exactly equals the requested bare object key.
- Function ACL: owner, authenticated, and existing default service-role execution; no PUBLIC or anonymous execute. Readback confirms `anon_execute=false`, `authenticated_execute=true`.
- Existing `is_active_member` definition and privileges match pre-change readback exactly.
- Album-cover SELECT: authenticated only, `bucket_id = 'album-covers' AND public.can_read_album_cover(name)`.
- All three admin album-cover policies (INSERT/UPDATE/DELETE) match pre-change expressions/roles/commands byte-for-byte. All four post-image policies likewise remain identical.
- Bucket `public=false`, `file_size_limit=5242880` (5 MB), existing MIME list `image/jpeg`, `image/png`, `image/webp`. No settings changed and no workaround attempted.

## Quick scan — 2026-11-23 01:40 UTC
Completed with **eight existing findings: one warning and seven notices; no errors or new findings**.
- Album-cover exposure error is absent after this fix.
- Existing app-settings read warning remains.
- Existing shared-reference notices remain for belt ranks, belt systems, holidays, class schedules, point guidelines, programs, and leaderboard divisions. The scanner now classifies leaderboard divisions as a notice rather than the prior warning; its policy was not changed.
- No findings were dismissed, ignored, or manually marked fixed. Quick scans do not refresh the older deep-scan warnings. No new deep scan was requested or started for this fix.

## Separate role-lookup item
Any signed-in family can ask whether a known account ID has a particular role, including admin. This reveals role membership, not family records or the ability to grant/change roles; it is outside this approved scope and remains unchanged.

## Dependencies, credentials, and limitations
- `package.json` diff: empty. `bun.lock` diff: empty. **No dependency changes.**
- Tracked private-credential pattern check: zero matches; no fixture sessions, tokens, passwords, or private keys committed. Temporary sessions remain only under `/tmp/browser/` for the test run and are removed afterwards.
- Already-issued signed URLs can remain usable until their unchanged one-hour expiry after an album is deactivated; new unauthorized signing/listing is now denied.
- Separate post-image bucket MIME configuration and hosted signup-rate settings remain previously documented open items; neither was touched.