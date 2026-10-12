# Round 59 — Images on announcements and polls

Starting commit: `c408c3cad463c01b7603123dcd5b43ffaf0c43dd`

## Shared helpers: a sibling module, not a refactor

I'll add a new `src/lib/post-images.ts` that copies the conventions of `album-covers.ts`:
- **Stored value:** either an object key or an absolute URL.
- **Names:** UUID-prefixed object names (`<row-uuid>-<timestamp>.jpg`).
- **Size:** 1200px longest edge, JPEG 0.85, 5 MB cap, image-only check.
- **Signing:** batched signed URLs (`signPostImages`, `usePostImageUrls`), plus a resolver (`postImageSrc`) and `deletePostImageObject`.

It points at the `post-images` bucket. `album-covers.ts` is not edited at all, not even its imports. Why: parameterizing would change every gallery call site, and a quiet break there is the worse outcome. The cost is about 60 lines of near-duplicate code. The pure helpers (`downscaleImage`, `validateCoverFile`, `isExternalCover`) are bucket-independent, so I'll import those from `album-covers.ts` instead of copying them. That reads the file but doesn't change its behavior.

**Media Gallery proof:** the staff fixture uploads a cover to a temporary "ZZ TEST R59 album", it displays, then I delete it and show the object gone from `album-covers`.

## Storage

- Create `post-images` with the bucket tool: private, 5MB limit. The tool can't set allowed types, so the JPEG/PNG/WebP rule is enforced in the app (the album-covers note in AGENTS.md says the same). Uploads are always re-encoded to JPEG anyway. I'll read the settings back from `storage.buckets`.
- Policies on `storage.objects` (migration), mirroring album-covers:
  - SELECT `TO authenticated USING (bucket_id = 'post-images')`
  - INSERT / UPDATE / DELETE `TO authenticated` with `has_role(auth.uid(),'admin')`
- **Plain statement:** any signed-in user can sign any object in this bucket. The only thing hiding a scheduled announcement's image is its unguessable UUID-prefixed name. RLS hides the row, not the file.

## Schema (same migration, `drizzle/migrations/`)

Four nullable columns, no RLS change to existing tables:
- `announcements.image_url text`, `announcements.image_alt text`
- `polls.image_url text`, `polls.image_alt text`

They follow the `cover_image_url` key-or-URL convention.

## Admin UI

- Post Announcement form, Manage Announcements edit, and the poll editor get the same control as the gallery cover: upload, preview, replace, remove. There is also an optional "Image description (alt text)" field.
- Replacing or removing an image deletes the old object.
- Deleting an announcement or poll deletes its object after the row delete succeeds, the same order the gallery uses.
- Nothing is required.

## Parent rendering

- **Announcement feed card, detail view, and polls page.** The image sits at the top of the card at full card width. Height is capped with `max-h-80` (320px) and `object-contain` on a muted backdrop, so a tall portrait photo is letterboxed instead of pushing the card down. Alt is `image_alt`, or the title/question when blank. No image means no element at all, so cards without an image are unchanged.
- **Tournament-derived cards (dashboard Upcoming Tournaments, `TournamentCard`): no image.** The image shows on the announcement itself in Announcements. That protects the timeline layout from Rounds 38/40/42/50. The placement helpers and Winner's Circle are not touched; I'll show a `git diff` of those files as empty.
- **Dashboard School News previews: no image** (text previews only).

## Safe parent-side testing (no real family can see test posts)

- **Test announcement "ZZ TEST R59 …"** gets `publish_at` = 2099-01-01. The existing announcements RLS already hides scheduled rows from every parent, so no family can see it at any point.
- **Test poll** stays `published = false`, so no family can see it or vote.
- **Showing it to zz.test.negative:** in the headless browser only, signed in as zz.test.negative, I intercept that one browser's announcements and polls responses and add the test row (same columns the database returns). The page then renders it with the real parent components, and the image is signed with zz.test.negative's own session through the real bucket policy.
  - Honest limitation: the row reaches that one test browser by injection, not by the parent's own query. The image signing and display are real.
- **Scheduled-image proof:** the same account without interception does not get the row. I'll show the parent query result and an empty page.
- **Signed-out refusal:** a signed-in user creates a signed URL, then a signed-out request to the object without signing is shown refused.
- **Responsive:** five widths (390, 768, 1024, 1025, 1536) with `body.scrollWidth` vs viewport, including a tall portrait test image. Before/after screenshots of one existing announcement and one existing poll with no image.
- **Cleanup:** I delete both test rows through the admin UI, then show `storage.objects` has none left for this round.

## Not touched

`album-covers.ts`, Media Gallery, `gallery_albums`, poll options/votes/rules, the four `.eq("published", true)` filters, belt-test, auth, guardian and points-period paths.
