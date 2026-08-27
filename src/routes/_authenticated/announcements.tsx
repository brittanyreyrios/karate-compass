import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Trophy, MapPin, Calendar, Pin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDateOnly, formatDateRange } from "@/lib/date-only";
import { ListSkeleton } from "@/components/skeletons";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { QueryErrorState } from "@/components/query-error";
import { useTournaments } from "@/lib/announcements";
import { DisciplineTags } from "@/components/discipline-tags";
import { disciplinesOf } from "@/lib/calendar-data";


export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "School news and upcoming tournament schedule." },
    ],
  }),
  component: Announcements,
});

type Announcement = {
  id: string;
  category: "school_news" | "tournament";
  title: string;
  body: string;
  tag: string | null;
  discipline: string | null;
  disciplines: string[] | null;
  location: string | null;
  event_date: string | null;
  event_end_date: string | null;
  venue: string | null;
  address: string | null;
  divisions: string | null;
  registration_deadline: string | null;
  spectator_info: string | null;
  event_url: string | null;
  created_at: string;
};

const ANNOUNCEMENT_COLUMNS =
  "id, category, title, body, tag, discipline, disciplines, location, event_date, event_end_date, venue, address, divisions, registration_deadline, spectator_info, event_url, created_at";

/** One page of announcements. The archive grows forever; the feed must not. */
const PAGE_SIZE = 20;

function Announcements() {
  const qc = useQueryClient();
  const [limit, setLimit] = useState(PAGE_SIZE);

  /**
   * AB2: paginated and column-explicit. This page used to pull every
   * announcement ever posted with select("*"), so every visit got heavier as the
   * school posted more. It now fetches a page at a time, newest first, and the
   * parent asks for older ones.
   */
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["announcements", "feed", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select(ANNOUNCEMENT_COLUMNS)
        .eq("category", "school_news")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
    placeholderData: (prev) => prev,
  });


  const hasMore = (data?.length ?? 0) >= limit;

  const showSkeleton = useDelayedLoading(isLoading);

  useEffect(() => {
    const ch = supabase
      .channel("ann-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        qc.invalidateQueries({ queryKey: ["announcements"] });
      })
      // Round 20: unannounced tournament EVENTS are part of the tournament
      // union, so an events change must refresh it too.
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["announcements"] });
      })

      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const news = data ?? [];
  /**
   * AN: tournaments come from their own server-ordered query. They are NOT
   * filtered out of a shared feed and sorted here — see src/lib/announcements.ts
   * for why a client-side sort of a paginated feed is silently wrong.
   */
  const tournamentsQ = useTournaments();
  const tournaments = tournamentsQ.data ?? [];
  const showTournamentSkeleton = useDelayedLoading(tournamentsQ.isLoading);


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
            {showSkeleton && <ListSkeleton rows={2} height="h-40" label="Loading school news" />}
            {!showSkeleton && isError && (
              <QueryErrorState what="the school news" onRetry={() => refetch()} />
            )}
            {!showSkeleton && !isLoading && !isError && news.length === 0 && <p className="text-sm text-muted-foreground">No news yet.</p>}
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
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {n.event_date && (
                    <div className="flex items-center gap-1 font-semibold text-foreground">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      {formatDateRange(n.event_date, n.event_end_date)}
                    </div>
                  )}
                  <div>Posted {new Date(n.created_at).toLocaleDateString()}</div>
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
            {showTournamentSkeleton && <ListSkeleton rows={2} height="h-48" label="Loading tournaments" />}
            {!showTournamentSkeleton && tournamentsQ.isError && (
              <QueryErrorState
                what="the tournament schedule"
                onRetry={() => tournamentsQ.refetch()}
              />
            )}
            {!showTournamentSkeleton &&
              !tournamentsQ.isLoading &&
              !tournamentsQ.isError &&
              tournaments.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming tournaments right now.</p>
              )}

            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} variant="full" />
            ))}
          </ol>
        </section>
      </div>

      {hasMore && (
        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            disabled={isFetching}
          >
            {isFetching ? "Loading…" : "Show older announcements"}
          </Button>
        </div>
      )}
    </div>
  );
}
