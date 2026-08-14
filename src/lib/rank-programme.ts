/**
 * Round 14 AY — surface the mismatch the app used to hide.
 *
 * `division_of()` decides a leaderboard division from the student's belt rank,
 * not from their classes, so moving a child between programmes never moves their
 * division and nothing on screen said so. This flags it. It never corrects it:
 * a real karate belt is information a human entered deliberately.
 *
 * The programme a belt system belongs to lives in ONE place —
 * `belt_systems.program_id` — so no slug strings appear here.
 */
import type { BeltRank, BeltSystem } from "@/lib/belts";
import type { ClassRow, Enrollment } from "@/lib/enrollment";

export type MismatchInput = {
  student: { id: string; active: boolean; belt_rank_id: string | null };
  enrollments: Enrollment[] | undefined;
  classes: ClassRow[];
  ranks: BeltRank[];
  systems: BeltSystem[];
};

/**
 * True when a student has a rank, is active, trains in at least one class with a
 * known programme, and their rank's programme is none of those programmes.
 *
 * Dual-programme children are correct by construction: a karate belt matches the
 * karate class they are also enrolled in, so one match is enough.
 */
export function isRankProgrammeMismatch({
  student,
  enrollments,
  classes,
  ranks,
  systems,
}: MismatchInput): boolean {
  if (!student.active || !student.belt_rank_id) return false;

  const rank = ranks.find((r) => r.id === student.belt_rank_id);
  if (!rank) return false;
  const system = systems.find((s) => s.id === rank.system_id);
  // An unmapped belt system can't disagree with anything.
  if (!system?.program_id) return false;

  const classById = new Map(classes.map((c) => [c.id, c] as const));
  const programmes = new Set<string>();
  for (const e of enrollments ?? []) {
    if (e.student_id !== student.id) continue;
    const programId = classById.get(e.class_id)?.program_id;
    if (programId) programmes.add(programId);
  }

  // A student in no programmed class is a different problem, already counted.
  if (programmes.size === 0) return false;
  return !programmes.has(system.program_id);
}
