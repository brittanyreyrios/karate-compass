import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { chicagoTodayKey } from "@/lib/schedule-time";
import {
  TRENDS_EARLIEST, WEEKDAY_LABELS, addDays, classRate, diffDays, shortDate, weekStart, weekdayMon0,
} from "@/lib/trends";

type Range = "4" | "8" | "all";
const PAGE = 1000;

/** Supabase caps each request at 1000 rows, so page with .range() until a short page. */
async function fetchAllEvents(table: "attendance_events" | "absence_events") {
  const rows: { student_id: string; occurred_on: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("student_id, occurred_on")
      .order("occurred_on", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function loadTrends() {
  const [att, abs, students, enroll, classes, holidays] = await Promise.all([
    fetchAllEvents("attendance_events"),
    fetchAllEvents("absence_events"),
    supabase.from("students").select("id, first_name, last_name, class_name, consecutive_absences, active").range(0, 4999),
    supabase.from("student_classes").select("student_id, class_id").range(0, 9999),
    supabase.from("class_schedules").select("id, class_name, days"),
    supabase.from("class_holidays").select("class_name, holiday_date").range(0, 9999),
  ]);
  for (const r of [students, enroll, classes, holidays]) if (r.error) throw r.error;
  return {
    att, abs,
    students: students.data ?? [], enroll: enroll.data ?? [],
    classes: classes.data ?? [], holidays: holidays.data ?? [],
  };
}

function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      {title && <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">{title}</h3>}
      {children}
    </section>
  );
}
function Foot({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs text-muted-foreground">{children}</p>;
}
function Tile({ label, value, note, accent }: { label: string; value: number | string; note: string; accent?: "red" | "yellow" }) {
  const border = accent === "red" ? "border-l-4 border-l-red-500" : accent === "yellow" ? "border-l-4 border-l-yellow-400" : "";
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${border}`}>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
function RunPill({ n }: { n: number }) {
  if (n < 2) return <span className="text-muted-foreground">—</span>;
  const cls = n >= 3 ? "border-red-500/60 bg-red-500/20 text-red-100" : "border-yellow-400/60 bg-yellow-400/20 text-yellow-100";
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${cls}`}>{n} absences</span>;
}

const axis = { fill: "var(--muted-foreground)", fontSize: 12 };

export function TrendsTab({ onOpenStudent }: { onOpenStudent: (name: string) => void }) {
  const [range, setRange] = useState<Range>("all");
  const [showAll, setShowAll] = useState(false);
  const q = useQuery({ queryKey: ["admin-trends"], queryFn: loadTrends });

  const today = chicagoTodayKey();
  const yesterday = addDays(today, -1);
  const thisWeek = weekStart(today);
  const lastWeek = addDays(thisWeek, -7);

  const view = useMemo(() => {
    const d = q.data;
    if (!d) return null;
    const att = d.att.filter((e) => e.occurred_on >= TRENDS_EARLIEST && e.occurred_on <= today);
    const abs = d.abs.filter((e) => e.occurred_on >= TRENDS_EARLIEST && e.occurred_on <= today);
    const countWeek = (rows: typeof att, ws: string) => rows.filter((e) => weekStart(e.occurred_on) === ws).length;

    // Weekly range (includes the current partial week)
    let rangeStart = range === "all" ? TRENDS_EARLIEST : addDays(thisWeek, -7 * (Number(range) - 1));
    if (rangeStart < TRENDS_EARLIEST) rangeStart = TRENDS_EARLIEST;
    rangeStart = weekStart(rangeStart);
    const weeks: { ws: string; label: string; checkins: number; absences: number; partial: boolean }[] = [];
    for (let ws = rangeStart; ws <= thisWeek; ws = addDays(ws, 7)) {
      const partial = ws === thisWeek;
      weeks.push({ ws, label: shortDate(ws) + (partial ? "*" : ""), checkins: countWeek(att, ws), absences: countWeek(abs, ws), partial });
    }
    const weekday = WEEKDAY_LABELS.map((label) => ({ label, checkins: 0 }));
    for (const e of att) if (e.occurred_on >= rangeStart) weekday[weekdayMon0(e.occurred_on)]!.checkins++;

    // Tiles
    const lastWeekCheckins = countWeek(att, lastWeek);
    const avgWeeks = Array.from({ length: 8 }, (_, i) => addDays(lastWeek, -7 * i)).filter((w) => w >= TRENDS_EARLIEST);
    const avg8 = avgWeeks.length ? Math.round(avgWeeks.reduce((s, w) => s + countWeek(att, w), 0) / avgWeeks.length) : 0;
    const lastWeekAbs = countWeek(abs, lastWeek);
    const fourEarlier = addDays(lastWeek, -28);
    const fourEarlierAbs = countWeek(abs, fourEarlier);

    const active = d.students.filter((s) => s.active);
    const activeIds = new Set(active.map((s) => s.id));
    const lastSeen = new Map<string, string>();
    for (const e of d.att) if (e.occurred_on <= today && (lastSeen.get(e.student_id) ?? "") < e.occurred_on) lastSeen.set(e.student_id, e.occurred_on);
    const cutoff14 = addDays(today, -13); // seen within the last 14 days (inclusive of today)
    const followUp = active.filter((s) => s.consecutive_absences >= 3).length;
    const notSeen = active.filter((s) => (lastSeen.get(s.id) ?? "") < cutoff14).length;
    const neverSeen = active.filter((s) => !lastSeen.has(s.id)).length;

    // By class (last 4 weeks, ending yesterday)
    const winStart = addDays(yesterday, -27);
    const checkinSet = new Set(d.att.map((e) => `${e.student_id}|${e.occurred_on}`));
    const kidsByClass = new Map<string, Set<string>>();
    for (const r of d.enroll) {
      if (!activeIds.has(r.student_id)) continue;
      if (!kidsByClass.has(r.class_id)) kidsByClass.set(r.class_id, new Set());
      kidsByClass.get(r.class_id)!.add(r.student_id);
    }
    const byClass = d.classes
      .filter((c) => (c.days ?? "").trim() && (kidsByClass.get(c.id)?.size ?? 0) > 0)
      .map((c) => {
        const kids = [...(kidsByClass.get(c.id) ?? [])];
        const holidays = new Set(d.holidays.filter((h) => h.class_name === c.class_name).map((h) => h.holiday_date));
        const r = classRate({ days: c.days, kids, holidays, windowStart: winStart, windowEnd: yesterday, checkins: checkinSet });
        return { id: c.id, name: c.class_name, days: c.days ?? "", kids: kids.length, ...r };
      })
      .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));

    // Who to check on
    const a4Start = addDays(today, -27), b4Start = addDays(today, -55);
    const absCount = (id: string, from: string, to: string) =>
      d.abs.filter((e) => e.student_id === id && e.occurred_on >= from && e.occurred_on <= to).length;
    const watch = active
      .filter((s) => s.consecutive_absences >= 2 || (lastSeen.has(s.id) && lastSeen.get(s.id)! < cutoff14))
      .map((s) => ({
        id: s.id,
        name: [s.first_name ?? "", s.last_name ?? ""].filter(Boolean).join(" ") || "Unnamed student",
        className: s.class_name ?? "—",
        run: s.consecutive_absences,
        last: lastSeen.get(s.id) ?? null,
        recent: absCount(s.id, a4Start, today),
        prior: absCount(s.id, b4Start, addDays(a4Start, -1)),
      }))
      .sort((a, b) => b.run - a.run || (a.last ?? "").localeCompare(b.last ?? ""));

    return {
      weeks, weekday, lastWeekCheckins, avg8, lastWeekAbs, fourEarlier, fourEarlierAbs,
      followUp, notSeen, neverSeen, activeCount: active.length, byClass, watch,
      hasData: att.length + abs.length > 0,
    };
  }, [q.data, range, today, yesterday, thisWeek, lastWeek]);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Attendance trends</h2>
        <p className="mt-1 text-sm text-muted-foreground">Check-ins and absences from the Attendance screen, by week, class and day.</p>
      </div>
      <div className="inline-flex rounded-lg border border-border p-1" role="group" aria-label="Date range">
        {([["4", "4 weeks"], ["8", "8 weeks"], ["all", "Since Sep 28"]] as const).map(([v, label]) => (
          <Button key={v} size="sm" variant={range === v ? "default" : "ghost"} aria-pressed={range === v} onClick={() => setRange(v)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );

  if (q.isPending) {
    return (
      <div className="space-y-4">
        {header}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    );
  }
  if (q.isError || !view) {
    return <div className="space-y-4">{header}<Card><p className="text-sm text-muted-foreground">We couldn't load attendance trends. Please refresh and try again.</p></Card></div>;
  }
  if (!view.hasData) {
    return <div className="space-y-4">{header}<Card><p className="text-sm text-muted-foreground">No check-ins or absences since Sep 28 yet. Trends will appear once staff start marking attendance.</p></Card></div>;
  }

  const absDiff = view.lastWeekAbs - view.fourEarlierAbs;
  const watchRows = showAll ? view.watch : view.watch.slice(0, 25);

  return (
    <div className="space-y-4">
      {header}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Check-ins last full week" value={view.lastWeekCheckins} note={`Week of ${shortDate(lastWeek)} · 8-week avg ${view.avg8}`} />
        <Tile label="Absences marked" value={view.lastWeekAbs}
          note={`${absDiff === 0 ? "Same as" : absDiff > 0 ? `${absDiff} more than` : `${-absDiff} fewer than`} week of ${shortDate(view.fourEarlier)} (${view.fourEarlierAbs})`} />
        <Tile label="Need a follow-up" value={view.followUp} note="Students absent 3+ classes in a row" accent="red" />
        <Tile label="Not seen in 14+ days" value={view.notSeen} note={`Of ${view.activeCount} active · ${view.neverSeen} never checked in`} accent="yellow" />
      </div>

      <Card title="Week by week">
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-foreground" /> Check-ins</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> Absences marked</span>
        </div>
        <div className="mt-2 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={view.weeks} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <Bar dataKey="checkins" fill="var(--foreground)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {view.weeks.map((w) => <Cell key={w.ws} fillOpacity={w.partial ? 0.35 : 0.9} />)}
                <LabelList dataKey="checkins" position="top" style={{ fill: "var(--foreground)", fontSize: 11 }} />
              </Bar>
              <Line dataKey="absences" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--primary)" }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <Foot>* This week so far. Absence marking started the week of Oct 12, so earlier weeks show none.</Foot>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By class">
          <p className="mt-1 text-xs text-muted-foreground">Last 4 weeks, {shortDate(addDays(yesterday, -27))} – {shortDate(yesterday)}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">Days</th><th className="py-2 pr-3">Kids</th><th className="py-2">Attendance rate</th></tr>
              </thead>
              <tbody>
                {view.byClass.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{c.days}</td>
                    <td className="py-2 pr-3">{c.kids}</td>
                    <td className="py-2">
                      {c.rate === 0 ? (
                        <span className="inline-flex whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">No check-ins</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, c.rate * 100)}%` }} /></div>
                          <span className="tabular-nums">{Math.round(c.rate * 100)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {view.byClass.length === 0 && <tr><td colSpan={4} className="py-4 text-muted-foreground">No classes with days and enrolled kids.</td></tr>}
              </tbody>
            </table>
          </div>
          <Foot>Rate = check-ins on that class's days ÷ (kids enrolled × classes held). "No check-ins" usually means attendance isn't being taken there in the portal.</Foot>
        </Card>

        <Card title="By weekday">
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.weekday} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Bar dataKey="checkins" fill="var(--foreground)" fillOpacity={0.9} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="checkins" position="top" style={{ fill: "var(--foreground)", fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Foot>Check-ins per day of the week over the selected range.</Foot>
        </Card>
      </div>

      <Card title="Who to check on">
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Student</th><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">In a row</th>
                <th className="py-2 pr-3">Last check-in</th><th className="py-2 pr-3">Absences, last 4 wks vs 4 before</th><th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {watchRows.map((s) => {
                const diff = s.recent - s.prior;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{s.className}</td>
                    <td className="py-2 pr-3"><RunPill n={s.run} /></td>
                    <td className="py-2 pr-3 whitespace-nowrap">{s.last ? `${shortDate(s.last)} (${diffDays(today, s.last)}d)` : "Never"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                      {s.recent} vs {s.prior}{" "}
                      {diff > 0 ? <span className="text-red-400">▲ +{diff}</span> : diff < 0 ? <span className="text-green-400">▼ {diff}</span> : <span className="text-muted-foreground">same</span>}
                    </td>
                    <td className="py-2 text-right"><Button size="sm" variant="outline" onClick={() => onOpenStudent(s.name)}>Open student</Button></td>
                  </tr>
                );
              })}
              {view.watch.length === 0 && <tr><td colSpan={6} className="py-4 text-muted-foreground">Nobody needs a check-in right now.</td></tr>}
            </tbody>
          </table>
        </div>
        {view.watch.length > 25 && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show top 25" : `Show all ${view.watch.length}`}
          </Button>
        )}
        <Foot>Red at 3+ in a row, yellow at 2, matching the badges on the Attendance screen.</Foot>
      </Card>

      <Card title="How it's counted">
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>Check-ins and absences come from the same Present/Absent buttons staff already use.</li>
          <li>Check-ins don't record which class, so class rates match each check-in to the classes a kid is enrolled in on that weekday (a kid in two same-day classes counts once per day).</li>
          <li>Holidays marked in Schedules are left out of "classes held".</li>
        </ul>
      </Card>
    </div>
  );
}
