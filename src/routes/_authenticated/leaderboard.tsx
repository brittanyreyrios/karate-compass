import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Medal, Award, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BELT_PROGRESSION } from "@/lib/dojo-constants";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Dojo Leaderboard — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Top 10 students at Tiger's Den ranked by Dojo Points." },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  current_belt: string;
  class_name: string;
  points: number;
};

function beltColor(name: string) {
  return BELT_PROGRESSION.find((b) => b.name.toLowerCase() === name.toLowerCase())?.color ?? "#f8fafc";
}

function LeaderboardPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const rows = q.data ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 10);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <Flame className="h-3 w-3" /> Tiger's Den Rankings
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">
          Dojo <span className="text-gradient-red">Leaderboard</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Top 10 warriors by Dojo Points. Earn them on the mat.</p>
      </header>

      {q.isLoading && <p className="mt-10 text-center text-sm text-muted-foreground">Loading rankings…</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No students ranked yet.</p>
      )}

      {podium.length > 0 && (
        <section className="mt-10 grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
          {/* Silver (2nd) */}
          {podium[1] && <PodiumCard rank={2} row={podium[1]} accent="silver" heightClass="sm:pt-10" />}
          {/* Gold (1st) - centered / tallest */}
          {podium[0] && <PodiumCard rank={1} row={podium[0]} accent="gold" heightClass="sm:-mt-6" />}
          {/* Bronze (3rd) */}
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
                  {i + 4}
                </div>
                <div
                  className="h-8 w-2 shrink-0 rounded-sm border border-border/50"
                  style={{ backgroundColor: beltColor(r.current_belt) }}
                  aria-label={`${r.current_belt} belt`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.first_name} {r.last_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="border-primary/40 text-primary">{r.current_belt}</Badge>
                    <span>{r.class_name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-black leading-none text-primary">{r.points}</div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">pts</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
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
      icon: <Trophy className="h-6 w-6" />,
      label: "1st Place",
    },
    silver: {
      ring: "border-slate-300/50",
      chip: "bg-gradient-to-br from-slate-200 to-slate-400 text-black",
      icon: <Medal className="h-6 w-6" />,
      label: "2nd Place",
    },
    bronze: {
      ring: "border-amber-700/50",
      chip: "bg-gradient-to-br from-amber-500 to-amber-800 text-white",
      icon: <Award className="h-6 w-6" />,
      label: "3rd Place",
    },
  }[accent];

  return (
    <div className={`relative rounded-2xl border-2 bg-card p-6 text-center transition-transform hover:-translate-y-1 ${accents.ring} ${heightClass ?? ""}`}>
      <div className={`absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-background ${accents.chip}`}>
        {accents.icon}
      </div>
      <div className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">{accents.label}</div>
      <div className="mt-3 font-display text-xl font-bold uppercase">
        {row.first_name} {row.last_name}
      </div>
      <div
        className="mx-auto mt-3 h-2 w-16 rounded-full border border-border/50"
        style={{ backgroundColor: beltColor(row.current_belt) }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-primary/40 text-primary">{row.current_belt}</Badge>
        <span>{row.class_name}</span>
      </div>
      <div className="mt-5">
        <div className="font-display text-5xl font-black leading-none text-gradient-red">{row.points}</div>
        <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Dojo Points</div>
      </div>
    </div>
  );
}
