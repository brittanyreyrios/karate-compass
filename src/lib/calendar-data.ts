/**
 * Calendar helpers.
 *
 * Recurring class occurrences are computed client-side from the weekly pattern
 * stored on class_schedules (days / time_start / time_end / location). We never
 * write a database row per class occurrence.
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

export type ClassScheduleRow = {
  class_name: string;
  days: string | null;
  time_start: string | null;
  time_end: string | null;
  location: string | null;
};

export type HolidayRow = {
  id: string;
  class_name: string;
  holiday_date: string;
  note: string | null;
};

/** Colours are paired with a text label everywhere — never colour alone. */
export const EVENT_TYPE_META: Record<EventType, { label: string; badge: string }> = {
  special_class: { label: "Special Class", badge: "border-primary/50 bg-primary/10 text-primary" },
  swat_team: { label: "SWAT Team", badge: "border-primary/50 bg-primary/15 text-primary" },
  tournament: { label: "Tournament", badge: "border-foreground/30 bg-foreground/10 text-foreground" },
  testing: { label: "Belt Testing", badge: "border-primary/60 bg-primary/20 text-primary" },
  seminar: { label: "Seminar", badge: "border-foreground/25 bg-muted text-foreground" },
  closure: { label: "Closure", badge: "border-destructive/50 bg-destructive/10 text-destructive-foreground" },
  other: { label: "Event", badge: "border-border bg-muted text-muted-foreground" },
};

export const EVENT_TYPES = Object.keys(EVENT_TYPE_META) as EventType[];

const DAY_TOKENS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** "Mon/Wed", "Tue, Thu", "Monday & Wednesday" -> [1, 3] */
export function parseDays(days: string | null | undefined): number[] {
  if (!days) return [];
  return days
    .split(/[\/,&+]|\s+and\s+/i)
    .map((part) => DAY_TOKENS[part.trim().toLowerCase()])
    .filter((n): n is number => typeof n === "number");
}

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
  kind: "class" | "event";
  title: string;
  timeLabel: string | null;
  sortMinutes: number;
  location: string | null;
  audienceLabel: string | null;
  description: string | null;
  eventType: EventType | null;
  cancelled: boolean;
  cancelNote: string | null;
};

/** "5:15pm" -> minutes since midnight (for ordering). */
function parseClockMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value.trim());
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function buildCalendarItems(options: {
  from: Date;
  to: Date;
  schedules: ClassScheduleRow[];
  holidays: HolidayRow[];
  events: DojoEvent[];
}): CalendarItem[] {
  const { from, to, schedules, holidays, events } = options;
  const items: CalendarItem[] = [];

  const holidayMap = new Map<string, HolidayRow>();
  for (const h of holidays) holidayMap.set(`${h.class_name}|${h.holiday_date}`, h);

  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cursor <= end) {
    const dateKey = toDateKey(cursor);
    const weekday = cursor.getDay();
    for (const s of schedules) {
      if (!parseDays(s.days).includes(weekday)) continue;
      const holiday = holidayMap.get(`${s.class_name}|${dateKey}`);
      items.push({
        key: `class-${s.class_name}-${dateKey}`,
        dateKey,
        kind: "class",
        title: s.class_name,
        timeLabel: s.time_start && s.time_end ? `${s.time_start} – ${s.time_end}` : s.time_start ?? null,
        sortMinutes: parseClockMinutes(s.time_start),
        location: s.location,
        audienceLabel: null,
        description: null,
        eventType: null,
        cancelled: !!holiday,
        cancelNote: holiday?.note ?? null,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
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
    });
  }

  return items.sort((a, b) =>
    a.dateKey === b.dateKey ? a.sortMinutes - b.sortMinutes : a.dateKey < b.dateKey ? -1 : 1,
  );
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
