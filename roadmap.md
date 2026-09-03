# Roadmap

- [ ] Round 45: admin-only "Scheduled" marker on dashboard + Announcements page, badge extracted to one shared component (presentational only, no migration, no filtering).
- [ ] Round 45 follow-up: decide + implement freshness handling so the badge cannot go stale after a post's publish time passes.
- [x] Round 50: Winner's Circle — phone row as one aligned unit; collapsed view = exactly one full row via `repeat(auto-fill, minmax(min(<measured>, 100%), 1fr))` with the count read from resolved CSS (sync, pre-paint); comment-only fix at tournament-results-section.tsx:48.
- [ ] Round 51: archive + delete parent accounts (admin-only). `profiles.archived_at` migration; archiving cascades to `students.active`; delete only from archived state, refused server-side when ANY student row points at the account (active or archived); deletion order auth.users FIRST, then profiles, then user_roles, via a server function using the service role + GoTrue Admin API; display-only "no students" badge/filter. Service role key must never enter .env or any tracked file. Leave brittanyrey1214@utexas.edu for Britt to delete by hand.
