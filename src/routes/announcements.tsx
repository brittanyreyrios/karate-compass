import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Trophy, MapPin, Calendar, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SCHOOL_NEWS, TOURNAMENTS } from "@/lib/mock-data";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Iron Dojo" },
      { name: "description", content: "School news and upcoming tournament schedule." },
    ],
  }),
  component: Announcements,
});

function Announcements() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="text-[10px] uppercase tracking-[0.3em] text-primary">Stay informed</div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          School <span className="text-gradient-red">Announcements</span>
        </h1>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* School News */}
        <section>
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">School News</h2>
          </div>

          <div className="mt-4 space-y-4">
            {SCHOOL_NEWS.map((n, i) => (
              <article
                key={n.id}
                className={`group relative overflow-hidden rounded-2xl border p-6 transition-all hover:border-primary/60 ${
                  i === 0 ? "border-primary/50 bg-gradient-hero" : "border-border bg-card"
                }`}
              >
                {i === 0 && (
                  <div className="absolute right-4 top-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                    <Pin className="h-3 w-3" /> Pinned
                  </div>
                )}
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {n.tag}
                </Badge>
                <h3 className="mt-3 font-display text-xl font-bold uppercase tracking-wide group-hover:text-primary">
                  {n.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
                <div className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {n.date}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Tournaments */}
        <section>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase tracking-wide">
              Upcoming Tournaments
            </h2>
          </div>

          <ol className="relative mt-4 space-y-4 border-l-2 border-border pl-6">
            {TOURNAMENTS.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[31px] top-4 grid h-6 w-6 place-items-center rounded-full border-2 border-primary bg-background shadow-red-glow">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <article className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/60">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={
                        t.discipline === "Jiu-Jitsu"
                          ? "bg-primary/15 text-primary hover:bg-primary/20"
                          : "bg-foreground/10 text-foreground hover:bg-foreground/15"
                      }
                    >
                      {t.discipline}
                    </Badge>
                    <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">
                      {t.daysAway} days
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold uppercase leading-tight">
                    {t.title}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {t.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {t.date}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
