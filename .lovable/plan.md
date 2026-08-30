# Responsive overflow batch 3 — seven remainders + two unlisted `lg:` splits

Display/layout only. No query, RLS, `useTournaments`, or placement-helper changes. No touch-target changes.

## The shared root cause

Three separate mechanisms are behind all nine items, and each item is fixed with the mechanism that actually applies — not with a breakpoint by reflex:

1. **`lg:` splits that fire where content is narrowest.** `lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]` fires at 1024, one pixel before the 255px rail returns, so at 1025 the flexible column gets ~301px. Fix: move the split to `xl:` (or drive the grid off its own width with a container query where the grid's width — not the viewport's — is the honest input).
2. **Missing `min-w-0`.** A `Select` inside a flex/grid child without `min-w-0` refuses to shrink below its content width, so `SelectTrigger`'s `[&>span]:line-clamp-1` never gets a chance to clamp. This is what produces absurd pairs like 1654/611.
3. **Unbreakable inline content.** `font-mono ... tracking-widest` invite codes and the belt ladder strip have no wrap or shrink allowance.

## Per item

**1 — Invite Codes (`admin.tsx` InviteCodesTab, ~3558).** Non-structural: the code line is unbreakable text in a `min-w-0 flex-1` cell. Add `truncate` (and `break-all` on the wrapped meta line) so it fits at 390 and 1025 without changing the row shape. Also move that tab's split to `xl:` since it is the same trap. I will measure the other tabs sharing the identical pattern and report — not fix — any that share the bug.

**2 — Media Gallery (`gallery.tsx`).** Audit at runtime first: `gallery.tsx` contains no `Select`, so the two overflowing triggers are in a control rendered around it; I identify them by DOM before touching anything, then add `min-w-0` + `w-full` on their wrapper. The album grid's column count is driven by the grid's own width, so convert `sm:grid-cols-2 lg:grid-cols-3` to a container query (`@container` wrapper, `@sm:`/`@3xl:` steps).

**3 — Belt Curriculum.** Split `lg:` → `xl:`; `min-w-0` on the two Select wrappers; the "Pick a program first" placeholder gets `truncate`/wrap so 129/117 clears.

**4 — Technique Library (`admin-technique-library.tsx`:219).** Audited directly at all four widths, not assumed clean. If it measures broken at 1025 it gets the same `xl:` split + `min-w-0` treatment; if genuinely clean, I say so with the measured pairs.

**5 — Post Announcement.** Diagnosis before fix: the trigger is `<SelectTrigger id="new-ann-link">` / `#new-ann-existing-event` inside `sm:col-span-2` card, and the long option labels ("Create a new event from this announcement", `title — date`) are the content. I will confirm at runtime whether `[&>span]:line-clamp-1` is present-but-defeated (missing `min-w-0` on the ancestor) or genuinely bypassed by an extra wrapper, then fix that cause only, and state which it was in the report.

**6 — Dashboard + podium.** `index.tsx`:346 `mt-8 grid gap-6 lg:grid-cols-3` is one fix covering both the belt strip (55/51) and Next Belt Test (334/302): step the grid at the honest breakpoint (`xl:grid-cols-3`, keeping a `sm:`/`lg:` two-up step so nothing regresses at 1024), plus `min-w-0` on the affected cards and shrink allowance on the ladder items. Leaderboard podium at 390: the first-place `scale-105` widens the card past the viewport column; gate the horizontal growth so it applies only from `sm:` up. **PodiumCard's accent-to-rank mapping (gold=1, silver=2, bronze=3) is not touched** — the edit is in the wrapper's transform classes only.

**7 — Events Calendar.** `min-w-0` on the view/filter Select wrappers so the triggers clamp at 1024 and 1025.

## Verification

Playwright, both admin and parent, at 390 / 768 / 1024 / 1025: before/after `scrollWidth`/`clientWidth` for every item, `document.body.scrollWidth` vs viewport at all four widths, screenshots per page, and an explicit statement on whether `admin-events-tab.tsx` and `admin-content-tabs.tsx` share the bug (reported, not fixed).
