import { Medal, Trophy } from "lucide-react";
import { DisciplineTags } from "@/components/discipline-tags";
import { QueryErrorState } from "@/components/query-error";
import { cleanDisciplines } from "@/lib/calendar-data";
import {
  groupByTournament,
  placementChipClass,
  placementLabel,
  useStudentTournamentResults,
} from "@/lib/tournament-results";
import { formatDateRange } from "@/lib/date-only";

/**
 * Parent-facing tournament results for ONE child — the child currently chosen in
 * the dashboard switcher, never all children at once.
 *
 * Rows arrive already ordered by the query (tournament date DESC, then placement
 * with NULLs last, then event name); grouping here is a run-length pass that must
 * not re-sort, or the "shuffling events" bug comes back.
 */
export function TournamentResultsSection({
  studentId,
  firstName,
}: {
  studentId: string | undefined;
  firstName: string;
}) {
  const q = useStudentTournamentResults(studentId);
  const groups = groupByTournament(q.data ?? []);

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6" aria-label="Tournament results">
      <div className="flex items-center gap-2">
        <Medal className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Tournament Results</h2>
      </div>

      {q.isError ? (
        <QueryErrorState className="mt-4" what="tournament results" onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading results…</p>
      ) : groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No results recorded yet — {firstName}&apos;s first tournament is waiting. Ask your
          instructor which upcoming event is a good fit.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {groups.map((g) => (
            <li key={g.key} className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <Trophy className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">{g.tournament_name}</span>
                </h3>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {formatDateRange(g.tournament_date, null)}
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {g.rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 border-t border-border/60 pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.event_name}</p>
                      {r.notes && <p className="mt-0.5 text-xs text-muted-foreground">{r.notes}</p>}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <DisciplineTags disciplines={cleanDisciplines(r.disciplines)} />
                      </div>
                    </div>
                    <span
                      className={`shrink-0 self-start rounded-md border px-2.5 py-1 text-sm font-bold uppercase tracking-wide ${placementChipClass(
                        r.placement,
                      )}`}
                    >
                      {placementLabel(r.placement)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
