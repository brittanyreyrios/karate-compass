import { supabase } from "@/integrations/supabase/client";

export type PointAward = {
  studentId: string;
  delta: number;
  newTotal: number;
  eventId: string | null;
};

type AwardRow = {
  student_id: string;
  delta: number;
  new_total: number;
  event_id: string | null;
};

/**
 * Single funnel for every Dojo Point change. The counter update on students and
 * the point_events audit row are now one transaction inside
 * public.award_points(), so the two can no longer drift apart if a call fails
 * halfway. The database re-reads the student's total under a row lock, which is
 * why `currentPoints` is no longer used for the arithmetic — it is kept in the
 * options only so existing call sites need no change.
 */
export async function awardPoints(opts: {
  studentId: string;
  currentPoints: number;
  delta: number;
  reason?: string | null;
}): Promise<PointAward> {
  const { data, error } = await supabase.rpc("award_points", {
    _student_id: opts.studentId,
    _delta: opts.delta,
    _reason: opts.reason ?? null,
  });
  if (error) throw error;

  const row = data as unknown as AwardRow;

  // event_id is null ONLY on the zero-change path, where nothing was written.
  // If the counter moved and we still have no audit row id, something is wrong
  // and we must say so: a silent null here would let the Undo action report
  // success while reverting nothing.
  if (row.delta !== 0 && !row.event_id) {
    throw new Error("Points were recorded without an audit row — refresh and check the student's total");
  }

  return {
    studentId: row.student_id,
    delta: row.delta,
    newTotal: row.new_total,
    eventId: row.event_id,
  };
}

/**
 * Undo: public.revert_point_event() reads the amount from the audit row itself
 * and deletes it, rather than trusting numbers the client cached. A null
 * eventId therefore means the award wrote nothing at all (zero delta), so
 * there is nothing to revert.
 */
export async function revertPointEvent(opts: {
  studentId: string;
  currentPoints: number;
  delta: number;
  eventId: string | null;
}): Promise<void> {
  if (!opts.eventId) return;
  const { error } = await supabase.rpc("revert_point_event", { _event_id: opts.eventId });
  if (error) throw error;
}
