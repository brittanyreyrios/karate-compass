/** Pure date-only (gym-time) helpers for the admin Trends tab. Dates are "YYYY-MM-DD". */
export const TRENDS_EARLIEST = "2026-09-28";

const toUTC = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1);
};
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromUTC(toUTC(d) + n * 86400000);
export const diffDays = (a: string, b: string) => Math.round((toUTC(a) - toUTC(b)) / 86400000);
/** 0 = Monday … 6 = Sunday */
export const weekdayMon0 = (d: string) => (new Date(toUTC(d)).getUTCDay() + 6) % 7;
export const weekStart = (d: string) => addDays(d, -weekdayMon0(d));
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const shortDate = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${day}`;
};

/** "Mon/Wed" → {0,2}. Unknown tokens are ignored. */
export function parseClassDays(days: string | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const tok of (days ?? "").split(/[^A-Za-z]+/)) {
    const i = ["mon","tue","wed","thu","fri","sat","sun"].indexOf(tok.slice(0, 3).toLowerCase());
    if (i >= 0) out.add(i);
  }
  return out;
}

export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface ClassRateInput {
  days: string | null;
  kids: string[]; // active enrolled student ids
  holidays: Set<string>;
  windowStart: string;
  windowEnd: string;
  checkins: Set<string>; // `${studentId}|${date}`
}
/** Rate = distinct (kid, date) check-ins on class days ÷ (kids × classes held). */
export function classRate(i: ClassRateInput) {
  const wd = parseClassDays(i.days);
  const held = datesBetween(i.windowStart, i.windowEnd).filter(
    (d) => wd.has(weekdayMon0(d)) && !i.holidays.has(d),
  );
  let hits = 0;
  for (const d of held) for (const k of i.kids) if (i.checkins.has(`${k}|${d}`)) hits++;
  const denom = i.kids.length * held.length;
  return { held: held.length, checkins: hits, rate: denom ? hits / denom : 0 };
}
