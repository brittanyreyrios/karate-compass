# Roadmap

- [ ] Round 45: admin-only "Scheduled" marker on dashboard + Announcements page, badge extracted to one shared component (presentational only, no migration, no filtering).
- [ ] Round 45 follow-up: decide + implement freshness handling so the badge cannot go stale after a post's publish time passes.
- [ ] Round 49: Winner's Circle — phone row as one aligned unit; collapsed view = exactly one full row via `repeat(auto-fit, minmax(<measured>, 1fr))` with the count read from resolved CSS (sync, pre-paint); comment-only fix at tournament-results-section.tsx:48.
