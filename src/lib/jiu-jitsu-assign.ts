/**
 * Round 14 AX — one wording for the assignment result, shared by the CSV import
 * summary and the admin button's toast.
 */
export type JiuJitsuAssignResult = {
  assigned: number;
  skipped: number;
  skipped_students: unknown[];
};

export function jiuJitsuAssignmentSummary(res: JiuJitsuAssignResult): string {
  const parts: string[] = [];
  if (res.assigned > 0) {
    parts.push(
      `${res.assigned} jiu jitsu student${res.assigned === 1 ? " was" : "s were"} given the Jiu Jitsu level.`,
    );
  } else {
    parts.push("No students needed the Jiu Jitsu level.");
  }
  if (res.skipped > 0) {
    parts.push(
      `${res.skipped} rankless student${res.skipped === 1 ? " was" : "s were"} skipped because they also train another programme — check their belt.`,
    );
  }
  return parts.join(" ");
}
