import { useId } from "react";
import type { BeltPattern } from "@/lib/belts";

/**
 * A belt chip must render the *pattern*, not just a color — a camo purple belt
 * and a solid purple belt are different ranks with different curriculum, and
 * that distinction is the whole point of the three-system model.
 *
 * Geometry is drawn against a real belt photo: two tapered straps crossing in an
 * X, with a compact knot sitting over the crossing point. The knot is
 * deliberately simplified — at icon size the loops and folds of a real knot turn
 * to mud, so it reads as one rounded bundle instead.
 *
 * Accessibility: the full rank name (plus system, when supplied) is exposed via
 * aria-label, and the pattern is also spelled out in words so it is never
 * conveyed by color alone.
 */
export type BeltChipProps = {
  name: string;
  pattern: BeltPattern | string;
  colorPrimary: string;
  colorAccent?: string | null;
  systemName?: string | null;
  /** Render the rank name next to the icon. */
  showLabel?: boolean;
  size?: "ladder" | "sm" | "md";
  className?: string;
};


const PATTERN_WORD: Record<string, string> = {
  solid: "solid belt",
  stripe: "white belt with a colored stripe",
  camo: "camo belt with a colored stripe",
};

/**
 * Geometry is fixed in a 100×46 viewBox; only the rendered width changes. Both
 * sizes are double what they were — the old 24px chip was too small for the
 * pattern (the whole reason the icon exists) to be legible at all.
 *
 * `ladder` exists for the eight-step progress strip on the dashboard: eight 48px
 * swatches do not fit inside a padded card on a 360px phone, so it steps down on
 * narrow screens and becomes identical to `sm` from the sm: breakpoint up.
 */
const SIZES = {
  ladder: "h-[16px] w-[34px] sm:h-[22px] sm:w-12",
  sm: "h-[22px] w-12",
  md: "h-[33px] w-[72px]",
} as const;


/**
 * Straps are deliberately shallow — the reference belt lies almost flat across
 * the body, so a steep diagonal turns the icon into a bow tie. Each strap runs
 * the full width, tapering from a wide cuff at the outer edge to a narrower
 * waist at the crossing.
 */
const STRAP_A =
  "M2 5 C26 8 46 14 66 21 C78 25 88 29 98 33 L98 44 C87 39 77 35 64 30 C45 23 25 17 2 15 Z";
const STRAP_A_MID = "M2 10 C26 13 46 19 66 26 C78 30 88 34 98 38";
/** Mirror image: upper-right edge sweeping down to the lower-left edge. */
const STRAP_B =
  "M98 5 C74 8 54 14 34 21 C22 25 12 29 2 33 L2 44 C13 39 23 35 36 30 C55 23 75 17 98 15 Z";
const STRAP_B_MID = "M98 10 C74 13 54 19 34 26 C22 30 12 34 2 38";


export function BeltSwatch({
  name,
  pattern,
  colorPrimary,
  colorAccent,
  systemName,
  size = "md",
}: Omit<BeltChipProps, "showLabel" | "className">) {
  const uid = useId().replace(/[:]/g, "");
  const patternWord = PATTERN_WORD[pattern] ?? "belt";
  const label = `${name}${systemName ? ` (${systemName})` : ""} — ${patternWord}`;
  const accent = colorAccent ?? colorPrimary;
  const camoId = `camo-${uid}`;

  // The stripe runs along the belt's length for both stripe and camo ranks —
  // that is how the belt actually looks on the mat.
  const striped = pattern === "stripe" || pattern === "camo";
  const bandFill = pattern === "camo" ? `url(#${camoId})` : colorPrimary;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 46"
      className={`inline-block shrink-0 ${SIZES[size]}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{label}</title>
      {pattern === "camo" && (
        <defs>
          <pattern id={camoId} width="16" height="12" patternUnits="userSpaceOnUse">
            <rect width="16" height="12" fill={colorPrimary} />
            <circle cx="4" cy="4" r="3.2" fill={colorPrimary} style={{ filter: "brightness(0.62)" }} />
            <circle cx="12" cy="8" r="3" fill="#c2b280" opacity="0.55" />
            <circle cx="9" cy="2" r="2.2" fill="#000" opacity="0.35" />
          </pattern>
        </defs>
      )}

      {/*
        A light outline on every part — including the near-black and deep brown
        belts — so the shape separates from the dark card instead of dissolving
        into it. Near-opaque and 1.3 wide in a 100-unit box, which is a much
        firmer edge than the old hairline.
      */}
      <g
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Back strap first, so the front strap and the knot overlap it. */}
        <path d={STRAP_B} fill={bandFill} />
        {striped && <path d={STRAP_B_MID} fill="none" stroke={accent} strokeWidth="3" />}

        <path d={STRAP_A} fill={bandFill} />
        {striped && <path d={STRAP_A_MID} fill="none" stroke={accent} strokeWidth="3" />}

        {/*
          Knot: one squarish bundle over the crossing. The real knot's loops and
          folds turn to mud at icon size, so it is simplified on purpose — only
          the silhouette survives. There is deliberately NO tail hanging below
          the knot; if one is ever re-added, its accent stripe must come with it.
        */}


        <rect x="40" y="9" width="20" height="23" rx="4.5" fill={bandFill} />
        {striped && <rect x="41" y="19" width="18" height="3.4" fill={accent} stroke="none" />}

      </g>
    </svg>
  );
}

export function BeltChip({
  showLabel = true,
  className = "",
  ...swatch
}: BeltChipProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BeltSwatch {...swatch} />
      {showLabel && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{swatch.name}</span>
          {swatch.systemName && (
            <span className="block truncate text-xs uppercase tracking-widest text-muted-foreground">
              {swatch.systemName}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
