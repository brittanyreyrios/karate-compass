/**
 * Tiny pluralization helper so counts never render as "1 days".
 *
 *   plural(1, "class", "classes")  -> "class"
 *   plural(3, "day")               -> "days"
 *   count(1, "day")                -> "1 day"
 */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return Math.abs(n) === 1 ? singular : (pluralForm ?? `${singular}s`);
}

export function count(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${plural(n, singular, pluralForm)}`;
}
