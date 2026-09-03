import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/use-auth";
import { isScheduled } from "@/lib/schedule-time";


/**
 * Round 45 — admin-only lookup of which announcements are still scheduled.
 *
 * Why a separate query instead of extending get_school_news: that function's
 * RETURNS TABLE signature cannot be widened with CREATE OR REPLACE, so adding
 * publish_at would mean DROP + recreate, and a recreated function loses every
 * privilege and defaults to EXECUTE for PUBLIC. Not worth it for a badge.
 *
 * This is safe by construction. The SELECT policy on announcements is
 *   publish_at IS NULL OR publish_at <= now() OR has_role(auth.uid(), 'admin')
 * so a parent running this exact query gets zero future-dated rows back. RLS is
 * the gate and stays the only gate: nothing here filters the news list itself.
 *
 * `.not("publish_at", "is", null)` is a PRESENCE test — "has a schedule set at
 * all" — not a future-vs-now comparison. The future-vs-now decision is made on
 * the client by the existing isScheduled().
 */
export function useScheduledAnnouncements() {
  const { user } = useSession();
  const isAdminQ = useIsAdmin(user?.id);
  const isAdmin = !!isAdminQ.data;
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["announcements", "scheduled-markers"],
    enabled: isAdmin,
    /**
     * Freshness (deliberate, not accidental): the whole point of the marker is
     * that an admin can trust it, so a post that went live twenty minutes ago
     * must not still read "Scheduled".
     *  - short staleTime + a 60s poll bound the error to at most a minute;
     *  - refetchOnWindowFocus catches the common "left the tab open" case;
     *  - the effect below fires an exact-instant invalidation at the next
     *    publish time, so the flip is immediate rather than up-to-60s late,
     *    and it invalidates the whole ["announcements"] prefix so the parent
     *    news feed (get_school_news) picks the post up at the same moment.
     */
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, publish_at")
        .not("publish_at", "is", null);
      if (error) throw error;
      return (data ?? []) as { id: string; publish_at: string }[];
    },
  });

  const rows = q.data ?? [];

  /** id → publish_at, only for rows still in the future per isScheduled(). */
  const scheduled = new Map<string, string>();
  for (const r of rows) {
    if (isScheduled(r.publish_at)) scheduled.set(r.id, r.publish_at);
  }

  // Exact-instant refresh at the soonest upcoming publish time.
  const nextAt = rows.reduce<number | null>((soonest, r) => {
    const t = Date.parse(r.publish_at);
    if (!Number.isFinite(t) || t <= Date.now()) return soonest;
    return soonest === null || t < soonest ? t : soonest;
  }, null);

  useEffect(() => {
    if (!isAdmin || nextAt === null) return;
    const delay = Math.max(0, nextAt - Date.now()) + 1_000;
    // setTimeout caps at ~24.8 days; anything further out is handled by the poll.
    if (delay > 2_000_000_000) return;
    const t = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
    }, delay);
    return () => clearTimeout(t);
  }, [isAdmin, nextAt, qc]);

  return { isAdmin, scheduled };
}

/**
 * Round 52 — the same admin gate Round 45 used, as one function.
 *
 * Events carry publish_at on the row itself, so no lookup query is needed: the
 * only thing the surfaces need is "am I an admin". Kept here rather than copied
 * into three components so the marker's visibility rule lives in one place.
 * Nothing above is changed.
 */
export function useShowScheduledMarker(): boolean {
  const { user } = useSession();
  const isAdminQ = useIsAdmin(user?.id);
  return !!isAdminQ.data;
}
