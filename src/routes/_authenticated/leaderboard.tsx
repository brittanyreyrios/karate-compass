import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Medal, Award, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BeltSwatch } from "@/components/belt-chip";
import { beltLabelStyle } from "@/lib/belt-colors";
import { useBeltSystems } from "@/lib/belts";
import { LeaderboardSkeleton } from "@/components/skeletons";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Dojo Leaderboard — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "Monthly Dojo Point rankings at Tiger's Den, with a separate board for each belt system.",
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
};

function LeaderboardPage() {
  const qc = useQueryClient();
  const systemsQ = useBeltSystems();
  const systems = systemsQ.data ?? [];
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const slug = activeSlug ?? systems[0]?.slug ?? null;

  const q = useQuery({
    queryKey: ["leaderboard", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", {
        _system_slug: slug!,
        _period: "month",
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const showSkeleton = useDelayedLoading(q.isLoading);

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
    const last = systems.length - 1;
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
    const target = systems[next];
    if (target) {
      setActiveSlug(target.slug);
      document.getElementById(`lb-tab-${target.slug}`)?.focus();
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
          Top 10 by Dojo Points earned this month, with a separate board for each belt system.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-xs text-muted-foreground">
          Leaderboard resets on the 1st of each month. Your all-time points are on your dashboard and
          never reset.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Belt system leaderboards"
        className="mt-8 flex flex-wrap justify-center gap-2"
      >
        {systems.map((s, i) => {
          const selected = s.slug === slug;
          return (
            <button
              key={s.slug}
              id={`lb-tab-${s.slug}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`lb-panel-${s.slug}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveSlug(s.slug)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      <div
        id={slug ? `lb-panel-${slug}` : undefined}
        role="tabpanel"
        aria-labelledby={slug ? `lb-tab-${slug}` : undefined}
        tabIndex={0}
      >
        {showSkeleton && <LeaderboardSkeleton />}

        {!showSkeleton && !q.isLoading && rows.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground">
              No points logged yet this month. Be the first on the board!
            </p>
          </div>
        )}

        {podium.length > 0 && (
          <section className="mt-10 grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
            {podium[1] && <PodiumCard rank={2} row={podium[1]} accent="silver" heightClass="sm:pt-10" />}
            {podium[0] && <PodiumCard rank={1} row={podium[0]} accent="gold" heightClass="sm:-mt-6" />}
            {podium[2] && <PodiumCard rank={3} row={podium[2]} accent="bronze" heightClass="sm:pt-14" />}
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
                  <BeltSwatch
                    name={r.rank_name}
                    pattern={r.pattern}
                    colorPrimary={r.color_primary}
                    colorAccent={r.color_accent}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {r.first_name} {r.last_initial}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        style={beltLabelStyle(r.color_primary, r.color_accent)}
                      >
                        {r.rank_short_name}
                      </Badge>
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
  heightClass,
}: {
  rank: 1 | 2 | 3;
  row: Row;
  accent: "gold" | "silver" | "bronze";
  heightClass?: string;
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
      className={`relative rounded-2xl border-2 bg-card p-6 text-center transition-transform hover:-translate-y-1 ${accents.ring} ${heightClass ?? ""}`}
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
      <div className="mt-3 flex justify-center">
        <BeltSwatch
          name={row.rank_name}
          pattern={row.pattern}
          colorPrimary={row.color_primary}
          colorAccent={row.color_accent}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" style={beltLabelStyle(row.color_primary, row.color_accent)}>
          {row.rank_name}
        </Badge>
        <span>{row.class_name}</span>
      </div>
      <div className="mt-5">
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
