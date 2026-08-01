import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BeltSwatch } from "@/components/belt-chip";
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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-system`}>Belt system</Label>
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
        <Label htmlFor={`${idPrefix}-rank`}>Rank</Label>
        <Select
          value={rankId ?? ""}
          disabled={!systemId}
          onValueChange={(v) => onChange({ systemId, rankId: v })}
        >
          <SelectTrigger id={`${idPrefix}-rank`}>
            <SelectValue placeholder={systemId ? "Choose a rank" : "Pick a system first"} />
          </SelectTrigger>
          <SelectContent>
            {ranks.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <span className="flex items-center gap-2">
                  <BeltSwatch
                    name={r.name}
                    pattern={r.pattern}
                    colorPrimary={r.color_primary}
                    colorAccent={r.color_accent}
                    size="sm"
                  />
                  {r.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {ranks.length > 0 ? `${ranks.length} ranks in this system` : "\u00a0"}
        </p>
      </div>
    </div>
  );
}
