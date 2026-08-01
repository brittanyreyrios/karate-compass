import type { BeltPattern } from "@/lib/belts";

/**
 * A belt chip must render the *pattern*, not just a color — a camo purple belt
 * and a solid purple belt are different ranks with different curriculum, and
 * that distinction is the whole point of the three-system model.
 *
 * Accessibility: the full rank name (plus system, when supplied) is exposed via
 * aria-label, and the pattern is also spelled out in text so it is never
 * conveyed by color alone.
 */
export type BeltChipProps = {
  name: string;
  pattern: BeltPattern | string;
  colorPrimary: string;
  colorAccent?: string | null;
  systemName?: string | null;
  /** Render the rank name next to the swatch. */
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
};

const PATTERN_WORD: Record<string, string> = {
  solid: "solid belt",
  stripe: "white belt with a colored stripe",
  camo: "camo belt",
};

export function BeltSwatch({
  name,
  pattern,
  colorPrimary,
  colorAccent,
  systemName,
  size = "md",
}: Omit<BeltChipProps, "showLabel" | "className">) {
  const dims = size === "sm" ? "h-6 w-3.5" : "h-8 w-4";
  const label = `${name}${systemName ? ` (${systemName})` : ""} — ${PATTERN_WORD[pattern] ?? "belt"}`;
  const accent = colorAccent ?? colorPrimary;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`relative inline-block shrink-0 overflow-hidden rounded-sm border border-border/60 ${dims}`}
      style={{ backgroundColor: colorPrimary }}
    >
      {pattern === "stripe" && (
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-1/2 h-[30%] -translate-y-1/2"
          style={{ backgroundColor: accent }}
        />
      )}
      {pattern === "camo" && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-90"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 25%, ${accent} 0 28%, transparent 30%), radial-gradient(circle at 70% 60%, ${accent} 0 24%, transparent 26%), radial-gradient(circle at 35% 85%, ${accent} 0 20%, transparent 22%)`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 5px)",
            }}
          />
        </>
      )}
    </span>
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
