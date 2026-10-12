import { supabase } from "@/integrations/supabase/client";
import { GYM_TIMEZONE } from "@/lib/schedule-time";

/**
 * Every absence change goes through a row-locking database function
 * (mark_absent / remove_absence / check_in_student) — never a client update of
 * students.consecutive_absences.
 */
export type AbsenceMark = { studentId: string; absenceId: string; streak: number };

export async function markAbsent(studentId: string): Promise<AbsenceMark> {
  const { data, error } = await supabase.rpc("mark_absent", { _student_id: studentId });
  if (error) throw error;
  const r = data as unknown as { student_id: string; absence_id: string; streak: number };
  return { studentId: r.student_id, absenceId: r.absence_id, streak: r.streak };
}

export async function removeAbsence(absenceId: string): Promise<{ streak: number }> {
  const { data, error } = await supabase.rpc("remove_absence", { _absence_id: absenceId });
  if (error) throw error;
  return { streak: (data as unknown as { streak: number }).streak };
}

/** Check-in: +1 attendance and streak reset to 0 in one locked transaction. */
export async function checkInStudent(studentId: string): Promise<void> {
  const { error } = await supabase.rpc("check_in_student", { _student_id: studentId });
  if (error) throw error;
}

/** The current calendar year in gym time (America/Chicago). */
export function gymYear(at: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: GYM_TIMEZONE, year: "numeric" }).format(at));
}
