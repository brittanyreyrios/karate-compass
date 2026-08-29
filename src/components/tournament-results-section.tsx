import { Award, Circle, Medal, Trophy } from "lucide-react";
import { DisciplineTags } from "@/components/discipline-tags";
import { QueryErrorState } from "@/components/query-error";
import { cleanDisciplines } from "@/lib/calendar-data";
import {
  groupByTournament,
  PLACEMENT_TILE_BOX,
  placementLabel,
  placementTileClass,
  useStudentTournamentResults,
} from "@/lib/tournament-results";
import { formatDateRange } from "@/lib/date-only";

/** Trophy / medal / award, matching the leaderboard podium ranks. */
function PlacementIcon({ placement }: { placement: number | null }) {
  if (placement === 1) return <Trophy className="h-4 w-4" aria-hidden="true" />;
  if (placement === 2) return <Medal className="h-4 w-4" aria-hidden="true" />;
  if (placement === 3) return <Award className="h-4 w-4" aria-hidden="true" />;
  // "Competed" gets the same box as a medal tile, with a quiet glyph — same
  // height as the medal icons above, no medal colour, ring, or glow.
  return <Circle className="h-4 w-4" aria-hidden="true" />;
}

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

  // Every card gets a normal grid track — no full-width span for a single
  // tournament (that left its events stacked in a narrow column of empty card).
  // Inside a card, events go two-up only when the CARD is genuinely wide
  // (@md = 28rem of card width, a container query — not the viewport).
  const gridCols = "sm:grid-cols-2 xl:grid-cols-3";

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
        <ul className={`mt-4 grid items-start gap-3 ${gridCols}`}>
          {groups.map((g) => (
            <li key={g.key} className="@container min-w-0 rounded-xl border border-border bg-background/50 p-4">
              <div className="min-w-0">
                <h3 className="flex min-w-0 items-start gap-2 font-semibold text-foreground">
                  <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 break-words">{g.tournament_name}</span>
                </h3>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {formatDateRange(g.tournament_date, null)}
                </span>
              </div>

              <ul className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-2" data-events-list>
                {g.rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-t border-border/60 pt-2 first:border-t-0 first:pt-0 @md:border-t-0 @md:pt-0"
                  >
                    <span
                      className={`flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-xs font-bold uppercase tracking-wide ${placementTileClass(
                        r.placement,
                      )}`}
                    >
                      <PlacementIcon placement={r.placement} />
                      <span className="leading-none">{placementLabel(r.placement)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-foreground">{r.event_name}</p>
                      {r.notes && (
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">{r.notes}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <DisciplineTags disciplines={cleanDisciplines(r.disciplines)} />
                      </div>
                    </div>
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
