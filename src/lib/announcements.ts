import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Round 10 AN — "Upcoming Tournaments" must be ordered by when the event
 * happens, not by when someone posted about it.
 *
 * This is deliberately its OWN query rather than a client-side sort of the main
 * feed. The feed is paginated, so sorting only reorders the page that happened
 * to be fetched: a tournament happening next week but posted months ago falls
 * outside the page and simply never appears. That would look correct and be
 * wrong, which is the worst possible failure for a list headed "Upcoming".
 *
 * Ordering and filtering are therefore both server-side:
 *  - event_date ascending, NULLS LAST — an undated event never leads the list.
 *  - finished events are excluded: past event_date, or past event_end_date where
 *    one is set, matching how the calendar treats a multi-day event as current
 *    until its end date passes.
 *  - a multi-day event sorts by its start date, consistent with the calendar.
 */
export type Tournament = {
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

const TOURNAMENT_COLUMNS =
  "id, category, title, body, tag, discipline, disciplines, location, event_date, event_end_date, venue, address, divisions, registration_deadline, spectator_info, event_url, created_at";

/** Local calendar day, not UTC — a date-only column must not shift timezone. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local yyyy-mm-dd of a timestamptz — the calendar day the parent sees. */
function localDateKey(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** event_date ascending, NULLS LAST — matches the server ordering of each branch. */
function byEventDate(a: Tournament, b: Tournament) {
  if (a.event_date === b.event_date) return 0;
  if (!a.event_date) return 1;
  if (!b.event_date) return -1;
  return a.event_date < b.event_date ? -1 : 1;
}

/**
 * Round 20: announcing a tournament controls whether it also gets a news-feed
 * post, NOT whether it counts as a tournament. So this is a union of two
 * independently ordered branches — tournament announcements, plus published
 * tournament EVENTS that have no announcement (the null check is the de-dup).
 *
 * Top-N correctness: each branch is ordered server-side and fetched with the
 * same `limit`, so the true top-N of the union is guaranteed to be inside the
 * merged 2N rows. We merge, sort, then slice.
 */
export function useTournaments(limit?: number) {
  const today = todayKey();
  return useQuery({
    // Under the shared ["announcements", ...] prefix so the existing realtime
    // invalidation keeps hitting it.
    queryKey: ["announcements", "tournaments", limit ?? "all", today],
    queryFn: async () => {
      let annQuery = supabase
        .from("announcements")
        .select(TOURNAMENT_COLUMNS)
        .eq("category", "tournament")
        // Still current if it ends today or later; single-day events use
        // event_date. Undated rows are kept and sort last.
        .or(
          `event_end_date.gte.${today},and(event_end_date.is.null,event_date.gte.${today}),and(event_end_date.is.null,event_date.is.null)`,
        )
        .order("event_date", { ascending: true, nullsFirst: false });
      if (limit) annQuery = annQuery.limit(limit);

      let evQuery = supabase
        .from("events")
        .select("id, title, description, starts_at, ends_at, location, disciplines")
        .eq("event_type", "tournament")
        .is("announcement_id", null)
        .eq("published", true)
        // Same still-current rule, against the timestamp columns.
        .or(`ends_at.gte.${today},and(ends_at.is.null,starts_at.gte.${today})`)
        .order("starts_at", { ascending: true });
      if (limit) evQuery = evQuery.limit(limit);

      const [annRes, evRes] = await Promise.all([annQuery, evQuery]);
      if (annRes.error) throw annRes.error;
      if (evRes.error) throw evRes.error;

      const fromAnnouncements = (annRes.data ?? []) as Tournament[];

      /**
       * Same merge rule as the calendar: an announcement with no tags of its own
       * inherits the tags of the event that links to it (Westchase WC Kickoff is
       * tagged Wrestling on the event and NULL on the announcement). Announcement
       * tags always win when it has any.
       */
      const annIds = fromAnnouncements.map((a) => a.id);
      if (annIds.length > 0) {
        const { data: linked, error: linkedErr } = await supabase
          .from("events")
          .select("announcement_id, disciplines")
          .in("announcement_id", annIds);
        if (linkedErr) throw linkedErr;
        const tagsByAnnouncement = new Map<string, string[]>();
        for (const row of linked ?? []) {
          const tags = (row.disciplines ?? []).filter((d): d is string => !!d && d.trim() !== "");
          if (row.announcement_id && tags.length > 0)
            tagsByAnnouncement.set(row.announcement_id, tags);
        }
        for (const a of fromAnnouncements) {
          const own = (a.disciplines ?? []).filter((d) => !!d && d.trim() !== "");
          if (own.length === 0 && !a.discipline) {
            const inherited = tagsByAnnouncement.get(a.id);
            if (inherited) a.disciplines = inherited;
          }
        }
      }

      const fromEvents: Tournament[] = (evRes.data ?? []).map((e) => ({
        // Prefixed so a React key can never collide with an announcement id.
        id: `event:${e.id}`,
        category: "tournament",
        title: e.title,
        body: e.description ?? "",
        tag: null,
        discipline: null,
        disciplines: e.disciplines,
        location: e.location,
        event_date: localDateKey(e.starts_at),
        event_end_date: localDateKey(e.ends_at),
        venue: null,
        address: null,
        divisions: null,
        registration_deadline: null,
        spectator_info: null,
        event_url: null,
        created_at: e.starts_at,
      }));

      const merged = [...fromAnnouncements, ...fromEvents].sort(byEventDate);
      return limit ? merged.slice(0, limit) : merged;
    },
  });
}

