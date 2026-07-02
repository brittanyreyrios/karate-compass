import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  BELT_PROGRESSION,
  MOCK_PROFILE,
  SCHOOL_NEWS,
  TOURNAMENTS,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Iron Dojo Parent Portal" },
      {
        name: "description",
        content:
          "Family dashboard: belt progression, next test countdown, attendance and school updates.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const profile = MOCK_PROFILE;
  const [activeId, setActiveId] = useState(profile.students[0].id);
  const student = profile.students.find((s) => s.id === activeId)!;

  const beltIndex = BELT_PROGRESSION.findIndex(
    (b) => b.name.toLowerCase() === student.current_belt.toLowerCase(),
  );
  const totalBelts = BELT_PROGRESSION.length - 1;
  const progressPct = Math.round((beltIndex / totalBelts) * 100);

  const daysToTest = useMemo(() => {
    const diff = new Date(student.next_test_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [student.next_test_date]);
  const classesToTest = Math.max(1, Math.round(daysToTest / 2)); // ~3 classes/week

  const yearsTraining = (
    (Date.now() - new Date(student.start_date).getTime()) /
    (1000 * 60 * 60 * 24 * 365)
  ).toFixed(1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary">
            Welcome back
          </div>
          <h1 className="mt-2 truncate font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl lg:text-5xl">
            The <span className="text-gradient-red">{profile.family_name}</span>{" "}
            Family Dashboard
          </h1>
        </div>

        {profile.students.length > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              Viewing
            </span>
            <Select value={activeId} onValueChange={setActiveId}>
              <SelectTrigger className="w-[200px] border-border bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profile.students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} — {s.current_belt} Belt
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {/* Hero: Progress + Countdown */}
      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Belt progress — spans 2 */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 shadow-elevated sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Road to Black Belt
              </div>
              <div className="mt-1 font-display text-2xl font-bold uppercase">
                {student.first_name}'s Journey
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl font-black text-gradient-red">
                {progressPct}%
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Complete
              </div>
            </div>
          </div>

          {/* Belt track */}
          <div className="relative mt-8">
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/60">
              <div
                className="h-full bg-gradient-red shadow-red-glow transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-4 flex justify-between">
              {BELT_PROGRESSION.map((belt, i) => {
                const reached = i <= beltIndex;
                const current = i === beltIndex;
                return (
                  <div key={belt.name} className="flex flex-col items-center gap-2">
                    <div
                      className={`h-6 w-3 rounded-sm border transition-all ${
                        current
                          ? "scale-125 border-primary ring-2 ring-primary/40"
                          : reached
                            ? "border-transparent"
                            : "border-border opacity-40"
                      }`}
                      style={{ backgroundColor: reached ? belt.color : "transparent" }}
                    />
                    <span
                      className={`hidden text-[9px] font-semibold uppercase tracking-wider sm:block ${
                        current ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {belt.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Countdown card */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-red p-6 text-primary-foreground shadow-red-glow sm:p-8">
          <div className="absolute -right-8 -top-8 opacity-10">
            <Swords className="h-40 w-40" strokeWidth={1.5} />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/80">
              <Flame className="h-3 w-3" /> Next Belt Test
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-7xl font-black leading-none">
                {daysToTest}
              </span>
              <span className="font-display text-lg uppercase tracking-wider">
                days
              </span>
            </div>
            <div className="mt-2 text-sm font-medium text-white/80">
              ≈ {classesToTest} classes to go
            </div>
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-xs uppercase tracking-widest">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(student.next_test_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Current Belt"
          value={`${student.current_belt} Belt`}
          sub={`Rank ${beltIndex + 1} of ${BELT_PROGRESSION.length}`}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Attendance"
          value={`${student.attendance_count}`}
          sub="classes attended"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Training Since"
          value={new Date(student.start_date).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
          sub={`${yearsTraining} years on the mat`}
        />
      </section>

      {/* Announcements split */}
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* School News */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                School News
              </h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
              View all <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>

          <ul className="mt-4 space-y-3">
            {SCHOOL_NEWS.map((n) => (
              <li
                key={n.id}
                className="group cursor-pointer rounded-xl border border-border bg-background/50 p-4 transition-all hover:border-primary/50 hover:bg-background"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {n.tag}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {n.date}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-foreground group-hover:text-primary">
                  {n.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Tournaments timeline */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                Upcoming Tournaments
              </h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
              View all <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>

          <ol className="relative mt-4 space-y-4 border-l-2 border-border pl-6">
            {TOURNAMENTS.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-primary bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="rounded-xl border border-border bg-background/50 p-4 transition-all hover:border-primary/50">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={
                        t.discipline === "Jiu-Jitsu"
                          ? "bg-primary/15 text-primary hover:bg-primary/20"
                          : "bg-foreground/10 text-foreground hover:bg-foreground/15"
                      }
                    >
                      {t.discipline}
                    </Badge>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {t.daysAway}d away
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">{t.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {t.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {t.date}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
      <div className="mt-4 font-display text-2xl font-bold uppercase">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
