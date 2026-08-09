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
 * Geometry is fixed in a 100×62 viewBox; only the rendered width changes.
 *
 * Round 11: the viewBox grew from 46 to 62 units tall because the tails now
 * hang below the knot instead of radiating out of it — and every entry in SIZES
 * was re-derived from the same 100:62 ratio in the same edit, so nothing
 * squashes.
 *
 * `ladder` exists for the eight-step progress strip on the dashboard: eight
 * full-size swatches do not fit inside a padded card on a 360px phone, so it
 * steps down on narrow screens and becomes identical to `sm` from sm: up.
 */
const SIZES = {
  ladder: "h-[21px] w-[34px] sm:h-[30px] sm:w-12",
  sm: "h-[30px] w-12",
  md: "h-[45px] w-[72px]",
} as const;


/**
 * Round 11 — the icon is a *band plus two hanging tails*, not two crossing
 * straps. Two full-width diagonals crossing at the centre give four arms of
 * similar length at similar angles radiating from a body, which is a spider.
 * The reference photo shows two different things instead:
 *
 *  - the band around the waist: wide, near level, reaching the full width,
 *    tapering to angled cut ends;
 *  - the tails: steep, narrow, dropping to roughly three-quarters of the
 *    height while drifting outward only a little.
 *
 * Keeping the band level and the tails steep is the whole trick. If a tail's
 * horizontal travel ever approaches its vertical travel it reads as a leg
 * again — here it is ~14 across against ~23 down, comfortably steeper than 45°.
 */
const BAND_L = "M44 11 C32 11 16 9 2 6 L2 16 C16 19 32 21 44 21 Z";
const BAND_L_MID = "M44 16 C32 16 16 14 2 11";
const BAND_R = "M56 11 C68 11 84 9 98 6 L98 16 C84 19 68 21 56 21 Z";
const BAND_R_MID = "M56 16 C68 16 84 14 98 11";

/** Left tail: falls from under the knot, drifting modestly left. */
const TAIL_L = "M44 24 C40 32 35 39 30 46 L38 49 C43 41 48 33 52 25 Z";
const TAIL_L_MID = "M48 25.5 C44 33 39 40 34 47.5";
/** Right tail: mirrored, and deliberately a touch shorter — tails never hang even. */
const TAIL_R = "M56 24 C60 31 64 38 68 43.5 L60 46.5 C56 39 51 32 48 25 Z";
const TAIL_R_MID = "M52 25.5 C56 32 60 38 64 44.5";


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
      viewBox="0 0 100 62"
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
        {/* Tails first, then the band, then the knot on top of both. */}
        <path d={TAIL_L} fill={bandFill} />
        {striped && <path d={TAIL_L_MID} fill="none" stroke={accent} strokeWidth="2.4" />}
        <path d={TAIL_R} fill={bandFill} />
        {striped && <path d={TAIL_R_MID} fill="none" stroke={accent} strokeWidth="2.4" />}

        <path d={BAND_L} fill={bandFill} />
        {striped && <path d={BAND_L_MID} fill="none" stroke={accent} strokeWidth="2.6" />}
        <path d={BAND_R} fill={bandFill} />
        {striped && <path d={BAND_R_MID} fill="none" stroke={accent} strokeWidth="2.6" />}

        {/*
          Knot: one rounded bundle over the junction. The real knot's loops and
          folds turn to mud at icon size, so only the silhouette survives.
        */}
        <rect x="40" y="8" width="20" height="21" rx="5.5" fill={bandFill} />
        {striped && <rect x="41" y="17" width="18" height="3" fill={accent} stroke="none" />}
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
