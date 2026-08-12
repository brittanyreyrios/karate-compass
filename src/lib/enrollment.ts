/**
 * Round 12 AS — class membership as a real relationship.
 *
 * Before this, a student held one `class_name` text value and every screen
 * matched classes by comparing strings. A child in karate *and* jiu jitsu could
 * not be recorded at all, and two places compared names slightly differently.
 *
 * Membership now lives in `student_classes` (student_id, class_id, is_primary).
 * `students.class_name` still exists but is written ONLY by a database trigger
 * from the primary enrollment — treat it as a display label, never as truth, and
 * never write it from application code.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClassRow = {
  id: string;
  class_name: string;
  is_teen_adult: boolean;
  program_id: string | null;
};

export type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  is_primary: boolean;
  created_at: string;
};

export type Program = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

/** Every class, by id. The id is the only safe way to identify a class. */
export function useClasses() {
  return useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_schedules")
        .select("id, class_name, is_teen_adult, program_id")
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });
}

/**
 * All enrollment rows the caller may see. Row-level security narrows this to a
 * parent's own children automatically, so the same hook serves both audiences.
 */
export function useEnrollments() {
  return useQuery({
    queryKey: ["student-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_classes")
        .select("id, student_id, class_id, is_primary, created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Enrollment[];
    },
  });
}

export function usePrograms() {
  return useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, sort_order, active")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });
}

/** Query keys every enrollment change has to invalidate, in one place. */
export const ENROLLMENT_KEYS = [
  ["student-enrollments"],
  ["admin-students"],
  ["class-student-counts"],
  ["classes-list"],
  ["leaderboard"],
  ["my-division"],
] as const;

export type EnrollmentIndex = {
  /** Enrollment rows per student, oldest first. */
  byStudent: Map<string, Enrollment[]>;
  /** Student ids per class — a student appears under every class they are in. */
  studentsByClass: Map<string, Set<string>>;
};

export function indexEnrollments(rows: Enrollment[] | undefined): EnrollmentIndex {
  const byStudent = new Map<string, Enrollment[]>();
  const studentsByClass = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    const list = byStudent.get(r.student_id);
    if (list) list.push(r);
    else byStudent.set(r.student_id, [r]);

    const set = studentsByClass.get(r.class_id);
    if (set) set.add(r.student_id);
    else studentsByClass.set(r.class_id, new Set([r.student_id]));
  }
  return { byStudent, studentsByClass };
}
