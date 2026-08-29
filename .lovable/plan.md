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

## 5 — Technique Library caption: NOT A BUG, no code change

Your doubt is correct and my root cause was wrong. Measured today on `/techniques` (admin session), `span.absolute.inset-x-0.bottom-0.truncate` at 390px and 1024px:

```
display: block          (absolutely positioned -> blockified, as you said)
white-space: nowrap
overflow: hidden
text-overflow: ellipsis
line-height: 16px, font-size: 12px
padding-top: 24px, padding-bottom: 24px
height: 64px
scrollWidth 364 / clientWidth 364   (390px)
scrollWidth 219 / clientWidth 219   (1024px)
line boxes (Range.getClientRects().length): 1
```

`truncate` is applying exactly as intended: one line box, no overflow, ellipsis armed. The 64px height is `24 (pt-6) + 16 (one line) + 24 (pb-6)` — the gradient scrim's padding, not four lines of text. The audit's "four-line label" finding was a false positive from dividing element height by line-height, which counts padding as text lines. The same arithmetic produced all nine admin Technique Library entries; they are the same shared component (`src/components/video-facade.tsx`) and are equally fine.

So: no fix, no class change here. I will re-check line boxes at all four widths in the re-measurement and reclassify these findings as false positives rather than resolved.

## Addition 1 — menu button is unconditional (verified before the breakpoint change)

`SidebarTrigger` is rendered once, in `src/routes/__root.tsx` line 137, inside the always-on header — no `md:hidden`, no `hidden lg:block`, no conditional branch; and the component itself (`sidebar.tsx`) carries only `h-7 w-7`. Measured `[data-sidebar="trigger"]` rect today, on the current 768 breakpoint:

| width | rect | display / visibility |
| --- | --- | --- |
| 390 | x 16, y 13.5, 19.28 x 28 | flex / visible |
| 768 | x 272, y 13.5, 26.33 x 28 | flex / visible |
| 1024 | x 272, y 13.5, 28 x 28 | flex / visible |
| 1180 | x 272, y 13.5, 28 x 28 | flex / visible |

It renders at every width, so raising the breakpoint cannot strand anyone. Note it is also being squeezed below its own 28px at 390/768 by the header flex row, so fix 2 adds `shrink-0` along with the 44x44 box, and I will re-measure to prove >= 44 x 44 at all four widths.

## Report

`git diff --stat`; the `useIsMobile()` consumer list; the full re-measurement table at 390/768/1024/1180 for both roles showing only remaining failures with resolved/remaining/false-positive counts; main content width before and after; `document.body.scrollWidth` vs viewport for every page and width; the four fixes proven individually (trigger rect, wrapped action row with body scroll gone, Manage Students text column clientWidth before/after, caption line count and height plus the computed styles above re-read after the diff); screenshots at 390 and 1024 of Dashboard, Manage Students, Manage Announcements, Technique Library; and confirmation the diff contains no `grid-cols` edit.
