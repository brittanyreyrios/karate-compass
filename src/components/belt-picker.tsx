import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BeltSwatch } from "@/components/belt-chip";
import { LevelChip } from "@/components/level-chip";
import { ranksOfSystem, useBeltRanks, useBeltSystems } from "@/lib/belts";

/**
 * Two dependent dropdowns: belt system first, then rank inside that system.
 * Age guidance is shown as a hint only — instructors move students between
 * systems at their discretion, so nothing here validates or blocks on age.
 */
export function BeltPicker({
  systemId,
  rankId,
  onChange,
  idPrefix = "belt",
}: {
  systemId: string | null;
  rankId: string | null;
  onChange: (next: { systemId: string | null; rankId: string | null }) => void;
  idPrefix?: string;
}) {
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();

  const systems = systemsQ.data ?? [];
  const system = systems.find((s) => s.id === systemId);
  const ranks = ranksOfSystem(ranksQ.data, systemId ?? undefined);
  // AK3: a beltless program has levels, not belts. Labels and the swatch both
  // follow the system's own uses_belts flag, so a second beltless program needs
  // only a database row.
  const usesBelts = system ? system.uses_belts !== false : true;
  const rankWord = usesBelts ? "Rank" : "Level";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-system`}>Program</Label>
        <Select
          value={systemId ?? ""}
          onValueChange={(v) => onChange({ systemId: v, rankId: null })}
        >
          <SelectTrigger id={`${idPrefix}-system`}>
            <SelectValue placeholder="Choose a system" />
          </SelectTrigger>
          <SelectContent>
            {systems.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {system?.age_guidance ?? "Age ranges are guidance only — instructors decide."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-rank`}>{rankWord}</Label>
        <Select
          value={rankId ?? ""}
          disabled={!systemId}
          onValueChange={(v) => onChange({ systemId, rankId: v })}
        >
          <SelectTrigger id={`${idPrefix}-rank`}>
            <SelectValue placeholder={systemId ? `Choose a ${rankWord.toLowerCase()}` : "Pick a program first"} />
          </SelectTrigger>
          <SelectContent>
            {ranks.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <span className="flex items-center gap-2">
                  {usesBelts ? (
                    <BeltSwatch
                      name={r.name}
                      pattern={r.pattern}
                      colorPrimary={r.color_primary}
                      colorAccent={r.color_accent}
                      size="sm"
                    />
                  ) : (
                    <LevelChip name={r.name} />
                  )}
                  {r.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {ranks.length > 0 ? `${ranks.length} ${rankWord.toLowerCase()}${ranks.length === 1 ? "" : "s"} in this program` : "\u00a0"}
        </p>
      </div>
    </div>
  );
}
