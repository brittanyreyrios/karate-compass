# Roadmap

- [x] Round 45: admin-only "Scheduled" marker on dashboard + Announcements page, badge extracted to one shared component (presentational only, no migration, no filtering).
- [x] Round 45 follow-up: decide + implement freshness handling so the badge cannot go stale after a post's publish time passes.
- [x] Round 50: Winner's Circle — phone row as one aligned unit; collapsed view = exactly one full row via `repeat(auto-fill, minmax(min(<measured>, 100%), 1fr))` with the count read from resolved CSS (sync, pre-paint); comment-only fix at tournament-results-section.tsx:48.
- [x] Round 51: archive + delete parent accounts (admin-only). `profiles.archived_at` migration; archiving cascades to `students.active`; delete only from archived state, refused server-side when ANY student row points at the account (active or archived); deletion order auth.users FIRST, then profiles, then user_roles, via a server function using the service role + GoTrue Admin API; display-only "no students" badge/filter. Service role key must never enter .env or any tracked file. Leave brittanyrey1214@utexas.edu for Britt to delete by hand.
- [x] Round 52: admin-only "Scheduled" marker on events — `publish_at` added to SELECT LISTS ONLY on the three parent-facing event queries (Calendar, dashboard "Next Up", `useTournaments()` events branch) plus `TOURNAMENT_COLUMNS`, rendered via the existing `ScheduledBadge`/`isScheduled`. Both tournament sources (announcement-derived and event-derived) get the badge through one uniform `publish_at` field on the `Tournament` shape. No predicate, filter, migration or policy change; the three `.eq("published", true)` client filters untouched (report-only). Month-grid tiles deliberately not badged — Britt to decide.
- [x] Round 54: dashboard "Next Belt Test" derives its date from class_schedules.next_test_date via student_classes (soonest upcoming, local-calendar-day comparison via toDateKey). students.next_test_date no longer read on the dashboard; no migration, no writes, no backfill. Report-only: everywhere students.next_test_date is still written/editable.

## Round 54b — unconfirmed-email sign-in
- [x] Delete test account, restore 9HLG5W95 used_count to 0
- [x] Dedicated test invite code "ZZ TEST — do not issue"; never spend real codes
- [x] isEmailNotConfirmed + shared message (no "below"); button sentence in auth.tsx
- [x] Resend button on sign-in, follows field, 60s countdown

## Round 55
- [x] A: placeholders -> "e.g. TIGER123", "e.g. Rodriguez"
- [x] B: days/start/end editable on Classes tab (save-on-blur). Rename held back — students.class_name and the dashboard class card are keyed by name.
- [x] C: four icons + manifest + head tags; no service worker

- Round 56: remove Training Since card, 4-card grid, fix class-catalog invalidation, permanent test child for zz.test.negative

- [x] Round 58 — two guardians per child (plan revised with 4 changes; awaiting approval)
  - R58 add: park-student.ts existing-child check must match via guardian link (fix)
  - R58 note-only: per-student poll double-count with two guardians (future round); admin.tsx:1575-1590 vote count doubles; parent-accounts.functions.ts:61 archive by parent_id

- [x] Round 63 — archive/restore must not reactivate quit children; R58 polish; settings helper line
  - add: other-guardian check excludes the profile being archived (profile_id <> this profile)
  - add: archive update includes .eq("active", true)

- [x] Round 57 — Dojo Points two-month Chicago periods (points_period_start), occurred_on Chicago default + date fix, copy
- [x] Round 66 — pre-link second guardian by email (pending_guardian_links + handle_new_user block + admin UI)
- [x] Round 62 — absence log (absence_events, mark_absent/remove_absence/check_in_student, Chicago dates, all-time tally)
  - add: DeleteStudentDialog counts absence_events + sentence; screenshot
- [x] R64 — signup email honesty: resend copy, staff bounce/spam marker (last 14 days), used-up invite code message
- [x] R60 — admin change parent login email (auth first, then profile; audit; notify; pending-row warnings)
  - add: duplicate check excludes target itself (repair out-of-step); test simulated out-of-step
  - add: refuse admin-role targets ("Staff accounts can't be changed here."); test on zzstaff
- [x] R67 — Manage Students stepper: toast+Undo, 1.5s per-student lock, period total
- [x] R59 — images on announcements & polls (post-images bucket, sibling module, admin pickers, parent rendering)
  - add: post-images allowed_mime_types jpeg/png/webp, read back all three
  - add: gallery proof album active=false, deleted after
  - add: test announcement no event_date, non-tournament category; any linked event publish_at 2099, delete
- [x] R65 — two-guardian poll counting (DISTINCT student on per-student polls, staff "guardians disagree"), restore uses family archived date, create-form "Discard draft" + leave-form image cleanup only when draft is truly lost
- [x] R68 — gym-time calendar (Part A), dashboard news thumbnail (B), no image backdrop (C), announcement delete removes linked events (D), gym-time event entry + Post Announcement times (E)
  - add: "(Houston time)" labels on every gym-time input
  - add: announcements.ts today → Chicago day; report before/after tournament list
  - add: Part D event-delete failure names the event left on the calendar

## Round 69 — black belt degrees
- [ ] Chip preview approved (incl. 6th at sm)
  - Final direction: no numbers on belts at any size; transverse gold bars at the hanging tip, plain Black unmarked. Preview all seven ranks at all used sizes, labelled leaderboard row, Black/2nd/5th/6th Journey at 390/1536, and labelled colour strips at Green and Black-path at 390. Phone colour strip wraps 4×2; Journey wraps 3×2. Report unlabelled badge locations; stop for approval, no database writes.
- [ ] Migration: belt_ranks.degree + 6 rows; students.personal_test_date
- [ ] Black Belt Journey bar; personal test date card + admin field
- [ ] Reports: rank-code check, admin curriculum editor groups, Jiu Jitsu card, screenshots, cleanup
