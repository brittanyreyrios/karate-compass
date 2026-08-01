import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Flame,
  Trophy,
  TrendingUp,
  Clock,
  ChevronRight,
  Megaphone,
  MapPin,
  Swords,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BELT_PROGRESSION, CLASS_CATALOG } from "@/lib/dojo-constants";
import { plural, count } from "@/lib/plural";
import { formatDateRange } from "@/lib/date-only";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Family dashboard: belt progression, next test countdown, attendance and school updates." },
    ],
  }),
  component: Dashboard,
});

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  current_belt: string;
  attendance_count: number;
  start_date: string;
  next_test_date: string | null;
  class_name: string;
  points: number;
};

type Announcement = {
  id: string;
  category: "school_news" | "tournament";
  title: string;
  body: string;
  tag: string | null;
  discipline: string | null;
  location: string | null;
  event_date: string | null;
  event_end_date: string | null;
  venue: string | null;
  address: string | null;
  created_at: string;
};

function Dashboard() {
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const announcementsQ = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Announcement[];
    },
  });

  // Realtime: refresh on any student or announcement change
  useEffect(() => {
    const ch = supabase
      .channel("dash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        qc.invalidateQueries({ queryKey: ["students-mine"] });
        qc.invalidateQueries({ queryKey: ["attendance-year"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_events" }, () => {
        qc.invalidateQueries({ queryKey: ["attendance-year"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        qc.invalidateQueries({ queryKey: ["announcements"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const students = studentsQ.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const student = students.find((s) => s.id === activeId) ?? students[0];

  const news = (announcementsQ.data ?? []).filter((a) => a.category === "school_news").slice(0, 4);
  const tournaments = (announcementsQ.data ?? []).filter((a) => a.category === "tournament").slice(0, 4);

  // Yearly attendance log — counts only classes logged in the current calendar
  // year, so the number naturally resets every January 1st.
  const currentYear = new Date().getFullYear();
  const yearlyAttendanceQ = useQuery({
    queryKey: ["attendance-year", student?.id, currentYear],
    enabled: !!student?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance_events")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student!.id)
        .gte("occurred_on", `${currentYear}-01-01`)
        .lte("occurred_on", `${currentYear}-12-31`);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Hooks must run in the same order on every render — compute derived values
  // BEFORE any conditional early return.
  const daysToTest = useMemo(() => {
    if (!student?.next_test_date) return null;
    const now = typeof window !== "undefined" ? Date.now() : 0;
    const diff = new Date(student.next_test_date).getTime() - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [student?.next_test_date]);

  if (studentsQ.isLoading || profileQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase">Welcome, {profileQ.data?.family_name ?? "Family"}</h1>
        <p className="mt-3 text-muted-foreground">
          No students are linked to your account yet. Ask a Tiger's Den admin to add your child so their progress appears here.
        </p>
      </div>
    );
  }

  const beltIndex = BELT_PROGRESSION.findIndex(
    (b) => b.name.toLowerCase() === student.current_belt.toLowerCase(),
  );
  const totalBelts = BELT_PROGRESSION.length - 1;
  const progressPct = Math.round((Math.max(0, beltIndex) / totalBelts) * 100);

  const classesToTest = daysToTest ? Math.max(1, Math.round(daysToTest / 2)) : null;

  const now = typeof window !== "undefined" ? Date.now() : 0;
  const yearsTraining = ((now - new Date(student.start_date).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-primary">Welcome back</div>
          <h1 className="mt-2 truncate font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl lg:text-5xl">
            The <span className="text-gradient-red">{profileQ.data?.family_name ?? "Family"}</span> Family Dashboard
          </h1>
        </div>

        {students.length > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs uppercase tracking-[0.2em] text-muted-foreground sm:inline">Viewing</span>
            <Select value={student.id} onValueChange={setActiveId}>
              <SelectTrigger className="w-[200px] border-border bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} — {s.current_belt} Belt
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 shadow-elevated sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Road to Black Belt</div>
              <div className="mt-1 font-display text-2xl font-bold uppercase">{student.first_name}'s Journey</div>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl font-black text-gradient-red">{progressPct}%</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Complete</div>
            </div>
          </div>
          <div className="relative mt-8">
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/60">
              <div className="h-full bg-gradient-red shadow-red-glow transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-4 flex justify-between">
              {BELT_PROGRESSION.map((belt, i) => {
                const reached = i <= beltIndex;
                const current = i === beltIndex;
                return (
                  <div key={belt.name} className="flex flex-col items-center gap-2">
                    <div
                      className={`h-6 w-3 rounded-sm border transition-all ${current ? "scale-125 border-primary ring-2 ring-primary/40" : reached ? "border-transparent" : "border-border opacity-40"}`}
                      style={{ backgroundColor: reached ? belt.color : "transparent" }}
                    />
                    <span className={`hidden text-xs font-semibold uppercase tracking-wider sm:block ${current ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground"}`}>
                      {belt.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-red p-6 text-primary-foreground shadow-red-glow sm:p-8">
          <div className="absolute -right-8 -top-8 opacity-10"><Swords className="h-40 w-40" strokeWidth={1.5} /></div>
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/80">
              <Flame className="h-3 w-3" /> Next Belt Test
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-7xl font-black leading-none">{daysToTest ?? "—"}</span>
              <span className="font-display text-lg uppercase tracking-wider">
                {daysToTest === null ? "days" : plural(daysToTest, "day")}
              </span>
            </div>
            <div className="mt-2 text-sm font-medium text-white/80">
              {classesToTest ? `≈ ${count(classesToTest, "class", "classes")} to go` : "No test scheduled"}
            </div>

            {student.next_test_date && (
              <div className="mt-6 flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-xs uppercase tracking-widest">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(student.next_test_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Trophy className="h-5 w-5" />} label="Current Belt" value={`${student.current_belt} Belt`} sub={`Rank ${Math.max(0, beltIndex) + 1} of ${BELT_PROGRESSION.length}`} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Class" value={student.class_name} sub="enrolled program" />
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Dojo Points" value={`${student.points}`} sub="earned on the mat" highlight />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Attendance (Yearly Log)"
          value={`${yearlyAttendanceQ.data ?? 0}`}
          sub={`classes logged in ${currentYear}`}
        />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Training Since" value={new Date(student.start_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })} sub={`${yearsTraining} years on the mat`} />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">School News</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
              View all <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          {news.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No news posted yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {news.map((n) => (
                <li key={n.id} className="group cursor-pointer rounded-xl border border-border bg-background/50 p-4 transition-all hover:border-primary/50 hover:bg-background">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-primary/40 text-primary">{n.tag ?? "News"}</Badge>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground group-hover:text-primary">{n.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">Upcoming Tournaments</h2>
            </div>
          </div>
          {tournaments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No tournaments scheduled.</p>
          ) : (
            <ol className="relative mt-4 space-y-4 border-l-2 border-border pl-6">
              {tournaments.map((t) => {
                const days = t.event_date ? Math.max(0, Math.ceil((new Date(t.event_date).getTime() - Date.now()) / 86400000)) : null;
                return (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-primary bg-background">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    <div className="rounded-xl border border-border bg-background/50 p-4 transition-all hover:border-primary/50">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={t.discipline === "Jiu-Jitsu" ? "bg-primary/15 text-primary hover:bg-primary/20" : "bg-foreground/10 text-foreground hover:bg-foreground/15"}>
                          {t.discipline ?? "Event"}
                        </Badge>
                        {days !== null && (
                          <span className="text-xs font-bold uppercase tracking-widest text-primary">{days}d away</span>
                        )}
                      </div>
                      <h3 className="mt-3 font-semibold">{t.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                         {(t.venue || t.address || t.location) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[t.venue, t.address].filter(Boolean).join(" · ") || t.location}</span>}
                         {t.event_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateRange(t.event_date, t.event_end_date)}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <ClassScheduleCard className={student.class_name} />
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean; }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all ${highlight ? "border-primary/60 bg-primary/5 shadow-red-glow" : "border-border bg-card hover:border-primary/40"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{icon}</span>
      </div>
      <div className={`mt-4 font-display text-2xl font-bold uppercase ${highlight ? "text-gradient-red" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ClassScheduleCard({ className }: { className: string }) {
  const catalogQ = useQuery({
    queryKey: ["class-catalog", className],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_schedules")
        .select("class_name, days, time_start, time_end, location")
        .eq("class_name", className)
        .maybeSingle();
      return data as { class_name: string; days: string | null; time_start: string | null; time_end: string | null; location: string | null; } | null;
    },
  });

  const fallback = CLASS_CATALOG.find((c) => c.name === className);
  const info = catalogQ.data ?? (fallback ? {
    class_name: fallback.name,
    days: fallback.days,
    time_start: fallback.time_start,
    time_end: fallback.time_end,
    location: fallback.location,
  } : null);

  if (!info) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-elevated sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
            <Calendar className="h-3 w-3" /> Class Schedule
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
            {info.class_name}
          </h2>
        </div>
        <Badge variant="outline" className="border-primary/50 text-primary">
          {info.location ?? "TBD"}
        </Badge>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Calendar className="h-3 w-3" /> Days
          </div>
          <div className="mt-2 font-display text-xl font-bold uppercase">{info.days ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Clock className="h-3 w-3" /> Time
          </div>
          <div className="mt-2 font-display text-xl font-bold uppercase">
            {info.time_start && info.time_end ? `${info.time_start} – ${info.time_end}` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <MapPin className="h-3 w-3" /> Location
          </div>
          <div className="mt-2 font-display text-xl font-bold uppercase">{info.location ?? "—"}</div>
        </div>
      </div>
    </section>
  );
}
