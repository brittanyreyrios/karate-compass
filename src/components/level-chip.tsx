import { Badge } from "@/components/ui/badge";
import { BeltChip, BeltSwatch, type BeltChipProps } from "@/components/belt-chip";

/**
 * Round 10 AK3 — some programs have no belts.
 *
 * Tai chi members hold a *level*, not a belt, and inventing a tai chi belt
 * graphic would be a lie about what they wear on the mat. So a beltless system
 * renders a neutral text chip instead of the belt SVG.
 *
 * The decision is data-driven off belt_systems.uses_belts, never a slug check —
 * a second beltless program is then a database row, not another round of work.
 */
export function LevelChip({
  name,
  systemName,
  className = "",
}: {
  name: string;
  systemName?: string | null;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`border-border text-foreground ${className}`}
      title={systemName ? `${name} — ${systemName}` : name}
    >
      {name}
    </Badge>
  );
}

/**
 * One place that decides between a belt graphic and a level chip. Every screen
 * showing a student's rank goes through here so the two can never diverge.
 */
export function RankIndicator({
  usesBelts,
  showLabel = false,
  ...rest
}: BeltChipProps & { usesBelts: boolean }) {
  if (!usesBelts) {
    return <LevelChip name={rest.name} systemName={rest.systemName} className={rest.className} />;
  }
  return showLabel ? (
    <BeltChip {...rest} showLabel />
  ) : (
    <BeltSwatch
      name={rest.name}
      pattern={rest.pattern}
      colorPrimary={rest.colorPrimary}
      colorAccent={rest.colorAccent}
      systemName={rest.systemName}
      size={rest.size}
    />
  );
}
