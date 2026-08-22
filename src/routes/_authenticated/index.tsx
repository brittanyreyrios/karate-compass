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
import { BeltChip, BeltSwatch } from "@/components/belt-chip";
import { LevelChip } from "@/components/level-chip";
import { computeBeltProgress, rankNoun, useBeltRanks, useBeltSystems } from "@/lib/belts";
import { useTournaments } from "@/lib/announcements";

import { CHIP_BASE, EVENT_TYPE_META, type DojoEvent } from "@/lib/calendar-data";
import { Link } from "@tanstack/react-router";

import { plural, count } from "@/lib/plural";
import { formatDateRange } from "@/lib/date-only";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSkeleton } from "@/components/skeletons";
import { GoogleReviewCard } from "@/components/google-review-card";
import { QueryErrorState } from "@/components/query-error";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";


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
  belt_rank_id: string | null;
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

const DASHBOARD_ANNOUNCEMENT_COLUMNS =
  "id, category, title, body, tag, discipline, location, event_date, event_end_date, venue, address, created_at";

function Dashboard() {
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      // Explicit columns: the dashboard needs three fields, and select("*")
      // dragged every future profile column across the wire with them.
      const { data } = await supabase
        .from("profiles")
        .select("id, family_name, subscription_status")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-mine"],
    queryFn: async () => {
      // Archived students are hidden from the leaderboard, curriculum and class
      // counts, so they must be hidden from their own parent's switcher too —
      // half-archived reads as a bug.
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("active", true)
        .order("created_at");

      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  /**
   * The dashboard only ever shows the four newest of each category, so it asks
   * for a bounded slice of named columns instead of the whole table. Fetching
   * every announcement ever posted to render eight cards got slower every term.
   * Keyed under ["announcements", ...] so the shared invalidation still hits it.
   */
  const announcementsQ = useQuery({
    queryKey: ["announcements", "dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select(DASHBOARD_ANNOUNCEMENT_COLUMNS)
        .eq("category", "school_news")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []) as Announcement[];
    },
  });

  /**
   * AN: tournaments are a separate, server-ordered query — soonest first, past
   * events excluded. The old code filtered the shared newest-first feed and then
   * sliced four, so an event happening next week could be cut entirely because
   * four tournaments were posted after it.
   */
  const tournamentsQ = useTournaments(4);


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

  const news = (announcementsQ.data ?? []).slice(0, 4);
  const tournaments = tournamentsQ.data ?? [];


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

  // Monthly Dojo Points are derived from the point_events log — students.points
  // stays the lifetime figure and is never reset.
  const monthStart = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const monthlyPointsQ = useQuery({
    queryKey: ["points-month", student?.id, monthStart],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_events")
        .select("delta")
        .eq("student_id", student!.id)
        .gte("occurred_on", monthStart);
      if (error) throw error;
      return (data ?? []).reduce((sum, row) => sum + (row.delta ?? 0), 0);
    },
  });

  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();

  // Delayed + minimum-duration so the skeleton never appears for one frame.
  const showSkeleton = useDelayedLoading(studentsQ.isLoading || profileQ.isLoading);

  // Hooks must run in the same order on every render — compute derived values
  // BEFORE any conditional early return.
  const daysToTest = useMemo(() => {
    if (!student?.next_test_date) return null;
    const now = typeof window !== "undefined" ? Date.now() : 0;
    const diff = new Date(student.next_test_date).getTime() - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [student?.next_test_date]);

  if (showSkeleton) {
    return <DashboardSkeleton />;
  }


  /*
    A failed roster/profile read must NOT fall through to "no students linked" —
    that is a different fact and a parent would act on it differently.
  */
  if (studentsQ.isError || profileQ.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <QueryErrorState
          what="your family dashboard"
          onRetry={() => {
            void studentsQ.refetch();
            void profileQ.refetch();
          }}
        />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase">Welcome, {profileQ.data?.family_name ?? "Family"}</h1>
        <p className="mt-3 text-muted-foreground">
          No students are linked to your account yet. Ask a Tiger's Den admin to link a student to your account and their progress appears here.
        </p>
      </div>
    );
  }

  const rank = (ranksQ.data ?? []).find((r) => r.id === student.belt_rank_id);
  const system = (systemsQ.data ?? []).find((s) => s.id === rank?.system_id);
  const progress = computeBeltProgress(system, ranksQ.data, student.belt_rank_id);
  /**
   * AK3: a program without belts (tai chi) has no ladder, so the progress panel
   * is replaced entirely rather than shown at a meaningless 100%.
   */
  const usesBelts = system ? system.uses_belts !== false : true;
  const noun = rankNoun(system);



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
                {students.map((s) => {
                  /**
                   * AZ: current_belt is a text column that an admin rank change
                   * used not to touch, so this dropdown showed the belt the child
                   * held at import while the rest of the page showed the new one.
                   * Resolve the rank like every other reader; keep the text as the
                   * documented fallback for students with no rank.
                   */
                  const sRank = (ranksQ.data ?? []).find((r) => r.id === s.belt_rank_id);
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} — {sRank?.name ?? s.current_belt}
                    </SelectItem>
                  );
                })}
              </SelectContent>

            </Select>
          </div>
        )}
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {usesBelts ? (
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 shadow-elevated sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {progress?.label ?? "Belt progress"}
              </div>
              <div className="mt-1 font-display text-2xl font-bold uppercase">{student.first_name}'s Journey</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                {progress ? `Step ${progress.step} of ${progress.total}` : "Awaiting belt rank"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl font-black text-gradient-red">{progress?.pct ?? 0}%</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Complete</div>
            </div>
          </div>
          <div className="relative mt-8">
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/60">
              <div className="h-full bg-gradient-red shadow-red-glow transition-all duration-700" style={{ width: `${progress?.pct ?? 0}%` }} />
            </div>
            <div className="mt-4 flex min-w-0 justify-between gap-1 sm:gap-2">
              {(progress?.ladder ?? []).map((belt, i) => {
                const reached = i <= (progress?.currentIndex ?? -1);
                const current = i === progress?.currentIndex;
                return (
                  <div key={belt.id} className="flex min-w-0 flex-col items-center gap-2">
                    <span
                      className={`inline-block transition-all ${current ? "scale-125" : reached ? "" : "opacity-40"}`}
                    >
                      <BeltSwatch
                        name={belt.name}
                        pattern={belt.pattern}
                        colorPrimary={belt.color_primary}
                        colorAccent={belt.color_accent}
                        systemName={system?.name ?? null}
                        size="ladder"
                      />

                    </span>
                    <span className={`hidden text-xs font-semibold uppercase tracking-wider sm:block ${current ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground"}`}>
                      {belt.short_name ?? belt.name}
                    </span>
                  </div>
                );
              })}
            </div>
            {rank && (
              <div className="mt-6">
                <BeltChip
                  name={rank.name}
                  pattern={rank.pattern}
                  colorPrimary={rank.color_primary}
                  colorAccent={rank.color_accent}
                  systemName={system?.name ?? null}
                />
              </div>
            )}
          </div>
        </div>
        ) : (
          /* AK3: no belts in this program, so no ladder and no progress bar —
             just the level the student currently holds. */
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 shadow-elevated sm:p-8">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {system?.name ?? "Program"}
            </div>
            <div className="mt-1 font-display text-2xl font-bold uppercase">
              {student.first_name}'s Journey
            </div>
            <div className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current level
            </div>
            <div className="mt-2 font-display text-4xl font-black uppercase text-gradient-red">
              {rank?.name ?? student.current_belt}
            </div>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              This program is not ranked by belts. Your instructor will let you know when new
              material is ready for you.
            </p>
          </div>
        )}



        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-red p-6 text-primary-foreground shadow-red-glow sm:p-8">
          <div className="absolute -right-8 -top-8 opacity-10"><Swords className="h-40 w-40" strokeWidth={1.5} /></div>
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/80">
              <Flame className="h-3 w-3" /> Next {usesBelts ? "Belt Test" : "Level Check"}
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
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label={usesBelts ? "Current Belt" : "Current Level"}
          value={rank?.name ?? student.current_belt}
          sub={
            progress
              ? `${system?.name ?? "Belt system"} · step ${progress.step} of ${progress.total}`
              : system
                ? system.name
                : `No ${noun.toLowerCase()} assigned yet`
          }

        />
        <StatCard icon={<Users className="h-5 w-5" />} label="Class" value={student.class_name} sub="enrolled program" />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Dojo Points"
          value={`all time: ${student.points}`}
          sub={`this month: ${monthlyPointsQ.data ?? 0} · all-time points never reset`}
          highlight
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Attendance (Yearly Log)"
          value={`${yearlyAttendanceQ.data ?? 0}`}
          sub={`classes logged in ${currentYear}`}
        />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Training Since" value={new Date(student.start_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })} sub={`${yearsTraining} years on the mat`} />
      </section>

      <GoogleReviewCard profileId={profileQ.data?.id} />

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
          {announcementsQ.isError ? (
            <QueryErrorState
              className="mt-4"
              what="the latest school news"
              onRetry={() => announcementsQ.refetch()}
            />
          ) : news.length === 0 ? (
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
          {tournamentsQ.isError ? (
            <div className="mt-4">
              <QueryErrorState
                what="the tournament schedule"
                onRetry={() => tournamentsQ.refetch()}
              />
            </div>
          ) : tournaments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No upcoming tournaments right now.</p>

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

      <NextUpStrip />

      <ClassScheduleCard className={student.class_name} />

    </div>
  );
}

function NextUpStrip() {
  const eventsQ = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, event_type, starts_at, all_day, location, audience_label")
        .eq("published", true)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      return (data ?? []) as DojoEvent[];
    },
  });

  const events = eventsQ.data ?? [];
  if (events.length === 0) return null;

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Next up at the dojo</h2>
        </div>
        <Link
          to="/calendar"
          className="text-xs font-semibold uppercase tracking-widest text-primary hover:underline"
        >
          Full calendar
        </Link>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-border bg-background/50 p-4">
            <span className={`${CHIP_BASE} ${EVENT_TYPE_META[event.event_type].badge}`}>
              {EVENT_TYPE_META[event.event_type].label}
            </span>
            <h3 className="mt-3 font-semibold text-foreground">{event.title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(event.starts_at).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {event.all_day
                ? " · All day"
                : ` · ${new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
            </div>
            {event.location && <div className="mt-1 text-xs text-muted-foreground">{event.location}</div>}
          </li>
        ))}
      </ul>
    </section>
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

  const info = catalogQ.data ?? null;


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
