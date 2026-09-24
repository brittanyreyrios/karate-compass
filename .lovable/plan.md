# Round 55 — three small fixes

## A — Sign-up / sign-in placeholders
Only two placeholders exist on those forms that read like real answers:
- Invite code: `TIGER123` -> `e.g. TIGER123`
- Family name: `Rodriguez` -> `e.g. Rodriguez`

Email and password fields have no placeholder today; I will not add any. No label, help text, validation or `required` change.

## B — Class days and times

### Rename finding (stated before any code): rename does NOT ship this round
- `students.class_name` goes stale. The only trigger that writes it (`sync_primary_class_name`) fires on `student_classes` changes, not on `class_schedules`. Renaming a class leaves every enrolled student carrying the old label.
- Worse than stale: the parent dashboard's class card looks the schedule up by name (`.eq("class_name", student.class_name)`), so after a rename every enrolled child's card would show nothing — days, times and location all gone.
- `class_holidays` is keyed by class name text (0 rows today, but a future holiday would detach from a renamed class). `pending_student_imports.class_name` is also text.
- `class_student_counts` is NOT stale — it counts live through `student_classes` by id; only the admin tab then matches the result back by name, which stays consistent because both come from the same row.

Making rename safe needs either a database change (out of scope) or switching those reads to ids — a separate round.

### What lands
In the Classes tab row editor (`ClassSchedulesTab` in the admin page): add Days, Start time, End time as plain text inputs, saved on blur only when the value changed — copied from the existing Location field's pattern. Add the three columns to that tab's select. Values stored verbatim (`Tue/Thu`, `5:15pm`); no pickers, no reformatting, no trimming beyond what Location already does. The 12 existing rows are only touched if an admin edits one.

Verification: snapshot all 12 rows' days/times before, edit one real class, re-read the row, show it on a parent dashboard (via a clearly labelled ZZ TEST student in that class on the test account, deleted afterwards), restore the original value, and diff the other 11 against the snapshot.

## C — Home-screen icon
- Copy the four uploaded PNGs byte-for-byte into `public/` (plain `cp`, checksums compared).
- Add `public/manifest.webmanifest`: name "Tiger's Den Parent Portal", short_name "Tiger's Den" (measured against a home-screen label width in the browser before settling), start_url "/", display "standalone", background_color and theme_color `#08090B`, the three icons (512 maskable marked `purpose: "maskable"`).
- In the root route head: apple-touch-icon link, manifest link, `theme-color` meta, `apple-mobile-web-app-title` meta. Existing favicon line untouched; the logo file untouched.
- No service worker, no caching, no install prompt — I will grep to prove none exists.
- I cannot install to a real iPhone or Android home screen from here; I will say so and show the files served correctly plus the manifest parsed in a browser instead.

## Untouched
No migration, RLS, grant or database function. Nothing in the Round 54 belt-test path or Round 54b auth path.
