/**
 * Calendar helpers.
 *
 * The calendar is deliberately *not* the weekly timetable. Recurring classes
 * live on the dashboard (ClassScheduleCard) and parents know them by heart —
 * drawing forty recurring rows a month here buried the two or three things that
 * actually need attention. Only exceptions are rendered: special events from
 * `events`, and closures from `class_holidays`.
 */


export type EventType =
  | "special_class"
  | "swat_team"
  | "tournament"
  | "testing"
  | "seminar"
  | "closure"
  | "other";

export type DojoEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  audience_label: string | null;
  published: boolean;
  announcement_id: string | null;
};




export type TournamentRow = {
  id: string;
  title: string;
  body: string | null;
  discipline: string | null;
  location: string | null;
  venue: string | null;
  address: string | null;
  divisions: string | null;
  event_date: string;
  event_end_date: string | null;
  registration_deadline: string | null;
  event_url: string | null;
};

export type HolidayRow = {
  id: string;
  class_name: string;
  holiday_date: string;
  note: string | null;
};

/**
 * One chip recipe, seven hues.
 *
 * Every type carries its own token pair (solid tinted surface + paired
 * foreground), so nothing is distinguished by opacity alone and text contrast
 * never depends on the surface underneath. Colour is never the only signal: the
 * label always ships with the chip, and Closure additionally gets a dashed
 * border so a cancelled class survives colour-blindness and greyscale
 * screenshots.
 */
export const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold leading-5";

export const EVENT_TYPE_META: Record<EventType, { label: string; badge: string }> = {
  testing: { label: "Belt Testing", badge: "border-ev-testing-line bg-ev-testing text-ev-testing-fg" },
  tournament: {
    label: "Tournament",
    badge: "border-ev-tournament-line bg-ev-tournament text-ev-tournament-fg",
  },
  special_class: { label: "Special Class", badge: "border-ev-special-line bg-ev-special text-ev-special-fg" },
  swat_team: { label: "SWAT Team", badge: "border-ev-swat-line bg-ev-swat text-ev-swat-fg" },
  seminar: { label: "Seminar", badge: "border-ev-seminar-line bg-ev-seminar text-ev-seminar-fg" },
  other: { label: "Event", badge: "border-ev-other-line bg-ev-other text-ev-other-fg" },
  closure: {
    label: "Closure",
    badge: "border-dashed border-ev-closure-line bg-ev-closure text-ev-closure-fg",
  },
};

/** Closures come from class_holidays and have no event_type of their own. */
export const CLOSURE_META = {
  label: "No class",
  badge: "border-dashed border-ev-closure-line bg-ev-closure text-ev-closure-fg",
};

export function chipMeta(eventType: EventType | null) {
  return eventType ? EVENT_TYPE_META[eventType] : CLOSURE_META;
}

export const EVENT_TYPES = Object.keys(EVENT_TYPE_META) as EventType[];

export function toDateKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export type CalendarItem = {
  key: string;
  dateKey: string;
  kind: "closure" | "event" | "tournament";
  title: string;
  timeLabel: string | null;
  sortMinutes: number;
  location: string | null;
  audienceLabel: string | null;
  description: string | null;
  eventType: EventType | null;
  cancelled: boolean;
  cancelNote: string | null;
  /** "Day 1 of 2" for multi-day tournaments; null for single-day items. */
  dayLabel: string | null;
  venue: string | null;
  address: string | null;
  registrationDeadline: string | null;
  eventUrl: string | null;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function buildCalendarItems(options: {
  holidays: HolidayRow[];
  events: DojoEvent[];
  tournaments?: TournamentRow[];
}): CalendarItem[] {
  const { holidays, events, tournaments = [] } = options;
  const items: CalendarItem[] = [];

  // A closure is the one schedule-related thing that will make a parent drive to
  // a locked door, so it stays on the calendar as an item in its own right.
  for (const h of holidays) {
    items.push({
      key: `closure-${h.id}`,
      dateKey: h.holiday_date,
      kind: "closure",
      title: `${h.class_name} — no class`,
      timeLabel: null,
      sortMinutes: -2,
      location: null,
      audienceLabel: null,
      description: null,
      eventType: null,
      cancelled: true,
      cancelNote: h.note ?? null,
      dayLabel: null,
      venue: null,
      address: null,
      registrationDeadline: null,
      eventUrl: null,
    });
  }

  for (const e of events) {
    const starts = new Date(e.starts_at);
    const dateKey = toDateKey(starts);
    const ends = e.ends_at ? new Date(e.ends_at) : null;
    items.push({
      key: `event-${e.id}`,
      dateKey,
      kind: "event",
      title: e.title,
      timeLabel: e.all_day
        ? "All day"
        : ends
          ? `${formatTime(starts)} – ${formatTime(ends)}`
          : formatTime(starts),
      sortMinutes: e.all_day ? -1 : starts.getHours() * 60 + starts.getMinutes(),
      location: e.location,
      audienceLabel: e.audience_label,
      description: e.description,
      eventType: e.event_type,
      cancelled: e.event_type === "closure",
      cancelNote: null,
      dayLabel: null,
      venue: null,
      address: null,
      registrationDeadline: null,
      eventUrl: null,
    });
  }

  for (const t of tournaments) {
    const days = dateKeyRange(t.event_date, t.event_end_date);
    days.forEach((dateKey, i) => {
      items.push({
        key: days.length > 1 ? `tournament-${t.id}-${dateKey}` : `tournament-${t.id}`,
        dateKey,
        kind: "tournament",
        title: t.title,
        // Tournaments are dated, not timed — the schedule comes from the
        // promoter, so we never invent a start time.
        timeLabel: days.length > 1 ? `Day ${i + 1} of ${days.length}` : "All day",
        sortMinutes: -1,
        location: t.venue || t.location,
        audienceLabel: t.divisions ?? t.discipline,
        description: t.body,
        eventType: "tournament",
        cancelled: false,
        cancelNote: null,
        dayLabel: days.length > 1 ? `Day ${i + 1} of ${days.length}` : null,
        venue: t.venue,
        address: t.address,
        registrationDeadline: t.registration_deadline,
        eventUrl: t.event_url,
      });
    });
  }

  return items.sort((a, b) =>
    a.dateKey === b.dateKey ? a.sortMinutes - b.sortMinutes : a.dateKey < b.dateKey ? -1 : 1,
  );
}


/**
 * Inclusive list of yyyy-mm-dd keys from `start` to `end`. A tournament without
 * an end date, or with an end date before its start, is a single day.
 */
export function dateKeyRange(start: string, end: string | null): string[] {
  const first = dateFromKey(start);
  const last = end ? dateFromKey(end) : first;
  if (last < first) return [toDateKey(first)];
  const keys: string[] = [];
  const cursor = new Date(first);
  // Guard against a bad end date producing an unbounded loop.
  while (cursor <= last && keys.length < 60) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function groupByDate(items: CalendarItem[]): { dateKey: string; items: CalendarItem[] }[] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const bucket = map.get(item.dateKey);
    if (bucket) bucket.push(item);
    else map.set(item.dateKey, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dateKey, dayItems]) => ({ dateKey, items: dayItems }));
}

export function formatDayHeading(dateKey: string): string {
  return dateFromKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
