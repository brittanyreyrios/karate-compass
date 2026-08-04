import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, List, MapPin, Users, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MonthGrid } from "@/components/month-grid";
import { CalendarSkeleton } from "@/components/skeletons";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import {
  CHIP_BASE,
  EVENT_TYPE_META,
  chipMeta,
  CLOSURE_META,
  buildCalendarItems,
  groupByDate,
  formatDayHeading,
  toDateKey,
  type CalendarItem,
  type DojoEvent,
  type HolidayRow,
  type TournamentRow,
} from "@/lib/calendar-data";


export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "Weekly classes, closures, testing dates and special events at Tiger's Den Martial Arts & Fitness.",
      },
      { property: "og:title", content: "Calendar — Tiger's Den Martial Arts & Fitness" },
      { property: "og:description", content: "Weekly classes, closures, testing dates and special events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

/** Visible month ±1 — we never query the whole events table. */
function monthWindow(month: Date) {
  const from = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 2, 0);
  return { from, to };
}

/**
 * The calendar shows exceptions only: special events and closures. The recurring
 * weekly timetable is on the dashboard, so class_schedules is not queried here.
 */
export function useCalendarData(month: Date) {
  const { from, to } = monthWindow(month);
  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);

  const holidaysQ = useQuery({
    queryKey: ["calendar-holidays", fromKey, toKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_holidays")
        .select("id, class_name, holiday_date, note")
        .gte("holiday_date", fromKey)
        .lte("holiday_date", toKey);
      return (data ?? []) as HolidayRow[];
    },
  });

  const eventsQ = useQuery({
    queryKey: ["calendar-events", fromKey, toKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(
          "id, title, description, event_type, starts_at, ends_at, all_day, location, audience_label, published, announcement_id",
        )
        .eq("published", true)
        .gte("starts_at", `${fromKey}T00:00:00Z`)
        .lte("starts_at", `${toKey}T23:59:59Z`)
        .order("starts_at");
      return (data ?? []) as DojoEvent[];
    },
  });

  /**
   * Tournaments live in `announcements` (category = 'tournament') — that table is
   * the single source of truth and the Tournaments admin is the only place they
   * are edited. Here they are read-only, and any tournament that *overlaps* the
   * window is fetched, not just those starting in it, so a multi-day event that
   * begins in the previous month still draws its remaining days.
   */
  const tournamentsQ = useQuery({
    queryKey: ["calendar-tournaments", fromKey, toKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select(
          "id, title, body, discipline, location, venue, address, divisions, event_date, event_end_date, registration_deadline, event_url",
        )
        .eq("category", "tournament")
        .not("event_date", "is", null)
        .lte("event_date", toKey)
        .or(`event_end_date.gte.${fromKey},and(event_end_date.is.null,event_date.gte.${fromKey})`)
        .order("event_date");
      return (data ?? []) as TournamentRow[];
    },
  });

  const items = useMemo(
    () =>
      buildCalendarItems({
        holidays: holidaysQ.data ?? [],
        events: eventsQ.data ?? [],
        tournaments: tournamentsQ.data ?? [],
      }),
    [holidaysQ.data, eventsQ.data, tournamentsQ.data],
  );

  return {
    items,
    loading: holidaysQ.isLoading || eventsQ.isLoading || tournamentsQ.isLoading,
  };
}


function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [view, setView] = useState<"list" | "month">("list");

  const { items, loading: rawLoading } = useCalendarData(month);
  const loading = useDelayedLoading(rawLoading);

  const todayKey = toDateKey(today);
  const agenda = useMemo(
    () => groupByDate(items.filter((i) => i.dateKey >= todayKey)).slice(0, 30),
    [items, todayKey],
  );

  const selectedKey = toDateKey(selected);
  const selectedItems = items.filter((i) => i.dateKey === selectedKey);


  const goToday = () => {
    setSelected(today);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-primary">What&apos;s on</div>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Dojo <span className="text-gradient-red">Calendar</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Everything that isn&apos;t the normal week — special classes, testing, tournaments,
            seminars, tournaments and closures. Your regular weekly class times are on the
            dashboard.
          </p>

        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-11" onClick={goToday}>
            Today
          </Button>
          {/* The month grid now works on a phone, so the toggle is no longer
              desktop-only — a parent scanning "what's on this month" gets the
              same two views everywhere. */}
          <div
            className="flex items-center gap-1 rounded-md border border-border p-1"
            role="group"
            aria-label="Calendar view"
          >
            <Button
              variant={view === "list" ? "default" : "ghost"}
              className="h-9"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> List
            </Button>
            <Button
              variant={view === "month" ? "default" : "ghost"}
              className="h-9"
              onClick={() => setView("month")}
              aria-pressed={view === "month"}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Month
            </Button>
          </div>
        </div>
      </header>

      <Legend />

      {loading && <CalendarSkeleton />}

      {!loading && view === "month" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <MonthGrid
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={setSelected}
            items={items}
          />
          <DayPanel dateKey={selectedKey} items={selectedItems} />
        </div>
      )}

      {!loading && view === "list" && (
        <section className="mt-6 space-y-6" aria-label="Upcoming schedule">
          {agenda.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing special coming up — regular classes run as normal.
            </p>
          )}

          {agenda.map((day) => (
            <div key={day.dateKey}>
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
                {formatDayHeading(day.dateKey)}
                {day.dateKey === todayKey && <span className="ml-2 text-muted-foreground">· Today</span>}
              </h2>
              <ul className="mt-3 space-y-2">
                {day.items.map((item) => (
                  <li key={item.key}>
                    <ItemCard item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-6 flex flex-wrap gap-2" aria-label="Calendar key">
      {Object.entries(EVENT_TYPE_META).map(([type, meta]) => (
        <li key={type}>
          <span className={`${CHIP_BASE} ${meta.badge}`}>{meta.label}</span>
        </li>
      ))}
      <li>
        <span className={`${CHIP_BASE} ${CLOSURE_META.badge} line-through`}>{CLOSURE_META.label}</span>
      </li>
    </ul>
  );
}

function DayPanel({ dateKey, items }: { dateKey: string; items: CalendarItem[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6" aria-live="polite">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">{formatDayHeading(dateKey)}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing special scheduled — regular classes run as normal.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemCard({ item }: { item: CalendarItem }) {
  const meta = chipMeta(item.eventType);
  return (
    <article
      className={`rounded-xl border p-4 ${
        item.cancelled ? "border-border bg-muted/40" : "border-border bg-background/60 hover:border-primary/50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${CHIP_BASE} ${meta.badge}`}>{meta.label}</span>
        {item.dayLabel && (
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {item.dayLabel}
          </span>
        )}

        {item.cancelled && (
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Ban className="h-3 w-3" aria-hidden="true" /> No class
          </span>
        )}
      </div>
      <h3
        className={`mt-2 font-display text-base font-bold uppercase tracking-wide ${
          item.cancelled ? "text-muted-foreground line-through" : ""
        }`}
      >
        {item.title}
      </h3>
      {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
      {item.cancelNote && <p className="mt-1 text-sm text-muted-foreground">{item.cancelNote}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {item.timeLabel && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" /> {item.timeLabel}
          </span>
        )}
        {item.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" /> {item.location}
          </span>
        )}
        {item.audienceLabel && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" /> {item.audienceLabel}
          </span>
        )}
        {item.address && <span>{item.address}</span>}
        {item.registrationDeadline && (
          <span>Register by {new Date(`${item.registrationDeadline}T12:00:00`).toLocaleDateString()}</span>
        )}
      </div>
      {item.eventUrl && (
        <a
          href={item.eventUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-xs font-semibold text-primary underline"
        >
          Event details
        </a>
      )}
    </article>
  );
}
