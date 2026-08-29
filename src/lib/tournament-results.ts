import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tournament results.
 *
 * tournament_name / tournament_date are stored on every row, never resolved
 * through announcement_id at read time: deleting a tournament announcement must
 * break the link, not erase a child's record.
 */
export type TournamentResult = {
  id: string;
  student_id: string;
  announcement_id: string | null;
  tournament_name: string;
  tournament_date: string;
  event_name: string;
  placement: number | null;
  disciplines: string[] | null;
  notes: string | null;
  /** Whether this result appears in the school-wide Winner's Circle. */
  featured: boolean;
};

export const TOURNAMENT_RESULT_COLUMNS =
  "id, student_id, announcement_id, tournament_name, tournament_date, event_name, placement, disciplines, notes, featured";

/**
 * ORDERING CONTRACT — all four keys are applied server-side, because without an
 * explicit ORDER BY Postgres may return a child's events in a different order on
 * every load and they would appear to shuffle:
 *   1. tournament_date DESC  — newest tournament first
 *   2. tournament_name ASC — two tournaments on the SAME date must not interleave,
 *      or the run-length grouping below splits one tournament into several groups
 *   3. placement ASC, NULLS LAST — 1st, 2nd, 3rd, then "Competed"
 *   4. event_name ASC — deterministic tie-break
 * Grouping on the client is a run-length pass over this order; it never re-sorts.
 */
export function useStudentTournamentResults(studentId: string | undefined) {
  return useQuery({
    queryKey: ["tournament-results", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_results")
        .select(TOURNAMENT_RESULT_COLUMNS)
        .eq("student_id", studentId!)
        .order("tournament_date", { ascending: false })
        .order("tournament_name", { ascending: true })
        .order("placement", { ascending: true, nullsFirst: false })
        .order("event_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TournamentResult[];
    },
  });
}

export type TournamentGroup = {
  key: string;
  tournament_name: string;
  tournament_date: string;
  rows: TournamentResult[];
};

/** Groups an already-ordered list by tournament, preserving the server order. */
export function groupByTournament(rows: TournamentResult[]): TournamentGroup[] {
  const groups: TournamentGroup[] = [];
  const index = new Map<string, TournamentGroup>();
  for (const r of rows) {
    const key = `${r.tournament_date}|${r.tournament_name}`;
    let g = index.get(key);
    if (!g) {
      g = {
        key,
        tournament_name: r.tournament_name,
        tournament_date: r.tournament_date,
        rows: [],
      };
      index.set(key, g);
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}

/** "Competed" is a real outcome — a NULL placement never renders blank or 0. */
export function placementLabel(placement: number | null): string {
  if (placement === null || placement === undefined) return "Competed";
  const n = placement;
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

/** Gold / silver / bronze accents matching the leaderboard podium. */
export function placementChipClass(placement: number | null): string {
  switch (placement) {
    case 1:
      return "border-[hsl(45_90%_55%/0.5)] bg-[hsl(45_90%_55%/0.14)] text-[hsl(45_90%_62%)]";
    case 2:
      return "border-[hsl(220_9%_75%/0.5)] bg-[hsl(220_9%_75%/0.14)] text-[hsl(220_9%_80%)]";
    case 3:
      return "border-[hsl(28_65%_52%/0.5)] bg-[hsl(28_65%_52%/0.14)] text-[hsl(28_70%_62%)]";
    default:
      return "border-border bg-background text-muted-foreground";
  }
}

/**
 * Parent-facing medal tile styling. SEPARATE from placementChipClass on purpose:
 * that helper is also used by the admin results list, and this round must not
 * restyle the admin panel. Same gold / silver / bronze hues, more presence.
 */
export function placementTileClass(placement: number | null): string {
  switch (placement) {
    case 1:
      return "border-[hsl(45_90%_55%/0.6)] bg-[hsl(45_90%_55%/0.16)] text-[hsl(45_90%_62%)] ring-1 ring-[hsl(45_90%_55%/0.35)] shadow-[0_0_18px_-6px_hsl(45_90%_55%/0.7)]";
    case 2:
      return "border-[hsl(220_9%_75%/0.6)] bg-[hsl(220_9%_75%/0.16)] text-[hsl(220_9%_80%)] ring-1 ring-[hsl(220_9%_75%/0.28)]";
    case 3:
      return "border-[hsl(28_65%_52%/0.6)] bg-[hsl(28_65%_52%/0.16)] text-[hsl(28_70%_62%)] ring-1 ring-[hsl(28_65%_52%/0.28)]";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}
