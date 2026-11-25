/**
 * Shared text normaliser for browser-side search: trim, lowercase, collapse
 * internal whitespace. Used by the tournament bulk entry picker and the
 * Manage Students search so both match names the same way.
 */
export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Browser-side roster search for Manage Students. Null-safe: names and
 * guardian names can be null or empty, so every value is coalesced before
 * normalising — a student with a null last_name must never throw while
 * searching, and the full name must never contain the literal "null".
 */
export function studentMatchesSearch(
  s: { first_name: string | null; last_name: string | null; parent_id: string | null },
  term: string,
  guardianNameById: Map<string, string>,
): boolean {
  const first = norm(s.first_name ?? "");
  const last = norm(s.last_name ?? "");
  const full = norm(`${s.first_name ?? ""} ${s.last_name ?? ""}`);
  const guardian = s.parent_id ? norm(guardianNameById.get(s.parent_id) ?? "") : "";
  return (
    first.includes(term) ||
    last.includes(term) ||
    full.includes(term) ||
    guardian.includes(term)
  );
}
