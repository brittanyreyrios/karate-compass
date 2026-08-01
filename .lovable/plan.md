# Plan

I explored the code first. Some of what you described has moved since last round — noted below so the plan matches reality.

## Findings that change the plan

- `src/lib/mock-data.ts` no longer exists. `CLASS_NAMES` and `CLASS_CATALOG` now live in `src/lib/dojo-constants.ts` (a config file, not "mock data"). Section C0's rename concern is already satisfied by location; I'll still move the timetable to the database and delete `CLASS_CATALOG`.
- `class_schedules` **already has** `days`, `time_start`, `time_end`, `location`, and 11 of the 12 classes are already seeded with the exact catalog values. **"Adult Striking" (Mon/Wed 7:15–8:00pm, V12) has no row** — I'll add it. So C0 becomes: seed the missing row + make the four columns editable in the admin Class Schedules tab + delete `CLASS_CATALOG`.
- Current grep results for the numbers/opt-in language (full list in Section A below).

## Questions (please answer; I'll start Section A only after)

1. **Published domain (needed for A2 and A4).** The app isn't published yet and has no custom domain, so I have no real hostname. For A2 I plan to key production off `process.env.NODE_ENV === "production"` plus excluding `*.lovable.app` preview hosts — but if you have a custom domain planned (e.g. `portal.tigersdenmartialarts.com`), tell me and I'll match on it explicitly instead of by exclusion. Until you publish, I will not invent a domain.
2. **Existing placeholder tournaments (B).** Last round seeded tournament rows into `announcements`. Do you want the three real events to (a) replace those rows outright (delete + insert), or (b) be added while I leave the old rows for you to delete from the admin UI?

## Section A — first checkpoint (fixes only)

**A1 — legal contradiction**
- `privacy-policy.tsx` §3: replace the 30-day sentence with your approved 14-day wording verbatim, and add your approved separate social-media/website 30-day sentence as its own clause.
- `media-release.tsx` line 99: reword the social clause to your approved sentence so the 14 vs 30 numbers read as two distinct commitments.
- Grep report. Current instances of the numbers:
  - `media-release.tsx:98` — 14 days, Portal ✅ keep
  - `media-release.tsx:99` — 30 days, social/website → reworded
  - `privacy-policy.tsx:140` — 30 days → becomes 14 days (Portal) + separate 30-day social clause
  - Settings page currently has **no** takedown timeframe text at all — I'll add the 14-day Portal figure there so it matches.

**A2 — CSP actually applied**
- `src/server.ts`: keep the three baseline headers unconditionally; add, in production only, the exact CSP you specified, `X-Frame-Options: DENY`, and HSTS.
- Signal: `process.env.NODE_ENV === "production"` **and** the request hostname is not a Lovable preview host (`*.lovable.app` / `localhost`). Rationale: the editor preview is the only thing `frame-ancestors 'none'` breaks, and it is identifiable by hostname; `NODE_ENV` alone is unreliable because published Lovable builds and preview builds are both production builds.
- No `unsafe-eval`; `unsafe-inline` stays only in `style-src` as you wrote. If anything in B–G needs an allow-list entry I'll report it rather than loosen the policy.
- Comment rewritten to describe the conditional accurately. `netlify.toml` is dead config on Lovable hosting — I'll note it, and delete it only if you say so.

**A3 — invented class fallback**
- New migration recreating `handle_new_user()` with the auto-link fallback `'Unassigned'` instead of `'Little Tigers'`.
- Admin Linking tab: prominent "Unassigned class" section listing students with `class_name = 'Unassigned'` so staff fix them. No guessing a real class.
- I will not backfill/relabel existing rows unless you ask.

**A4 — Supabase auth URLs.** Answered in the summary message, not code. Short version I'll give you: Site URL = your published URL once you publish (blank today — I won't invent one); redirect allow-list = preview URL, published URL, plus a wildcard for preview builds, with `/reset-password` paths. Full exact strings in the checkpoint report.

Then I stop, commit, and summarize Section A.

## Sections B–G — after your sign-off on A

- **B** Real tournament data (exact values, blanks left blank for ISKF), tournaments editable in admin, placeholder location text → "League City, TX".
- **C** `class_schedules` completion + `events` table (RLS/grants/index as specced) + `/calendar` route: mobile agenda default, desktop month grid via existing `react-day-picker`, class instances computed client-side, month ±1 queries; admin Events tab with the announcement-link lifecycle (create/update/unlink-delete/delete-prompt); dashboard "Next up" strip; keyboard + non-colour-only labelling.
- **D** `polls` / `poll_options` / `poll_votes` with partial unique indexes, parent-child-enforcing RLS, deadline-enforcing update/delete policies, `get_poll_results()` (SECURITY DEFINER, counts only, honours `results_visible`) plus a separate admin-only breakdown function; `/polls` route, dashboard card, badge, past-polls section, fieldset/legend a11y. No free text, no comments.
- **E** +1/+5/+10 buttons (44px targets), "+5 · now 47" confirmation, per-student session tally, tappable 3-second Undo that deletes the audit row, `point_events` table written from all three write paths. E6 reason tags: I'll attempt the chevron variant and drop it (and say so) if it complicates the undo window.
- **F** Signup pre-checked optional consent checkbox, DB default stays `false`, no retroactive flips, all four "opt-in" statements reworded (also `terms.tsx:100` and `auth.tsx:395`, which your list didn't mention but contradict the new behaviour), Settings helper line. F5: I'll verify whether any student-identifying image exists today and report plainly — I expect the answer is "gallery albums are external links with no per-student images, so nothing is currently gated".
- **G** `photo_consent` + timestamp in the Parents tab with an OFF filter and loud styling; `photo_consent_events` table with a column trigger; persistent unacknowledged badge in "Needs attention" with Mark reviewed; point-of-use banner in Gallery Albums/Events; camera-slash icon on the attendance row if it doesn't crowd the iPad layout. No email notifications.
