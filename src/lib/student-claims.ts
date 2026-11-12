import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CLAIM_FAILURE = "We couldn't link your child automatically. Please see the front desk.";
export const SIGNUP_FAILURE = "We couldn't create your account just now. Please try again, or contact the front desk if it keeps happening.";

export function normalizeClaimCode(code: string) { return code.trim().toUpperCase(); }
export function claimSucceeded(result: unknown): result is { success: true; student_id: string } {
  return typeof result === "object" && result !== null && "success" in result && result.success === true &&
    "student_id" in result && typeof result.student_id === "string";
}
export async function refreshClaimViews(qc: QueryClient) {
  await Promise.all(["students-mine", "students-mine-curriculum", "my-students-poll", "my-division", "leaderboard", "winners-circle", "curriculum-for-children", "student-enrollments"].map(
    (key) => qc.invalidateQueries({ queryKey: [key] }),
  ));
}
export async function claimMyChild(code: string) {
  const { data, error } = await supabase.rpc("claim_student", { code: normalizeClaimCode(code) });
  if (error || !claimSucceeded(data)) throw new Error(CLAIM_FAILURE);
  const child = await supabase.from("students").select("id,first_name,attendance_count").eq("id", data.student_id).single();
  if (child.error || !child.data) throw new Error(CLAIM_FAILURE);
  return child.data;
}