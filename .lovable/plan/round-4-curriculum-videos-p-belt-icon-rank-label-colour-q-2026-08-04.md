# Round 4 — Curriculum videos (P) + belt icon & rank label colour (Q)

## Section P — one video per curriculum requirement

### P1 Migration — new columns on `curriculum_items`
`video_youtube_id text`, `video_title text`, `video_seconds integer`, all nullable. A requirement with no video behaves exactly as today. No new table, no new access rules.

### P2 Extend the entitlement function
`DROP FUNCTION get_curriculum_for_student(uuid)` and recreate it with the three video columns added to the return type. Everything else copied byte-for-byte: ownership check, NULL-rank early return, cumulative rank + tier logic, `is_current`, `group_label`, and the ORDERING CONTRACT comment (unchanged in meaning). Entitlement stays server-side — a Green belt's browser never receives a Brown belt video ID, and there is no client-side video filtering.

### P3 Admin — paste a link, not an ID
Belt Curriculum tab, both the add form and the inline row editor get a "YouTube link" field.

A shared `extractYouTubeId()` helper accepts `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, bare 11-char IDs, and strips extra query params — including the real-world `&list=...&index=2` shape, which is covered by a unit test using Britt's exact URL.

Validation `^[A-Za-z0-9_-]{11}$`; on failure: "That doesn't look like a YouTube link. Copy the address from your browser's address bar while the video is playing."

Once a valid ID is present, show the `hqdefault.jpg` thumbnail preview plus the ID so staff can confirm the right video before saving. Title is a manual optional field — YouTube titles cannot be read without an API key, so we will not auto-fill it (see Blanks below). A "Remove video" action clears all three columns. No video IDs are seeded, invented, or guessed.

### P4 Parent UI — click-to-load facade
New `VideoFacade` component. Default state renders only the thumbnail image, a play-button overlay, the optional title, and a runtime badge when `video_seconds` is set. Nothing is requested from YouTube beyond that image.

On activation it swaps in a single iframe: `https://www.youtube-nocookie.com/embed/<ID>?autoplay=1`, `title` = the technique name, `loading="lazy"`, `allowfullscreen`. One player at a time; no iframe on page load; no autoplay on load.

The facade is a real `<button>` — keyboard focusable, Enter/Space, visible focus ring, `aria-label="Play video: <technique>"`.

Requirement cards that carry a video get a small play icon, including inside the collapsed "Already earned" accordion.

### P5 CSP
Add exactly one directive to `CONTENT_SECURITY_POLICY` in `src/server.ts`: `frame-src https://www.youtube-nocookie.com`. `script-src` is untouched, `youtube.com` is not added, nothing else moves. `img-src` already contains `https:`, so thumbnails are covered — confirmed by reading the existing policy, not changed.

### P6 Privacy Policy
New short subsection on `/privacy-policy`: videos are hosted on YouTube (Google) and embedded; nothing is requested from YouTube until a family clicks play; once played Google may collect information as described in Google's privacy policy (linked); we use the no-cookie embed domain. No claim that tracking is blocked. Then grep `privacy-policy.tsx`, `terms.tsx`, `media-release.tsx`, `settings.tsx` for contradictions and report the result.

### P7 No premium coupling
No premium checks anywhere in this work. Access is belt entitlement only.

### P8 "Dojo Basics" group on /curriculum
A third group rendered above "Working on now": heading "Dojo Basics", description "Etiquette and fundamentals — for every student, at every belt." It contains tier-wide items (`belt_rank_id IS NULL`) with `curriculum_tier = 'beginner'`, for every student regardless of rank.

Those items are removed from both "Working on now" and "Already earned" first, so each item renders exactly once. Expanded by default, styled lighter than the current assignment. If there are none, the section is omitted entirely. Grouping-only change; no schema change.

## Section Q — belt icon and rank label colour

### Q1 `BeltSwatch` becomes a horizontal belt icon
Rewrite the swatch in `src/components/belt-chip.tsx` as inline SVG: a band running left-to-right, a centre knot, two short tails below the knot. Driven entirely by `pattern` / `color_primary` / `color_accent`.

- Solid — band and knot filled with `color_primary`.
- Stripe — band in `color_primary` with the `color_accent` stripe running *along* the length.
- Camo — current signed-off treatment kept: tonal blobs derived from `color_primary` plus the accent stripe along the length.
- Subtle outline on every variant so a white belt stays visible on dark backgrounds.
- Legible at ~24px wide (leaderboard list rows) as well as podium size; verified at both.
- `role="img"` and the existing aria-label wording (rank, system, pattern in words) preserved, so pattern is never colour-only.
- `sm` / `md` sizes kept.

Shared component only — no leaderboard-specific fork. Callers (leaderboard podium + list, dashboard, admin roster/student cards, curriculum) pick up the change automatically.

### Q2 Rank label badge tinted by belt colour
`leaderboard.tsx` renders rank names as `border-primary/40 text-primary` (brand red) in two places. Replace with a tint derived from the belt's own colour, falling back to `color_accent` where the primary is near-white so a stripe belt's badge is not invisible.

Contrast: rather than using raw hex, derive a lightened text tone in OKLCH and **measure** the ratio against the shipped dark card background for all 22 seeded ranks with a script; report the numbers and the minimum. Iterate the lightening until every rank clears 4.5:1.

Then grep the codebase for other `border-primary/40 text-primary` usages on rank/belt data and fix those; report exactly what was found and what was left alone (brand-emphasis uses stay red).

## Verification
- Migration applied, then typecheck/build clean.
- Contrast numbers measured and reported per rank, not asserted.
- Browser check: belt icon at 24px and podium size; curriculum page shows Dojo Basics, play icons, and a facade that loads no iframe until clicked (network panel confirms only the thumbnail request).

## Blanks — nothing invented
- No video IDs, titles, or durations are entered anywhere. Britt enters each one; `video_title` and `video_seconds` are optional manual fields.
- YouTube video titles cannot be fetched without a Google API key, so the admin preview shows the thumbnail and ID only — not an auto-read title. If you want auto-titles, that needs a YouTube Data API key.
