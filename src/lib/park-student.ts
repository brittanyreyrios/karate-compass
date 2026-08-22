/**
 * Parking a student until their parent signs up.
 *
 * `handle_new_user` consumes rows from `pending_student_imports` at signup by
 * matching `parent_email` case-insensitively. That means the *only* thing that
 * makes a parked row work is the email being stored trimmed and lowercase — a
 * stray capital or trailing space is a child who never appears.
 *
 * There is therefore exactly ONE writer of that table in the app, and it lives
 * here: both the CSV importer and the single Add Student form call `parkStudent`.
 * Do not add a second insert path.
 */
import { supabase } from "@/integrations/supabase/client";

export function normalizeParentEmail(email: string) {
  return email.trim().toLowerCase();
}

export type ParkStudentInput = {
  firstName: string;
  lastName: string;
  /** Normalised inside this function — callers may pass raw input. */
  parentEmail: string;
  /** Display label only; the id below is what makes the child arrive enrolled. */
  className: string;
  classId: string | null;
  /** Belt *text* fallback for rows whose rank could not be resolved. */
  currentBelt: string;
  /** Resolved rank, when the caller knows it exactly. Never re-resolved later. */
  beltRankId?: string | null;
  startDate?: string | null;
};

export async function parkStudent(input: ParkStudentInput) {
  const email = normalizeParentEmail(input.parentEmail);
  const { error } = await supabase.from("pending_student_imports").insert({
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    parent_email: email,
    class_name: input.className,
    class_id: input.classId,
    current_belt: input.currentBelt,
    ...(input.beltRankId ? { belt_rank_id: input.beltRankId } : {}),
    ...(input.startDate ? { start_date: input.startDate } : {}),
  });
  if (error) throw error;
  return { email };
}

/** The account that would own this child, if it exists already. */
export async function findProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, family_name, email")
    .ilike("email", normalizeParentEmail(email))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Duplicate guard. This roster has had duplicate-student problems, so before
 * parking we look for the same child already parked for that email, and for the
 * same child already on the roster under an account with that email.
 */
export async function findDuplicateStudent(opts: {
  firstName: string;
  lastName: string;
  parentEmail: string;
  parentId?: string | null;
}) {
  const email = normalizeParentEmail(opts.parentEmail);
  const first = opts.firstName.trim();
  const last = opts.lastName.trim();

  const { data: parked, error: parkedErr } = await supabase
    .from("pending_student_imports")
    .select("id, first_name, last_name, parent_email")
    .ilike("parent_email", email)
    .ilike("first_name", first)
    .ilike("last_name", last);
  if (parkedErr) throw parkedErr;
  if ((parked ?? []).length > 0) return { kind: "parked" as const };

  if (opts.parentId) {
    const { data: existing, error: exErr } = await supabase
      .from("students")
      .select("id, active")
      .eq("parent_id", opts.parentId)
      .ilike("first_name", first)
      .ilike("last_name", last)
      .eq("active", true);
    if (exErr) throw exErr;
    if ((existing ?? []).length > 0) return { kind: "student" as const };
  }

  return null;
}
