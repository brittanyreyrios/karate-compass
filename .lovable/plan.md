# Fix Batch 1 — layout failures from the audit

Five targeted fixes. No grid-cols changes, no `md:` steps, no card-layout or dense-form touch-target edits, nothing from Rounds 41–47.

## 1 — Collapse the sidebar below 1024px

`src/hooks/use-mobile.tsx`: `MOBILE_BREAKPOINT` 768 → 1024.

Consumers of `useIsMobile()`: exactly one — `src/components/ui/sidebar.tsx` (line 69), which uses it to switch the sidebar between the persistent rail and the Sheet overlay, and to route `toggleSidebar` to `openMobile`. No other layout branch, conditional render, or mobile-only component reads the hook. So the only behavioural effect is the intended one: at 768–1023px the sidebar becomes a sheet behind the menu button, and main content grows from ~768px to ~1024px at iPad portrait. Nothing is made worse, so no reason to stop.

## 2 — Sidebar toggle hit area ≥ 44×44

`SidebarTrigger` in `src/components/ui/sidebar.tsx` is `h-7 w-7`. Change to a 44×44 tappable box (`size-11`, centred content) while pinning the `PanelLeft` glyph to its current rendered size (`size-4` explicitly on the icon) so only the hit area grows. It is rendered once, in `src/routes/__root.tsx`, so this covers every page.

## 3 — Manage Announcements action row wrapping

`src/components/admin-announcements-manage.tsx` line 612: add `flex-wrap` to the `mt-3 flex flex-col gap-2 sm:flex-row` action bar so the five buttons wrap instead of pushing the document sideways. Expected result: `body.scrollWidth === viewport` at 768.

## 4 — Manage Students enrolment select becomes fluid

`src/components/admin-enrollment.tsx` line 144: replace the fixed `w-[190px]` with a fluid width that can shrink (`w-full min-w-[9rem] max-w-[190px]`) and let its wrapper shrink (`min-w-0` on the inline-flex row) so the sibling `min-w-0 sm:flex-1` text column keeps a usable content box instead of 27px. No container widening, no font shrink.

## 5 — Technique Library caption

The caption is a single shared component: `src/components/video-facade.tsx` line 113 — used by both the parent Technique Library and the admin Technique Library, which is why the same failure shows on nine admin elements. One fix covers all of them.

Root cause: `truncate` sets `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`, but the element is an inline `<span>`, and inline boxes ignore `overflow`, so the text wraps to four lines inside a one-line overlay. Chosen behaviour: **single-line truncation** — make the span a block-level box so `truncate` actually applies. No layout or size change to the tile.

## Verification (report deliverables)

- `git diff --stat`, plus confirmation the diff contains no `grid-cols` edits.
- Full re-measurement pass at 390 / 768 / 1024 / 1180 across the same pages and both roles (admin `brittanyreyrios@gmail.com`, parent `katherineapple@ymail.com`), same table format, showing only remaining failures, with resolved-vs-remaining counts.
- Main content width at each width, before and after.
- `document.body.scrollWidth` vs viewport for every page/width.
- The four/five fixes proven individually: measured trigger hit rect, Manage Announcements wrapped row with body scroll gone, Manage Students text column clientWidth before/after, caption line count and height.
- Screenshots at 390 and 1024 of Dashboard, Manage Students, Manage Announcements, Technique Library.
