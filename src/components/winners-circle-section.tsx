import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Award, ChevronDown, ChevronUp, Circle, Medal, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
/**
 * Minimum width one tournament card needs for its event rows to stay on ONE line.
 * Measured, not guessed: 96px medal tile + 12px gap + 168px name/division text
 * column (the longest realistic "Christopher T" over "Gi Intermediate 12-13") +
 * 20px row padding (p-2.5 both sides) + 32px card padding (p-4 both sides) = 328px.
 * Rounded to 20.5rem / 328px and fed straight into the grid track minimum, so the
 * COLUMN COUNT IS RESOLVED BY CSS from the grid's own width. That inherently
 * handles the 1024-vs-1025 inversion (Sheet sidebar below 1025, 255px rail at or
 * above it) that no min-width breakpoint can express.
 */
const WC_MIN_CARD_PX = 328;
const WC_GRID_COLS = "grid-cols-[repeat(auto-fit,minmax(20.5rem,1fr))]";

/** Single column reads fine as a list, so phone keeps three. */
const WC_SINGLE_COLUMN_COUNT = 3;

/**
 * Reads the column count the browser ACTUALLY resolved for the grid, rather than
 * recomputing thresholds in JS beside the CSS (two derivations that agree only by
 * discipline). Collapsed tracks from auto-fit report as 0px, so they are dropped.
 */
function resolvedColumnCount(el: HTMLElement): number {
  const tracks = getComputedStyle(el)
    .gridTemplateColumns.split(" ")
    .filter((t) => parseFloat(t) > 0);
  return Math.max(1, tracks.length);
}

export function WinnersCircleSection() {
  const q = useWinnersCircle();
  const [expanded, setExpanded] = useState(false);
  const groups = groupWinnersByTournament(q.data ?? []);

  const gridRef = useRef<HTMLUListElement | null>(null);
  const [columns, setColumns] = useState(1);

  const measure = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    setColumns(resolvedColumnCount(el));
  }, []);

  // useLayoutEffect (never during SSR — this whole subtree is ssr: false, and a
  // layout effect runs before paint anyway) so the FIRST painted frame already
  // has the right count: a post-paint ResizeObserver callback would flash the
  // orphan card this round removes.
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, groups.length]);

  // Collapsed = exactly one full row, derived from the observed column count so
  // it can never disagree with what CSS laid out.
  const collapsedCount = columns <= 1 ? WC_SINGLE_COLUMN_COUNT : columns;
  // Slice the GROUPED array (newest tournament first), never the flat row list —
  // slicing rows first would cut a tournament in half.
  const visibleGroups = expanded ? groups : groups.slice(0, collapsedCount);

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
        <>
        <ul
          ref={gridRef}
          data-wc-grid
          data-wc-min-card={WC_MIN_CARD_PX}
          className={`mt-4 grid items-start gap-3 ${WC_GRID_COLS}`}
        >
          {visibleGroups.map((g) => (
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
                  <li key={r.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/70 bg-card p-2.5">
                    <span
                      className={`${PLACEMENT_TILE_BOX} ${placementTileClass(
                        r.placement,
                      )}`}
                    >
                      <PlacementIcon placement={r.placement} />
                      <span className="leading-none">{placementLabel(r.placement)}</span>
                    </span>
                    {/* Chips live INSIDE the text column, left-aligned under the
                        division — the old ml-auto/justify-end group wrapped to its
                        own full-width right-aligned line at 390px, leaving the
                        tile, the name and the chip as three unaligned pieces. */}
                    <div className="min-w-[6rem] flex-1">
                      <p className="truncate text-base font-semibold text-foreground">
                        {r.first_name} {r.last_initial}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{r.event_name}</p>
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
        {groups.length > collapsedCount && (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  View all {groups.length} tournaments <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        )}
        </>
      )}
    </section>
  );
}
