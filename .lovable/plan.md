Answers locked in: tournaments seed as **ISKF Open Jan 23 2027**, **Jiu Jitsu World League Aug 22 2026**, **IBJJF Open Oct 10 2026**; Privacy §5 hosting name = **Lovable**.

## Migrations (5, applied in order)

1. **Photo consent + media release** — adds `photo_consent`, `photo_consent_updated_at`, `media_release_accepted_at`, `media_release_version` to `profiles`; regrants `UPDATE (family_name, photo_consent, photo_consent_updated_at)` only.
2. **`check_invite_code(_code text)`** — SECURITY DEFINER boolean, EXECUTE to `anon` + `authenticated`. Returns only true/false.
3. **`gallery_albums`** + RLS/grants; seeds exactly 3 rows (Summer Camp, Swat Team, Evening Classes — Last Week) with `external_url = ''`, `cover_image_url` null.
4. **`curriculum_items`** + RLS/grants. Seeded with nothing.
5. **`handle_new_user()` rewrite** — same SECURITY DEFINER / `search_path = public`; records media release version + timestamp, then in an exception-guarded block auto-links `pending_student_imports` rows matching `lower(trim(email))`, skipping duplicates (same first/last/parent_id), deleting parked rows on success. Any failure logs and lets signup succeed. Plus case-insensitive indexes on `lower(profiles.email)` and `lower(pending_student_imports.parent_email)`.

Invite-code enforcement inside the trigger stays exactly as-is.

## Frontend work by section

**1 — Consent:** new `/settings` route (family name, consent switch with the exact helper text, read-only media-release date, toast on success + error handling); "Settings" added to sidebar.

**1c/1d:** required (not pre-checked) consent checkbox on Sign up with Privacy Policy / Terms / Media Release links opening in new tabs; `media_release_version: "2026-08-01"` passed in `options.data`. New public `/media-release` route with the verbatim text.

**2 — Privacy policy:** all `[CONTACT EMAIL]` → `mailto:leaguecity.tigersden@gmail.com`; bracketed sentences removed and §3/§5 rewritten as specified (hosting = Lovable); Last Updated → Aug 1 2026; §3/§7 link to `/settings`; new §1 consent bullet; new §11 linking `/terms`.

**3 — `/terms`:** new public route, verbatim, same layout components; footer link + signup checkbox link.

**4 — Password reset:** "Forgot password?" on Sign in → in-card reset view → `resetPasswordForEmail` with `${origin}/reset-password`; identical confirmation regardless of account existence. New public `/reset-password` waits for `PASSWORD_RECOVERY`/session, shows loading, two fields (min 8, match check), `updateUser`, toast → `/`; expired links get a plain-English message + link to `/auth`.

**5 — Signup UX:** on success the card is replaced by a "Check your email" panel naming their address, with "Back to sign in"; no navigation. Unconfirmed sign-in error mapped to a specific friendly message.

**6 — Invite codes:** RPC pre-check before `signUp`; friendly message and stop on false; trigger untouched; fallback matches `/invite code/i` or `/database error/i`; codes uppercased + trimmed on entry and lookup.

**7 — QR signup:** `/auth?invite=CODE` switches to Sign up, prefills read-only with "Invite code applied" + "Use a different code". Add `qrcode.react`; per-code "Show QR code" dialog (accessible title, Esc-dismissible) with QR of `{origin}/auth?invite=CODE`, selectable URL, Download PNG, label/expiry/remaining uses. "Gym poster code" preset: max_uses 200, +90 days, label `Gym poster — {Month} {Year}`.

**8 — Gallery:** rewritten as a card grid off `gallery_albums`; branded red-gradient + camera fallback tile; empty `external_url` → disabled "Album coming soon"; hardcoded "248 Photos"/"17 Events" and the FILTERS bar deleted; empty state; alt text from titles; consent notice linking `/settings`. New Admin "Gallery Albums" tab (create/edit/reorder/toggle/delete, `https://` validation). `GALLERY` removed from mock-data.

**8e consent rule:** albums are not student-identified, so nothing on this page is gated per-student; the consent notice + Settings toggle is the control surface. Flagged below.

**9 — Curriculum:** page reads `curriculum_items`, grouped by `BELT_PROGRESSION` with category subheadings, duration removed; empty state copy shown and accordion hidden while empty. New Admin "Curriculum" tab. `CURRICULUM` removed from mock-data.

**10 — Tournaments:** placeholder → `League City, TX`; helper text under location; three announcement rows seeded with name + discipline + date only, every other field empty string. No venues, links, times, fees invented.

**11 — Security headers:** set in the app's server layer (`src/server.ts` response middleware) on HTML document responses, exactly the header set given; `netlify.toml` and its comments kept as a second layer. Verification steps in the summary.

**12 — Smaller fixes:** password min 8 + helper text; generic sign-in failure message (real error `console.error`-only); delete `src/integrations/lovable/index.ts`, drop `@lovable.dev/cloud-auth-js`, sweep imports (error-reporting file untouched); `_authenticated/route.tsx` gets one retry with backoff and falls back to a valid cached session on transport errors, redirecting only on genuine no-session; accessibility pass on every new element.

**13 — Linking:** manual add parks to the waiting list via confirm dialog instead of erroring; new top-level Admin **"Linking"** tab (CSV importer + unlinked list + count badge) with a searchable "Find parent" picker; "Needs attention" panel above the tab bar with the three clickable counts, collapsing to one muted line at zero; parent dashboard shows the "getting your family set up" panel when they have zero students, keeping announcements + schedule and hiding leaderboard/attendance; all email comparisons lowercased/trimmed client-side too.

**14 — Copy + edge cases:** `plural()` helper used for days/classes/points/students/absences/albums/uses, "≈" dropped; hero handles no `next_test_date`, White belt 0%, and Black belt (framing switches to a "Black Belt — journey complete" state). Supabase redirect URL guidance delivered in the summary.

## Things I will not fill in
Gallery album URLs/covers/dates/descriptions, all curriculum items, and every tournament field beyond name/discipline/date. Those stay blank for you.
