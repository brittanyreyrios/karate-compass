import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chipMeta, toDateKey, type CalendarItem } from "@/lib/calendar-data";

/**
 * Month grid, phone first.
 *
 * shadcn's <Calendar> is a date *picker*: one number per cell and no room for
 * what is actually happening that day, which is the only reason a parent opens
 * this page. This grid keeps the familiar 7-column month shape but renders up to
 * two event chips per day plus a "+N more" line, exactly like the phone calendar
 * apps families already use. Tapping any day selects it and the detail panel
 * below shows the full list, so nothing is hidden behind a hover.
 *
 * Colour is never the only signal: chips carry their own text, closures are
 * struck through, and the selected/today states are outlined as well as tinted.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function startOfGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const d = new Date(first);
  d.setDate(first.getDate() - first.getDay());
  return d;
}

export function MonthGrid({
  month,
  onMonthChange,
  selected,
  onSelect,
  items,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  items: CalendarItem[];
}) {
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const bucket = byDay.get(item.dateKey);
    if (bucket) bucket.push(item);
    else byDay.set(item.dateKey, [item]);
  }

  const gridStart = startOfGrid(month);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  // Six rows only when the month genuinely needs them.
  const weeks = days[35] && days[35].getMonth() === month.getMonth() ? 6 : 5;
  const visible = days.slice(0, weeks * 7);

  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selected);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const shiftMonth = (delta: number) =>
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className="rounded-2xl border border-border bg-card p-2 sm:p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <h2 aria-live="polite" className="truncate text-center font-display text-base font-bold uppercase tracking-wide sm:text-lg">
          {monthLabel}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1" role="row">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            <abbr title={WEEKDAY_NAMES[i]} className="no-underline">{d}</abbr>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {visible.map((day) => {
          const key = toDateKey(day);
          const dayItems = byDay.get(key) ?? [];
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const extra = dayItems.length - 2;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${
                dayItems.length ? `, ${dayItems.length} item${dayItems.length === 1 ? "" : "s"}` : ", nothing scheduled"
              }`}
              className={`flex min-h-[68px] flex-col rounded-md border p-1 text-left transition-colors sm:min-h-[96px] ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-gradient-red text-primary-foreground" : "text-foreground"
                }`}
              >
                {day.getDate()}
              </span>

              <span className="mt-0.5 flex min-w-0 flex-col gap-0.5">
                {dayItems.slice(0, 2).map((item) => {
                  const meta = chipMeta(item.eventType);
                  return (
                    <span
                      key={item.key}
                      title={item.title}
                      /* Two lines of wrapped text, not one truncated word: at
                         phone width a single line collapses "IBJJF Houston Fall
                         Open" to "IB…", which tells a parent nothing. */
                      className={`line-clamp-2 break-words rounded border px-0.5 text-[11px] font-semibold leading-[13px] sm:px-1 ${
                        meta.badge
                      } ${item.cancelled ? "line-through" : ""}`}
                    >
                      {item.title}
                    </span>

                  );
                })}
                {extra > 0 && (
                  <span className="px-1 text-[11px] font-semibold leading-4 text-primary">
                    +{extra} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
