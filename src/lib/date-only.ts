/**
 * The single approach for Postgres `date` columns ("YYYY-MM-DD", no time zone).
 *
 * Never pass a date-only value to `new Date(value)` — that parses as UTC
 * midnight, which renders as the PREVIOUS day in US timezones. Everything here
 * splits the string and builds a local-midnight date instead.
 *
 * Timestamps (`*_at` columns, with an offset) are a different kind of value and
 * are correctly rendered with plain `new Date()` elsewhere — do not route them
 * through these helpers.
 */

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDateOnly(value: string): string {
  return parseDateOnly(value)?.toLocaleDateString() ?? value;
}

/** "Nov 10, 2026" */
export function formatDateOnlyLong(value: string): string {
  return (
    parseDateOnly(value)?.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) ?? value
  );
}

/** "November 10, 2026" */
export function formatDateOnlyFull(value: string): string {
  return (
    parseDateOnly(value)?.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) ?? value
  );
}

/** "Nov 2026" */
export function formatMonthYear(value: string): string {
  return (
    parseDateOnly(value)?.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    }) ?? value
  );
}

export function formatDateRange(start: string, end: string | null): string {
  if (!end) return formatDateOnly(start);
  const starts = parseDateOnly(start);
  const ends = parseDateOnly(end);
  if (!starts || !ends) return `${formatDateOnly(start)}–${formatDateOnly(end)}`;
  const [, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const [startYear] = start.split("-").map(Number);
  if (startYear === endYear && startMonth === endMonth && endDay) {
    return `${starts.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${endDay}, ${endYear}`;
  }
  return `${formatDateOnly(start)}–${formatDateOnly(end)}`;
}

/**
 * Whole local calendar days between today and a date-only value.
 *
 * Both ends are local midnights, so the answer cannot change with the time of
 * day — 8am and 11pm on the same local date give the identical number.
 *
 * Math.round, not Math.ceil: across a daylight-saving boundary the span
 * between two local midnights is N days ± 1 hour (e.g. today → 10 Nov 2026
 * is 74 days + 1 hour = 74.0417 × 86400000 ms). Round returns 74; ceil would
 * return 75. A DST offset can never reach half a day, so rounding is always
 * safe — but only if it is rounding.
 */
export function daysUntilDateOnly(value: string): number | null {
  const target = parseDateOnly(value);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000));
}

/** Whole-and-fraction years since a date-only value, e.g. "2.5". */
export function yearsSinceDateOnly(value: string): string {
  const start = parseDateOnly(value);
  if (!start) return "0.0";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - start.getTime()) / 86400000);
  return (days / 365).toFixed(1);
}

/**
 * Validate/normalise a date-only string for CSV import without ever building a
 * Date from it — `new Date(raw)` would shift non-ISO inputs across zones.
 */
export function normalizeDateOnly(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
