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
  disciplines: string[] | null;
};


/**
 * The four disciplines, defined ONCE. Adding a fifth is a one-line change here —
 * deliberately not a CHECK constraint, matching how the technique library's
 * labels already work.
 */
export const DISCIPLINES = ["Karate", "Jiu Jitsu", "Wrestling", "Striking"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export function isKnownDiscipline(value: string): value is Discipline {
  return (DISCIPLINES as readonly string[]).includes(value);
}

/**
 * Discipline chips reuse the CHIP_BASE recipe, so they match the existing
 * event-type badges in shape and sizing. Each carries its text label — a
 * colour-blind parent reads "Jiu Jitsu", never just a blue dot. Hues are
 * deliberately distinct from the event-type palette so "Tournament · Jiu Jitsu"
 * reads as two different kinds of fact.
 */
export const DISCIPLINE_META: Record<Discipline, { label: string; badge: string }> = {
  Karate: { label: "Karate", badge: "border-dsc-karate-line bg-dsc-karate text-dsc-karate-fg" },
  "Jiu Jitsu": { label: "Jiu Jitsu", badge: "border-dsc-jj-line bg-dsc-jj text-dsc-jj-fg" },
  Wrestling: { label: "Wrestling", badge: "border-dsc-wrestling-line bg-dsc-wrestling text-dsc-wrestling-fg" },
  Striking: { label: "Striking", badge: "border-dsc-striking-line bg-dsc-striking text-dsc-striking-fg" },
};

/** Unknown values still render, in a neutral chip, so a typo is visible rather than silent. */
const UNKNOWN_DISCIPLINE_BADGE = "border-ev-other-line bg-ev-other text-ev-other-fg";

export function disciplineBadge(value: string): string {
  return isKnownDiscipline(value) ? DISCIPLINE_META[value].badge : UNKNOWN_DISCIPLINE_BADGE;
}

/** Trimmed, de-duplicated, empty values dropped. Unknown values are KEPT. */
export function cleanDisciplines(value: string[] | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.map((v) => v.trim()).filter(Boolean))];
}

export type TournamentRow = {
  id: string;
  title: string;
  body: string | null;
  discipline: string | null;
  disciplines: string[] | null;
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
 * A belt test is *derived* from class_schedules.next_test_date — the single
 * source of truth — rather than mirrored into an events row. Moving a date
 * therefore moves the calendar entry, and a stale entry is impossible.
 */
export type TestRow = {
  id: string;
  class_name: string;
  next_test_date: string;
  location: string | null;
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
  kind: "closure" | "event" | "tournament" | "testing";
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
  /**
   * One field, both sources: events.disciplines and the tournament row's
   * disciplines both land here, so the filter never has to care which table an
   * item came from. Closures and testing dates are always [].
   */
  disciplines: string[];
};

/**
 * Client-side filter. The rule that matters: an item is hidden ONLY if it
 * carries at least one KNOWN discipline and none of them is selected. Untagged
 * items — closures, belt testing dates, general events — and items tagged only
 * with values outside DISCIPLINES always survive, because there is no chip that
 * could ever bring them back.
 */
export function filterByDisciplines(items: CalendarItem[], selected: string[]): CalendarItem[] {
  if (selected.length === 0) return items;
  return items.filter((item) => {
    const known = item.disciplines.filter(isKnownDiscipline);
    if (known.length === 0) return true;
    return known.some((d) => selected.includes(d));
  });
}

/** Chips only appear when something in view actually carries a known tag. */
export function hasKnownDisciplineTags(items: CalendarItem[]): boolean {
  return items.some((item) => item.disciplines.some(isKnownDiscipline));
}


function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function buildCalendarItems(options: {
  holidays: HolidayRow[];
  events: DojoEvent[];
  tournaments?: TournamentRow[];
  tests?: TestRow[];
}): CalendarItem[] {
  const { holidays, events, tournaments = [], tests = [] } = options;
  const items: CalendarItem[] = [];

  // Belt tests are grouped by DATE, not by class. With 12 classes, a shared
  // testing day would otherwise draw twelve identical chips and bury everything
  // else on that day; the classes themselves are listed in the day detail.
  const testsByDate = new Map<string, TestRow[]>();
  for (const t of tests) {
    const bucket = testsByDate.get(t.next_test_date);
    if (bucket) bucket.push(t);
    else testsByDate.set(t.next_test_date, [t]);
  }
  for (const [dateKey, rows] of testsByDate) {
    const classes = rows.map((r) => r.class_name).sort();
    // Locations only appear if the classes actually carry one, and only when
    // they agree — we never invent or guess a testing venue.
    const locations = [...new Set(rows.map((r) => r.location).filter(Boolean))] as string[];
    items.push({
      key: `testing-${dateKey}`,
      dateKey,
      kind: "testing",
      title: "Belt Testing",
      // No time is stored on next_test_date, so none is shown.
      timeLabel: null,
      sortMinutes: -1,
      location: locations.length === 1 ? locations[0]! : null,
      audienceLabel: classes.length === 1 ? classes[0]! : `${classes.length} classes`,
      description: `Testing: ${classes.join(", ")}.`,
      eventType: "testing",
      cancelled: false,
      cancelNote: null,
      dayLabel: null,
      venue: null,
      address: null,
      registrationDeadline: null,
      eventUrl: null,
      disciplines: [],
    });
  }



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
      disciplines: [],
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
      disciplines: cleanDisciplines(e.disciplines),
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
        // Tournaments come from announcements, so their tags come from the
        // array there; the legacy `discipline` column is the fallback for any
        // row written before this feature existed.
        disciplines: cleanDisciplines(
          t.disciplines && t.disciplines.length > 0 ? t.disciplines : t.discipline ? [t.discipline] : [],
        ),
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
