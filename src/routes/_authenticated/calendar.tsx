import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, List, MapPin, Users, Clock, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarGrid } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_TYPE_META,
  buildCalendarItems,
  groupByDate,
  formatDayHeading,
  toDateKey,
  type CalendarItem,
  type DojoEvent,
  type HolidayRow,
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

  const items = useMemo(
    () =>
      buildCalendarItems({
        holidays: holidaysQ.data ?? [],
        events: eventsQ.data ?? [],
      }),
    [holidaysQ.data, eventsQ.data],
  );

  return { items, loading: holidaysQ.isLoading || eventsQ.isLoading };
}


function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [view, setView] = useState<"list" | "month">("list");

  const { items, loading } = useCalendarData(month);

  const todayKey = toDateKey(today);
  const agenda = useMemo(
    () => groupByDate(items.filter((i) => i.dateKey >= todayKey)).slice(0, 30),
    [items, todayKey],
  );

  const selectedKey = toDateKey(selected);
  const selectedItems = items.filter((i) => i.dateKey === selectedKey);
  const eventDays = useMemo(() => [...new Set(items.map((i) => i.dateKey))], [items]);


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
            seminars and closures. Your regular weekly class times are on the dashboard.
          </p>

        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <div
            className="hidden items-center gap-1 rounded-md border border-border p-1 sm:flex"
            role="group"
            aria-label="Calendar view"
          >
            <Button
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> List
            </Button>
            <Button
              size="sm"
              variant={view === "month" ? "default" : "ghost"}
              onClick={() => setView("month")}
              aria-pressed={view === "month"}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Month
            </Button>
          </div>
        </div>
      </header>

      <Legend />

      {/* Phone: agenda always. Desktop: honours the toggle. */}
      <div className={view === "month" ? "hidden sm:block" : "block"}>
        {view === "month" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr]">
            <div className="rounded-2xl border border-border bg-card p-3">
              <CalendarGrid
                mode="single"
                selected={selected}
                onSelect={(d) => d && setSelected(d)}
                month={month}
                onMonthChange={setMonth}
                modifiers={{ hasEvent: (d) => eventDays.includes(toDateKey(d)) }}
                modifiersClassNames={{ hasEvent: "font-bold underline decoration-primary decoration-2" }}
              />
            </div>
            <DayPanel dateKey={selectedKey} items={selectedItems} />
          </div>
        ) : null}
      </div>

      <div className={view === "month" ? "block sm:hidden" : "block"}>
        <section className="mt-6 space-y-6" aria-label="Upcoming schedule">
          {loading && <p className="text-sm text-muted-foreground">Loading calendar…</p>}
          {!loading && agenda.length === 0 && (
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
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-6 flex flex-wrap gap-2" aria-label="Calendar key">
      <li>
        <Badge variant="outline" className="border-border text-muted-foreground line-through">
          No class
        </Badge>
      </li>

          No class
        </Badge>
      </li>
      {Object.entries(EVENT_TYPE_META).map(([type, meta]) => (
        <li key={type}>
          <Badge variant="outline" className={meta.badge}>
            {meta.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function DayPanel({ dateKey, items }: { dateKey: string; items: CalendarItem[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6" aria-live="polite">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">{formatDayHeading(dateKey)}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled.</p>
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
  const meta = item.eventType ? EVENT_TYPE_META[item.eventType] : null;
  return (
    <article
      className={`rounded-xl border p-4 ${
        item.cancelled ? "border-border bg-muted/40" : "border-border bg-background/60 hover:border-primary/50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={meta ? meta.badge : "border-border text-muted-foreground"}>
          {meta ? meta.label : "Weekly class"}
        </Badge>
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
      </div>
    </article>
  );
}
