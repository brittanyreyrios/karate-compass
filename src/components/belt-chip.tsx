import { useId } from "react";
import type { BeltPattern } from "@/lib/belts";

/**
 * A belt chip must render the *pattern*, not just a color — a camo purple belt
 * and a solid purple belt are different ranks with different curriculum, and
 * that distinction is the whole point of the three-system model.
 *
 * It is drawn as an actual belt seen head-on: a horizontal band, a knot at the
 * centre, and two short tails hanging below it. A vertical colour block read as
 * "a swatch"; a tied belt reads as a rank.
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
  size?: "sm" | "md";
  className?: string;
};

const PATTERN_WORD: Record<string, string> = {
  solid: "solid belt",
  stripe: "white belt with a colored stripe",
  camo: "camo belt with a colored stripe",
};

/** Geometry is fixed in a 48×24 viewBox; only the rendered width changes. */
const SIZES = { sm: "h-3 w-6", md: "h-4 w-9" } as const;

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
      viewBox="0 0 48 24"
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

      {/* Tails, drawn first so the knot sits on top of them. */}
      <g stroke="rgba(0,0,0,0.55)" strokeWidth="0.75">
        <rect x="19" y="14" width="4.5" height="9" rx="1" fill={bandFill} />
        <rect x="24.5" y="14" width="4.5" height="7.5" rx="1" fill={bandFill} />
        {striped && (
          <>
            <rect x="19" y="16.5" width="4.5" height="2" fill={accent} stroke="none" />
            <rect x="24.5" y="16.5" width="4.5" height="2" fill={accent} stroke="none" />
          </>
        )}
      </g>

      {/* Band across the full width. */}
      <g stroke="rgba(0,0,0,0.55)" strokeWidth="0.75">
        <rect x="0.5" y="6.5" width="47" height="9" rx="2" fill={bandFill} />
        {striped && (
          <rect x="1" y="9.5" width="46" height="3" fill={accent} stroke="none" />
        )}
      </g>

      {/* Knot. */}
      <g stroke="rgba(0,0,0,0.6)" strokeWidth="0.75">
        <rect x="17.5" y="5" width="13" height="12" rx="2.5" fill={bandFill} />
        {striped && <rect x="18" y="9.5" width="12" height="3" fill={accent} stroke="none" />}
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
