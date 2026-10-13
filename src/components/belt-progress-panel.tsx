import { BeltChip, BeltSwatch } from "@/components/belt-chip";
import type { BeltRank } from "@/lib/belts";

export type ProgressRank = BeltRank & { degree?: number | null };

/** Presentational only: callers supply a ladder; this component never reads or writes data. */
export function BeltProgressPanel({
  label, studentName, ladder, currentIndex, pct, rank, systemName,
  journey = false, master = false,
}: {
  label: string;
  studentName: string;
  ladder: ProgressRank[];
  currentIndex: number;
  pct: number;
  rank: ProgressRank;
  systemName: string;
  journey?: boolean;
  master?: boolean;
}) {
  return (
    <div data-progress-panel className="overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 shadow-elevated sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-2xl font-bold uppercase">{studentName}'s Journey</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {journey ? `${Math.min(currentIndex, 5)} of 5 steps` : `Step ${currentIndex + 1} of ${ladder.length}`}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-4xl font-black text-gradient-red">{pct}%</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Complete</div>
        </div>
      </div>
      <div className="mt-8">
        <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/60">
          <div className="h-full bg-gradient-red shadow-red-glow" style={{ width: `${pct}%` }} />
        </div>
        <div className={`mt-5 grid gap-y-5 ${journey ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-8"}`}>
          {ladder.map((belt, i) => {
            const reached = i <= currentIndex;
            const current = !master && i === currentIndex;
            const text = journey ? (belt.degree == null ? "Black" : `${belt.degree === 1 ? "1st" : belt.degree === 2 ? "2nd" : belt.degree === 3 ? "3rd" : `${belt.degree}th`} Degree`) : belt.short_name ?? belt.name;
            return (
              <div key={belt.id} className="flex min-w-0 flex-col items-center gap-2">
                <span className={`inline-block ${journey ? "" : current ? "scale-125" : reached ? "" : "opacity-40"}`}>
                  <BeltSwatch name={belt.name} pattern={belt.pattern} colorPrimary={belt.color_primary} colorAccent={belt.color_accent} degree={belt.degree} systemName={systemName} size={journey ? "lg" : "sm"} />
                </span>
                <span className={`text-center text-xs font-semibold uppercase tracking-wider ${current ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground"}`}>{text}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          <BeltChip name={rank.name} pattern={rank.pattern} colorPrimary={rank.color_primary} colorAccent={rank.color_accent} degree={rank.degree} systemName={systemName} />
        </div>
        {master && <p className="mt-3 text-sm text-muted-foreground">Master level — beyond the student journey</p>}
      </div>
    </div>
  );
}