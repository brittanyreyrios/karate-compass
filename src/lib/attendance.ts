import { supabase } from "@/integrations/supabase/client";

export type AttendanceChange = {
  studentId: string;
  /** Signed change actually applied to both the counter and the log. */
  delta: number;
  /** Signed change the caller asked for, so callers can report partial results. */
  requested: number;
  newTotal: number;
};

/**
 * Single funnel for every attendance change: keeps students.attendance_count
 * (the denormalized counter) and the attendance_events log in step.
 *
 * attendance_events has no delta column — the count is the number of rows — so
 * an increase inserts that many dated rows and a decrease deletes the newest
 * rows, following the same precedent as revertPointEvent(): remove the audit
 * row rather than writing a fictional negative one, so the log stays truthful.
 *
 * A decrease can be larger than the number of rows on file. In that case only
 * what exists is removed and `delta` reports the smaller applied change; the
 * caller is responsible for telling the admin it was partial.
 *
 * Structural limitation, shared with awardPoints(): the counter update and the
 * log write are two separate client-side statements, not one transaction. A
 * failure between them can leave the counter changed with the log out of step.
 */
export async function changeAttendance(opts: {
  studentId: string;
  currentAttendance: number;
  delta: number;
}): Promise<AttendanceChange> {
  const requested = opts.delta;
  if (requested === 0) {
    return { studentId: opts.studentId, delta: 0, requested, newTotal: opts.currentAttendance };
  }

  if (requested > 0) {
    const newTotal = opts.currentAttendance + requested;
    const { error } = await supabase
      .from("students")
      .update({ attendance_count: newTotal })
      .eq("id", opts.studentId);
    if (error) throw error;

    // Dated today: we do not invent past dates for classes we have no record of.
    const today = new Date().toISOString().slice(0, 10);
    const { data: u } = await supabase.auth.getUser();
    const rows = Array.from({ length: requested }, () => ({
      student_id: opts.studentId,
      occurred_on: today,
      created_by: u.user?.id ?? null,
    }));
    const { error: logErr } = await supabase.from("attendance_events").insert(rows);
    if (logErr) throw logErr;

    return { studentId: opts.studentId, delta: requested, requested, newTotal };
  }

  // Decrease: remove the N most recent log rows and lower the counter to match.
  const wanted = Math.min(-requested, opts.currentAttendance);
  if (wanted <= 0) {
    return { studentId: opts.studentId, delta: 0, requested, newTotal: opts.currentAttendance };
  }

  const { data: recent, error: readErr } = await supabase
    .from("attendance_events")
    .select("id")
    .eq("student_id", opts.studentId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(wanted);
  if (readErr) throw readErr;

  const ids = (recent ?? []).map((r) => r.id);
  const applied = ids.length;
  if (applied === 0) {
    return { studentId: opts.studentId, delta: 0, requested, newTotal: opts.currentAttendance };
  }

  const newTotal = Math.max(0, opts.currentAttendance - applied);
  const { error: updErr } = await supabase
    .from("students")
    .update({ attendance_count: newTotal })
    .eq("id", opts.studentId);
  if (updErr) throw updErr;

  const { error: delErr } = await supabase.from("attendance_events").delete().in("id", ids);
  if (delErr) throw delErr;

  return { studentId: opts.studentId, delta: -applied, requested, newTotal };
}
