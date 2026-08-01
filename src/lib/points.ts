import { supabase } from "@/integrations/supabase/client";

export type PointAward = {
  studentId: string;
  delta: number;
  newTotal: number;
  eventId: string | null;
};

/**
 * Single funnel for every Dojo Point change: updates students.points (the source
 * of truth) and writes an audit row to point_events. Returns the amount added
 * and the new total so the UI can show both.
 */
export async function awardPoints(opts: {
  studentId: string;
  currentPoints: number;
  delta: number;
  reason?: string | null;
}): Promise<PointAward> {
  const newTotal = Math.max(0, opts.currentPoints + opts.delta);
  const applied = newTotal - opts.currentPoints;
  if (applied === 0) return { studentId: opts.studentId, delta: 0, newTotal, eventId: null };

  const { error } = await supabase
    .from("students")
    .update({ points: newTotal })
    .eq("id", opts.studentId);
  if (error) throw error;

  const { data: u } = await supabase.auth.getUser();
  const { data, error: logErr } = await supabase
    .from("point_events")
    .insert({
      student_id: opts.studentId,
      delta: applied,
      reason: opts.reason ?? null,
      awarded_by: u.user?.id ?? null,
    })
    .select("id")
    .maybeSingle();
  if (logErr) throw logErr;

  return { studentId: opts.studentId, delta: applied, newTotal, eventId: data?.id ?? null };
}

/**
 * Undo: subtracts the exact amount again and deletes the audit row rather than
 * writing a negative one, so the log stays truthful.
 */
export async function revertPointEvent(opts: {
  studentId: string;
  currentPoints: number;
  delta: number;
  eventId: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("students")
    .update({ points: Math.max(0, opts.currentPoints - opts.delta) })
    .eq("id", opts.studentId);
  if (error) throw error;
  if (opts.eventId) {
    const { error: delErr } = await supabase.from("point_events").delete().eq("id", opts.eventId);
    if (delErr) throw delErr;
  }
}
