import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Medal, Award, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BeltSwatch } from "@/components/belt-chip";
import { LevelChip } from "@/components/level-chip";
import { beltLabelStyle } from "@/lib/belt-colors";
import { LeaderboardSkeleton } from "@/components/skeletons";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { QueryErrorState } from "@/components/query-error";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Dojo Leaderboard — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "Monthly Dojo Point rankings at Tiger's Den, with a separate board for each training division.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  id: string;
  first_name: string;
  last_initial: string;
  rank_name: string;
  rank_short_name: string;
  pattern: string;
  color_primary: string;
  color_accent: string | null;
  class_name: string;
  period_points: number;
  /**
   * AK: tai chi students share the Teen & Adults board with belted students, so
   * one row can be beltless while its neighbour is not. The flag comes from the
   * student's own program rather than being inferred from a class name.
   */
  uses_belts: boolean;
};

type Division = { key: string; name: string; sort_order: number };

function LeaderboardPage() {
  const qc = useQueryClient();

  /**
   * Labels and tab order come from leaderboard_divisions, but the authoritative
   * set of division keys lives in the database function division_of() — adding a
   * row to that table does not create a division.
   */
  const divisionsQ = useQuery({
    queryKey: ["leaderboard-divisions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_divisions")
        .select("key, name, sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Division[];
    },
  });
  const divisions = divisionsQ.data ?? [];

  /** Which board is my own child on? Server-side; returns nothing about others. */
  const myDivisionQ = useQuery({
    queryKey: ["my-division"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_division");
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const preferred =
    myDivisionQ.data && divisions.some((d) => d.key === myDivisionQ.data)
      ? myDivisionQ.data
      : (divisions[0]?.key ?? null);
  const divisionKey = activeKey ?? preferred;

  const q = useQuery({
    queryKey: ["leaderboard", divisionKey],
    enabled: !!divisionKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", {
        _division: divisionKey!,
        _period: "month",
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const showSkeleton = useDelayedLoading(q.isLoading || divisionsQ.isLoading);

  useEffect(() => {
    const ch = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "point_events" }, () => {
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = q.data ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 10);

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const last = divisions.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : last;
    const target = divisions[next];
    if (target) {
      setActiveKey(target.key);
      document.getElementById(`lb-tab-${target.key}`)?.focus();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <Flame className="h-3 w-3" aria-hidden="true" /> Tiger's Den Rankings
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">
          Dojo <span className="text-gradient-red">Leaderboard</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Top 10 by Dojo Points earned this month, with a separate board for each training division.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-xs text-muted-foreground">
          Leaderboard resets on the 1st of each month. Your all-time points are on your dashboard and
          never reset.
        </p>
      </header>

      {/* Five tabs will not wrap comfortably at 360px, so the strip scrolls. */}
      <div
        role="tablist"
        aria-label="Division leaderboards"
        className="-mx-4 mt-8 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
      >
        {divisions.map((d, i) => {
          const selected = d.key === divisionKey;
          return (
            <button
              key={d.key}
              id={`lb-tab-${d.key}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`lb-panel-${d.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveKey(d.key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={`shrink-0 snap-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      <div
        id={divisionKey ? `lb-panel-${divisionKey}` : undefined}
        role="tabpanel"
        aria-labelledby={divisionKey ? `lb-tab-${divisionKey}` : undefined}
        tabIndex={0}
      >

        {showSkeleton && <LeaderboardSkeleton />}

        {/* A failed divisions read leaves no board to query at all, so it has to
            surface here too — otherwise the page just looks empty. */}
        {!showSkeleton && (q.isError || divisionsQ.isError) && (
          <QueryErrorState
            className="mt-10"
            what="the leaderboard"
            onRetry={() => {
              void divisionsQ.refetch();
              void q.refetch();
            }}
          />
        )}

        {!showSkeleton && !q.isLoading && !q.isError && !divisionsQ.isError && rows.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground">
              No points logged yet this month. Be the first on the board!
            </p>
          </div>
        )}

        {podium.length > 0 && (
          <section className="mt-10 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
            {podium[1] && (
              <div className="flex">
                <PodiumCard rank={2} row={podium[1]} accent="silver" isJiuJitsu={divisionKey === "jiu_jitsu"} />
              </div>
            )}
            {podium[0] && (
              <div className="flex scale-105 sm:-translate-y-4 sm:scale-110">
                <PodiumCard
                  rank={1}
                  row={podium[0]}
                  accent="gold"
                  featured
                  isJiuJitsu={divisionKey === "jiu_jitsu"}
                />
              </div>
            )}
            {podium[2] && (
              <div className="flex">
                <PodiumCard rank={3} row={podium[2]} accent="bronze" isJiuJitsu={divisionKey === "jiu_jitsu"} />
              </div>
            )}
          </section>
        )}

        {rest.length > 0 && (
          <section className="mt-10 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide">Ranks 4 – 10</h2>
            <ul className="mt-4 divide-y divide-border">
              {rest.map((r, i) => (
                <li key={r.id} className="flex items-center gap-4 py-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-background font-display text-lg font-black text-muted-foreground">
                    <span className="sr-only">Rank </span>
                    {i + 4}
                  </div>
                  {divisionKey !== "jiu_jitsu" &&
                    (r.uses_belts === false ? (
                      <LevelChip name={r.rank_short_name || r.rank_name} />
                    ) : (
                      <BeltSwatch
                        name={r.rank_name}
                        pattern={r.pattern}
                        colorPrimary={r.color_primary}
                        colorAccent={r.color_accent}
                      />
                    ))}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {r.first_name} {r.last_initial}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {divisionKey !== "jiu_jitsu" && r.uses_belts !== false && (
                        <Badge
                          variant="outline"
                          style={beltLabelStyle(r.color_primary, r.color_accent)}
                        >
                          {r.rank_short_name}
                        </Badge>
                      )}

                      <span>{r.class_name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-black leading-none text-primary">
                      {r.period_points}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">pts</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function PodiumCard({
  rank,
  row,
  accent,
  isJiuJitsu,
}: {
  rank: 1 | 2 | 3;
  row: Row;
  accent: "gold" | "silver" | "bronze";
  isJiuJitsu: boolean;
}) {
  const accents = {
    gold: {
      ring: "border-yellow-400/60 shadow-[0_0_40px_-8px_rgba(250,204,21,0.5)]",
      chip: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-black",
      icon: <Trophy className="h-6 w-6" aria-hidden="true" />,
      label: "1st Place",
    },
    silver: {
      ring: "border-slate-300/50",
      chip: "bg-gradient-to-br from-slate-200 to-slate-400 text-black",
      icon: <Medal className="h-6 w-6" aria-hidden="true" />,
      label: "2nd Place",
    },
    bronze: {
      ring: "border-amber-700/50",
      chip: "bg-gradient-to-br from-amber-500 to-amber-800 text-white",
      icon: <Award className="h-6 w-6" aria-hidden="true" />,
      label: "3rd Place",
    },
  }[accent];

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border-2 bg-card p-6 text-center transition-transform hover:-translate-y-1 ${accents.ring}`}
    >
      <div
        className={`absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-background ${accents.chip}`}
      >
        {accents.icon}
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
        Rank {rank} · {accents.label}
      </div>
      <div className="mt-3 font-display text-xl font-bold uppercase">
        {row.first_name} {row.last_initial}
      </div>
      {!isJiuJitsu && (
        <div className="mt-3 flex justify-center">
          {row.uses_belts === false ? (
            <LevelChip name={row.rank_name} />
          ) : (
            <BeltSwatch
              name={row.rank_name}
              pattern={row.pattern}
              colorPrimary={row.color_primary}
              colorAccent={row.color_accent}
            />
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        {!isJiuJitsu && row.uses_belts !== false && (
          <Badge variant="outline" style={beltLabelStyle(row.color_primary, row.color_accent)}>
            {row.rank_name}
          </Badge>
        )}
        <span>{row.class_name}</span>
      </div>
      <div className="mt-auto pt-5">
        <div className="font-display text-5xl font-black leading-none text-gradient-red">
          {row.period_points}
        </div>
        <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
          Dojo Points this month
        </div>
      </div>
    </div>
  );
}
