import { Award, Circle, Medal, Sparkles, Trophy } from "lucide-react";
import { DisciplineTags } from "@/components/discipline-tags";
import { QueryErrorState } from "@/components/query-error";
import { cleanDisciplines } from "@/lib/calendar-data";
import { formatDateRange } from "@/lib/date-only";
import {
  groupWinnersByTournament,
  PLACEMENT_TILE_BOX,
  placementLabel,
  placementTileClass,
  useWinnersCircle,
} from "@/lib/tournament-results";

/** Same glyph-per-rank mapping as the parent results section and the podium. */
function PlacementIcon({ placement }: { placement: number | null }) {
  if (placement === 1) return <Trophy className="h-4 w-4" aria-hidden="true" />;
  if (placement === 2) return <Medal className="h-4 w-4" aria-hidden="true" />;
  if (placement === 3) return <Award className="h-4 w-4" aria-hidden="true" />;
  return <Circle className="h-4 w-4" aria-hidden="true" />;
}

/**
 * WINNER'S CIRCLE — school-wide, deliberately NOT filtered to the selected child.
 *
 * Rows come from public.get_winners_circle, which returns a last initial only and
 * never staff notes. Order is the function's; grouping is a run-length pass.
 */
export function WinnersCircleSection() {
  const q = useWinnersCircle();
  const groups = groupWinnersByTournament(q.data ?? []);

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6" aria-label="Winner's Circle">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Winner&apos;s Circle</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every Tiger who stepped on the mat at a tournament — the whole school celebrates them.
      </p>

      {q.isError ? (
        <QueryErrorState className="mt-4" what="the Winner's Circle" onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading the Winner&apos;s Circle…</p>
      ) : groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No tournament results have been featured yet — the first ones will show up here.
        </p>
      ) : (
        <ul className="mt-4 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <li key={g.key} className="min-w-0 rounded-xl border border-border bg-background/50 p-4">
              <h3 className="flex min-w-0 items-start gap-2 font-semibold text-foreground">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 break-words">{g.tournament_name}</span>
              </h3>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {formatDateRange(g.tournament_date, null)}
              </span>

              <ul className="mt-3 space-y-2">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-card p-2.5">
                    <span
                      className={`${PLACEMENT_TILE_BOX} ${placementTileClass(
                        r.placement,
                      )}`}
                    >
                      <PlacementIcon placement={r.placement} />
                      <span className="leading-none">{placementLabel(r.placement)}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="min-w-0 break-words text-sm font-semibold text-foreground">
                        {r.first_name} {r.last_initial}
                      </p>
                      <p className="min-w-0 break-words text-xs text-muted-foreground">{r.event_name}</p>
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
