# Round 9 — Mobile layout breaks + inline query errors

## AG — Page-wide sideways overflow (app shell)

In `src/routes/__root.tsx`, the content column beside the sidebar is a flex item with
default `min-width: auto`, so it grows to the intrinsic width of the five nowrap
leaderboard tabs and drags the whole document wider than the phone.

- Add `min-w-0` to the `flex flex-1 flex-col` wrapper.
- Add `min-w-0` to `<main>` as well so route content can shrink inside it.
- No other shell change; the tab strip's existing `overflow-x-auto` then scrolls
  inside itself.

## AH — Review card wraps one word per line

In `src/components/google-review-card.tsx`, switch the row from
`flex flex-wrap items-center` to `flex flex-col items-start gap-4 sm:flex-row
sm:items-center sm:gap-5`. Keep `min-w-0` on the text column. Button becomes
`w-full sm:w-auto`. Keep the right padding that clears the dismiss X, and keep the
copy byte-identical.

## AI — Belt ladder on the dashboard overflows

Eight 48px swatches no longer fit at 360px. Rather than shrinking the icon
everywhere, add a dedicated responsive ladder size to `BeltSwatch`:

- New size key `ladder`: `h-[16px] w-[34px] sm:h-[22px] sm:w-12` — phone-sized on a
  narrow screen, identical to today's `sm` from the `sm:` breakpoint up.
- `src/routes/_authenticated/index.tsx` ladder uses `size="ladder"`, with
  `min-w-0 gap-1` on the row so nothing overflows. The current belt stays visible
  with no interaction.

Also re-check every other `size="sm"` usage at 360px and fix any that overflow:
`belt-picker.tsx`, `admin.tsx` (student rows), `admin-content-tabs.tsx` (two spots).
Findings reported per file.

## AJ — Inline "failed to load" states (no third party, no schema change)

Add one small shared component (`QueryErrorState`) rendering a plain-English message
plus a **Try again** button that refetches. No raw error text, no table names, no IDs,
nothing logged or stored.

Wire it into the parent-facing pages so a failure never looks like emptiness:
dashboard, curriculum, leaderboard, calendar, announcements, gallery. Existing
"nothing here yet" empty states stay, and only render when the query actually
succeeded.

Explicitly not added: Sentry or any third-party tracker, OpenTelemetry, tracing, a log
pipeline, or an errors table — for the privacy/legal reasons stated.

## Verification

Playwright at 360px on every in-shell page plus the public/legal pages, reporting
`document.documentElement.scrollWidth` vs viewport width for each, with screenshots of
the leaderboard, dashboard and review card.
