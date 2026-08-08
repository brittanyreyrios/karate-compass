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
  "id, category, title, body, tag, discipline, location, event_date, event_end_date, venue, address, divisions, registration_deadline, spectator_info, event_url, created_at";

/** Local calendar day, not UTC — a date-only column must not shift timezone. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useTournaments(limit?: number) {
  const today = todayKey();
  return useQuery({
    // Under the shared ["announcements", ...] prefix so the existing realtime
    // invalidation keeps hitting it.
    queryKey: ["announcements", "tournaments", limit ?? "all", today],
    queryFn: async () => {
      let query = supabase
        .from("announcements")
        .select(TOURNAMENT_COLUMNS)
        .eq("category", "tournament")
        // Still current if it ends today or later; single-day events use
        // event_date. Undated rows are kept and sort last.
        .or(
          `event_end_date.gte.${today},and(event_end_date.is.null,event_date.gte.${today}),and(event_end_date.is.null,event_date.is.null)`,
        )
        .order("event_date", { ascending: true, nullsFirst: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Tournament[];
    },
  });
}
