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
