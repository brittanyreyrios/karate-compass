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
  kind: "closure" | "event";
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function buildCalendarItems(options: {
  holidays: HolidayRow[];
  events: DojoEvent[];
}): CalendarItem[] {
  const { holidays, events } = options;
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
