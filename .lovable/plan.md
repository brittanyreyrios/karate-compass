# Leaderboard podium: make 1st place visibly dominant

File touched: `src/routes/_authenticated/leaderboard.tsx` only. No DB, no migrations, no query changes.

## The core mechanism: transform scale on the wrapper div

The size difference comes from a **CSS `scale` transform on 1st place's existing wrapper div** — the same div that already carries `sm:-translate-y-4`. This is deliberate because:

- The wrapper already exists for exactly this reason: transforms live on the wrapper, `hover:-translate-y-1` stays on the card, so hover never overrides the scale/raise (the round-28 bug stays fixed).
- A transform is **visual only — it does not participate in layout**. `items-stretch` equalises layout heights, but cannot flatten a transform, so the 1st-place card renders genuinely larger on screen. This sidesteps the "stretch silently equalises" trap entirely.
- Scale is **deterministic and content-independent**: a two-line class name changes layout height identically for all three cards; the 1.05/1.10 multiplier applies on top, so no content can make another card visually bigger than 1st.

## Concrete changes

1. **Podium section** — 1st place wrapper becomes `flex scale-105 sm:-translate-y-4 sm:scale-110` (mobile gets 5% scale, desktop 10% + the existing 1rem raise). 2nd and 3rd wrappers stay byte-identical (`flex`), so they remain visually identical to each other. Order stays 2/1/3 at every breakpoint — no reordering on mobile. Because transforms don't affect flow, the mobile stack gets no gaps or overlaps; the slight visual bleed is absorbed by the existing `gap-4`.

2. **PodiumCard** — add an optional `featured?: boolean` prop, passed only for rank 1. When set, *deterministic* typographic upgrades apply (same for every 1st-place card regardless of content):
   - name: `text-xl` → `text-2xl`
   - points: `text-5xl` → `text-6xl`
   - rank badge circle: `h-14 w-14` → `h-16 w-16`
   - No per-card padding/height classes (no `sm:pt-14`-style sizing, no `heightClass` prop — those stay removed).

3. **Preserved untouched**: rank badges, Trophy/Medal/Award icons, accent ring/glow classes, `hover:-translate-y-1` on the card, "Rank N · Nth Place" labels, `mt-auto` points block, `isJiuJitsu` belt suppression, grid `items-stretch`, and the 2/1/3 DOM order.

## Verification (signed in as a parent, Solid Belt Int/Adv board)

- `git diff --stat` — leaderboard.tsx only.
- Desktop (1280px) and phone (~390px) Playwright screenshots showing 1st obviously largest, 2nd/3rd identical, and the wrapping "Intermediate / Advanced Children" class name not inflating its card.
- Measured bounding boxes printed from the browser to *prove* the rendered (post-transform) size difference and 2nd≈3rd equality — not assumed.
- Hover the 1st-place card via Playwright and confirm its computed transform still gains the lift (no drop/jump).
- Paste the final podium JSX + PodiumCard in the reply.
