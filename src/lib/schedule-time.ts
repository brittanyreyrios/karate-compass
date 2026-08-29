/**
 * publish_at is a timestamptz — an absolute instant — NOT a date-only column.
 * Never run it through parseDateOnly / formatDateOnlyLong from date-only.ts:
 * those exist for Postgres `date` columns and applying them here shifts the
 * time. Everything in this file is ordinary timestamp handling.
 *
 * The gym is in America/Chicago. When staff type "Sep 4, 7:00 AM" they mean
 * 7 AM Texas time, whatever timezone the phone they are holding is in. So the
 * conversion is explicit in both directions and never relies on the browser's
 * own offset.
 */
export const GYM_TIMEZONE = "America/Chicago";

/** The gym's UTC offset (e.g. "-05:00" in CDT, "-06:00" in CST) at an instant. */
function chicagoOffsetAt(utcMs: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GYM_TIMEZONE,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(utcMs));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-06:00";
  const m = name.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "-06:00";
}

/**
 * "2026-09-04" + "07:00" typed by an admin → the ISO instant of 7 AM Chicago.
 *
 * The offset depends on the instant, and the instant depends on the offset, so
 * we guess with the offset that applies to that wall-clock read as UTC, then
 * re-resolve once. That settles DST correctly, including the rare hour either
 * side of a transition.
 */
export function chicagoToInstant(date: string, time: string): string {
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  const naiveUtc = Date.parse(`${date}T${hhmm}:00Z`);
  if (Number.isNaN(naiveUtc)) throw new Error("Pick a valid date and time to schedule.");
  let offset = chicagoOffsetAt(naiveUtc);
  let ms = Date.parse(`${date}T${hhmm}:00${offset}`);
  offset = chicagoOffsetAt(ms);
  ms = Date.parse(`${date}T${hhmm}:00${offset}`);
  return new Date(ms).toISOString();
}

/** The exact inverse — used when editing an already-scheduled row. */
export function instantToChicago(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GYM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

/** Badge text, always in gym time so staff and parents read the same clock. */
export function formatChicagoDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GYM_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Still hidden from parents? Mirrors the RLS predicate, for admin UI only. */
export function isScheduled(publishAt: string | null): boolean {
  return !!publishAt && Date.parse(publishAt) > Date.now();
}

/**
 * A calendar entry built from an announcement's date-only event_date: the gym
 * opens the day, so the event is all-day starting at Chicago midnight. No time
 * is ever invented — if staff want a real start time they set it on the Events
 * tab, which already handles that properly.
 */
export function chicagoStartOfDay(date: string): string {
  return chicagoToInstant(date, "00:00");
}

/** Chicago end-of-day, so a multi-day announcement stays multi-day. */
export function chicagoEndOfDay(date: string): string {
  return chicagoToInstant(date, "23:59");
}

/** announcements.category → events.event_type. Explicit, not derived. */
export function eventTypeForCategory(category: "school_news" | "tournament"): string {
  return category === "tournament" ? "tournament" : "other";
}
