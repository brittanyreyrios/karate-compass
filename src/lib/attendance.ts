import { supabase } from "@/integrations/supabase/client";

export type AttendanceChange = {
  studentId: string;
  /** Signed change actually applied to both the counter and the log. */
  delta: number;
  /** Signed change the caller asked for, so callers can report partial results. */
  requested: number;
  newTotal: number;
};

type ChangeRow = {
  student_id: string;
  delta: number;
  requested: number;
  new_total: number;
};

/**
 * Single funnel for every attendance change: public.change_attendance() keeps
 * students.attendance_count (the denormalized counter) and the
 * attendance_events log in step inside ONE transaction, under a row lock on the
 * student, so a failure or a concurrent admin can no longer leave the counter
 * and the log disagreeing.
 *
 * attendance_events has no delta column — the count is the number of rows — so
 * an increase inserts that many rows dated today and a decrease deletes the
 * newest rows, rather than writing a fictional negative one, so the log stays
 * truthful.
 *
 * A decrease can be larger than the number of rows on file. In that case only
 * what exists is removed and `delta` reports the smaller applied change; the
 * caller is responsible for telling the admin it was partial.
 *
 * `currentAttendance` is no longer used for the arithmetic (the database reads
 * it under lock) and is kept only so existing call sites need no change.
 */
export async function changeAttendance(opts: {
  studentId: string;
  currentAttendance: number;
  delta: number;
}): Promise<AttendanceChange> {
  const { data, error } = await supabase.rpc("change_attendance", {
    _student_id: opts.studentId,
    _delta: opts.delta,
  });
  if (error) throw error;

  const row = data as unknown as ChangeRow;
  return {
    studentId: row.student_id,
    delta: row.delta,
    requested: row.requested,
    newTotal: row.new_total,
  };
}
