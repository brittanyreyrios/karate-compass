# Copy a curriculum requirement to other ranks

Front-end only, confined to `src/components/admin-content-tabs.tsx` (plus one small
dialog component if the row grows unwieldy). No migrations, no schema changes, no
policy changes. `next_curriculum_sort_order`, the entitlement/curriculum functions,
`handle_new_user`, `server.ts`, the CSP and `client.ts` are untouched.

## What gets added

On every curriculum requirement row, next to the existing "Move to" control, a
**Copy to…** button opening a dialog:

- **Destination list** — the same options "Move to" offers: all four tiers
  ("All Beginner students" …) and every rank with its belt system named. Rendered as
  checkboxes so several can be picked at once.
- **The row's own current target is not offered at all** — if the item sits on Camo
  Green, Camo Green is absent from the list, so a row can never be duplicated onto
  itself.
- **Live preview**, updating as boxes are ticked:
  - "This will create 3 new requirements." (count of destinations that will actually
    be written, after skips)
  - One line per destination with the plain-language audience sentence from the
    existing `rowAudience`/`audienceSentence` logic, reused as-is.
  - Any destination that already has a requirement with the same technique and the
    same `video_youtube_id` is listed separately as **"Skipped — already there"**,
    named, and excluded from the count.
  - Standing sentence: "These become separate requirements. Editing one later will
    not change the others."
- **Confirm** writes the copies. Cancel writes nothing.

## How a copy is written

Per destination, sequentially:

1. Call the existing `next_curriculum_sort_order` RPC with
   `(_belt_rank_id, _curriculum_tier)` for that destination — the same advisory-locked
   path `retargetItem` uses. No second copy of that logic, and the source's
   `sort_order` is never carried across.
2. Insert one row copying `technique`, `category`, `notes`, `program_id`,
   `video_youtube_id`, `video_title`, `video_seconds`, `video_orientation`, with
   exactly one of `belt_rank_id` / `curriculum_tier` set (never both, never neither —
   guaranteed by the destination list's shape) and the fresh `sort_order`.

The source row is never updated or read-modified. Copying is additive only.

**Partial failure is reported honestly.** Each destination's outcome is collected;
the result toast/summary names which destinations were created, which were skipped as
duplicates, and which failed with their error. If any failed, it is not reported as a
success.

Admin-only through the existing curriculum RLS policies; nothing about permissions
changes.

## Verification (real output, ZZ-labelled rows, deleted afterwards)

- Create one `ZZ` requirement with video fields on a single rank; copy it to three
  destinations across different belt systems, one of them a tier. Paste the resulting
  rows' `id`, `belt_rank_id`, `curriculum_tier`, `sort_order` and video fields —
  showing distinct ids, correct targets, copied video data, and each `sort_order` at
  the end of its own destination group.
- Show the source row unchanged, `sort_order` included.
- Screenshot the admin list showing each copy at the bottom of its destination group.
- Show the source's own target is not selectable.
- Re-run the same copy and paste the duplicate-skip message naming the destinations.
- Paste the exact preview text, including the "independent copies" wording.
- `curriculum_items` row count before and after, all `ZZ` rows deleted, and
  confirmation that no constraint, function or policy changed.
