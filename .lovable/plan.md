# Round 15 — security tidy, site address, vertical video

## A — Revoke over-broad EXECUTE grants
One append-only migration:
- `REVOKE EXECUTE ... FROM PUBLIC, anon` on `get_curriculum_for_student(uuid)` and
  `get_curriculum_for_all_children()`; `GRANT EXECUTE ... TO authenticated`.
- Function bodies untouched. `check_invite_code` untouched (anon must keep it).
- No trigger-function grants, no `profiles` RLS change, no gallery policy change.
Then run the verification query you supplied and paste its rows.

## B — Delete package-lock.json
`rm package-lock.json`, no regeneration, and confirm `bun.lock` bytes are unchanged
(hash before/after).

## C — Site address in auth emails
In `src/routes/lovable/email/auth/webhook.ts`, point `SITE_URL` at
`https://portal.tigersdenmartialarts.com`. `SENDER_DOMAIN`, `FROM_DOMAIN` and the
`from` line stay on `notify.tigersdenmartialarts.com`. Same change checked in
`preview.ts` only if it hardcodes the same URL.

## D — Portrait video support
- Migration: `video_orientation text` on `curriculum_items` and `technique_library`,
  nullable, default NULL, `CHECK (video_orientation IN ('landscape','portrait'))`.
  NULL keeps today's 16:9 behaviour.
- Admin forms (`admin-content-tabs.tsx` curriculum add + `ItemVideoEditor`, and
  `admin-technique-library.tsx`): a "Video shape" two-option control —
  "Landscape (wide)" / "Portrait (tall, filmed on a phone)". No auto-detection.
- Read paths: add `video_orientation` to the two SQL readers
  (`get_curriculum_for_student`, `get_curriculum_for_all_children`,
  `get_technique_library`) by `CREATE OR REPLACE` with the column appended to the
  returned row — entitlement logic (auth.uid()/parent_id/published) copied
  byte-for-byte, no filter changes.
- `video-facade.tsx`: new `orientation` prop. Portrait renders
  `aspect-[9/16] max-h-[70svh] mx-auto w-auto` inside the existing frame so it does
  not run off a desktop screen; landscape/NULL keeps `aspect-video`. Play button,
  runtime badge, title overlay, focus ring and `variant="cover"` work in both.
- Pass the flag through curriculum and techniques cards.

## E — Thumbnail resolution
- `youTubeThumbnailSrcSet`: add `sddefault.jpg 640w` and `maxresdefault.jpg 1280w`;
  `THUMBNAIL_WIDTH/HEIGHT` become 1280×720.
- `maxresdefault` fallback: `onLoad` in `VideoFacade` checks
  `naturalWidth <= 160` (YouTube's 120×90 placeholder) and, if so, drops srcSet and
  pins `src` to `hqdefault.jpg`. Degrades, never a grey box.
- Resting thumbnail `opacity-85` → `opacity-100` with a subtle hover brightness
  transition retained.

## Verification
Execute every added/changed function and report what it returned; create clearly
labelled test rows only, delete them after; existing records untouched. Report
typecheck + build.
