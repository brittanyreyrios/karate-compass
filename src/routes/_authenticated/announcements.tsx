import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Trophy, MapPin, Calendar, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PremiumGate } from "@/components/premium-gate";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "School news and upcoming tournament schedule." },
    ],
  }),
  component: () => (
    <PremiumGate feature="The Community Feed">
      <Announcements />
    </PremiumGate>
  ),
});

type Announcement = {
  id: string;
  category: "school_news" | "tournament";
  title: string;
  body: string;
  tag: string | null;
  discipline: string | null;
  location: string | null;
  event_date: string | null;
  created_at: string;
};

function Announcements() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Announcement[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("ann-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        qc.invalidateQueries({ queryKey: ["announcements"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const news = (data ?? []).filter((a) => a.category === "school_news");
  const tournaments = (data ?? []).filter((a) => a.category === "tournament");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="text-xs uppercase tracking-[0.3em] text-primary">Stay informed</div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          School <span className="text-gradient-red">Announcements</span>
        </h1>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">School News</h2>
          </div>
          <div className="mt-4 space-y-4">
            {news.length === 0 && <p className="text-sm text-muted-foreground">No news yet.</p>}
            {news.map((n, i) => (
              <article key={n.id} className={`group relative overflow-hidden rounded-2xl border p-6 transition-all hover:border-primary/60 ${i === 0 ? "border-primary/50 bg-gradient-hero" : "border-border bg-card"}`}>
                {i === 0 && (
                  <div className="absolute right-4 top-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
                    <Pin className="h-3 w-3" /> Latest
                  </div>
                )}
                {n.tag && <Badge variant="outline" className="border-primary/40 text-primary">{n.tag}</Badge>}
                <h3 className="mt-3 font-display text-xl font-bold uppercase tracking-wide group-hover:text-primary">{n.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
                <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">Upcoming Tournaments</h2>
          </div>
          <ol className="relative mt-4 space-y-4 border-l-2 border-border pl-6">
            {tournaments.length === 0 && <p className="text-sm text-muted-foreground">No tournaments yet.</p>}
            {tournaments.map((t) => {
              const days = t.event_date ? Math.max(0, Math.ceil((new Date(t.event_date).getTime() - Date.now()) / 86400000)) : null;
              return (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[31px] top-4 grid h-6 w-6 place-items-center rounded-full border-2 border-primary bg-background shadow-red-glow">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <article className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/60">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className={t.discipline === "Jiu-Jitsu" ? "bg-primary/15 text-primary hover:bg-primary/20" : "bg-foreground/10 text-foreground hover:bg-foreground/15"}>
                        {t.discipline ?? "Event"}
                      </Badge>
                      {days !== null && <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">{days} days</span>}
                    </div>
                    <h3 className="mt-3 font-display text-lg font-bold uppercase leading-tight">{t.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.location}</span>}
                      {t.event_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(t.event_date).toLocaleDateString()}</span>}
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
