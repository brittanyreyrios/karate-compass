# Fix date-only columns rendering one day early

Front-end only. No migration, no column change, no layout change — only the value shown.

## How date-only vs timestamp is told apart

A column is date-only when the value is a bare `YYYY-MM-DD` string (Postgres `date`):
`next_test_date`, `start_date`, `event_date`, `event_end_date`, `tournament_date`,
`occurred_on`, `registration_deadline`, `expiry` form inputs. Those go through the
helpers. Anything ending in `_at` (`created_at`, `updated_at`, `starts_at`, `ends_at`,
`closes_at`, `changed_at`, `expires_at`, `acknowledged_at`, `media_release_accepted_at`)
is a `timestamptz` ISO string with an offset and keeps `new Date()` untouched.
`generated types.ts` confirms the SQL types.

## 1 — src/lib/date-only.ts becomes the single approach

Keep `formatDateOnly` and `formatDateRange`, add:

- `parseDateOnly(value): Date | null` — local-midnight Date from `YYYY-MM-DD`.
- `formatDateOnlyLong(value)` — `Nov 10, 2026` (`month: short, day, year`).
- `formatMonthYear(value)` — `Nov 2026`, for "Training Since".
- `daysUntilDateOnly(value): number | null` — difference between two *local calendar
  dates* (both floored to local midnight, `Math.round` of the ms difference / 86400000),
  so 8am and 11pm on the same local day give the identical answer.
- `yearsSinceDateOnly(value): number | null` — for `yearsTraining`.

No new date logic lands in components.

## 2 — Sites changed

- `src/routes/_authenticated/index.tsx`
  - `daysToTest` (`next_test_date`) → `daysUntilDateOnly`
  - `yearsTraining` (`start_date`) → `yearsSinceDateOnly`
  - Next Belt Test card date (`next_test_date`) → `formatDateOnlyLong`
  - "Training Since" stat (`start_date`) → `formatMonthYear`
- `src/routes/_authenticated/admin.tsx`
  - "Currently set for …" + `daysAway` (`next_test_date`) → `formatDateOnly` / `daysUntilDateOnly`
- `src/components/tournament-card.tsx` — days counter (`event_date`) → `daysUntilDateOnly`
- `src/components/admin-announcements-manage.tsx` — noon hack on `event_date` → `formatDateOnly`
- `src/routes/_authenticated/gallery.tsx` — noon hack on `event_date` → `formatDateOnlyLong`
- `src/routes/_authenticated/calendar.tsx` — noon hack on `registrationDeadline` → `formatDateOnly`

The CSV-import `new Date(row.start_date)` in admin.tsx is a validity check that then
re-serialises to `YYYY-MM-DD`; it will be switched to string validation via
`parseDateOnly` so no shift can occur there either.

## 3 — Evidence to report

- `git diff --stat`
- full final source of `src/lib/date-only.ts`
- the changed-site list with the column each renders
- parent screenshot of Billy's Next Belt Test card reading Nov 10, 2026 with its
  days counter, plus the admin panel showing 10 Nov
- two computed `daysUntilDateOnly` values, one evaluated at an early-morning local
  time and one late-evening, printed side by side
- the `rg` search proving no raw `new Date()` remains on a date-only value, and that
  no `_at` timestamp rendering changed
