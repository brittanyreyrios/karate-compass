import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Check,
  Megaphone,
  Trophy,
  ShieldCheck,
  Users,
  Pencil,
  Save,
  X,
  Minus,
  Calendar,
  Trash2,
  UserX,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Sparkles,
  Mail,
  Link2,
  Crown,
  ExternalLink,
  Camera,
  CameraOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SchoolSettingsTab } from "@/components/admin-settings-tab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useClasses,
  useEnrollments,
  usePrograms,
  indexEnrollments,
  ENROLLMENT_KEYS,
  type ClassRow,
} from "@/lib/enrollment";
import { EnrollmentEditor } from "@/components/admin-enrollment";
import { isRankProgrammeMismatch } from "@/lib/rank-programme";
import { jiuJitsuAssignmentSummary } from "@/lib/jiu-jitsu-assign";

import { ProgramsCard } from "@/components/admin-programs";
import { BeltSwatch } from "@/components/belt-chip";
import { LevelChip } from "@/components/level-chip";
import { BeltPicker } from "@/components/belt-picker";
import { useBeltRanks, useBeltSystems } from "@/lib/belts";
import { GalleryAdminTab, CurriculumAdminTab, InviteQrTab, BeltSystemsAdminTab } from "@/components/admin-content-tabs";
import { TechniqueLibraryAdminTab } from "@/components/admin-technique-library";
import { EventsAdminTab } from "@/components/admin-events-tab";
import { DisciplinePicker } from "@/components/discipline-tags";
import { cleanDisciplines, disciplinesOf } from "@/lib/calendar-data";
import { PollsAdminTab } from "@/components/admin-polls-tab";
import { AnnouncementsManageTab } from "@/components/admin-announcements-manage";
import {
  parkStudent,
  findProfileByEmail,
  findDuplicateStudent,
  normalizeParentEmail,
} from "@/lib/park-student";


import {
  ConsentAttentionItem,
  PhotoConsentBanner,
  NoPhotosMarker,
  useConsentOffProfiles,
  useUnacknowledgedConsentOff,
  useAcknowledgeConsentEvents,
} from "@/components/admin-photo-consent";
import { awardPoints, revertPointEvent } from "@/lib/points";
import { changeAttendance } from "@/lib/attendance";
import { AdminRoleButton, RoleChangeHistory, useAdminUserIds } from "@/components/admin-roles";



export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Staff admin console: master attendance sheet, student management and announcement controls." },
    ],
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  current_belt: string;
  attendance_count: number;
  parent_id: string;
  active: boolean;
  class_name: string;
  points: number;
  consecutive_absences: number;
  belt_rank_id: string | null;
};

/**
 * Belt badge for staff screens: renders the real pattern (solid / stripe / camo)
 * and names the system so nobody confuses Camo Purple with Solid Purple.
 */
function AdminBeltBadge({
  rankId,
  fallback,
  dense = false,
}: {
  rankId: string | null;
  fallback: string;
  /**
   * Dense views (attendance cards, roster rows) are ~320-480px wide, where
   * "Purple · Solid Belt" wrapped to three lines. `short_name` exists for
   * exactly this; the full name plus system stays in the title.
   */
  dense?: boolean;
}) {
  const ranksQ = useBeltRanks();
  const systemsQ = useBeltSystems();
  const rank = (ranksQ.data ?? []).find((r) => r.id === rankId);
  const system = (systemsQ.data ?? []).find((s) => s.id === rank?.system_id);
  if (!rank) {
    return (
      <Badge variant="outline" className="border-border text-muted-foreground">
        {fallback || "No rank set"}
      </Badge>
    );
  }
  const full = `${rank.name}${system ? ` · ${system.name}` : ""}`;
  // A beltless program (tai chi) gets a plain level chip — drawing a belt for a
  // student who wears none would be a lie about what they hold.
  if (system && system.uses_belts === false) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <LevelChip name={rank.name} systemName={system.name} />
        {!dense && (
          <Badge variant="outline" className="border-border text-muted-foreground">
            {system.name}
          </Badge>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" title={full}>
      <BeltSwatch
        name={rank.name}
        pattern={rank.pattern}
        colorPrimary={rank.color_primary}
        colorAccent={rank.color_accent}
        systemName={system?.name ?? null}
        size="sm"
      />
      <Badge variant="outline" className="whitespace-nowrap border-primary/40 text-primary" title={full}>
        {dense ? (rank.short_name ?? rank.name) : full}
      </Badge>
    </span>
  );


};

const ALL_CLASSES = "__all__";

type RiskLevel = "none" | "warn" | "alert";
function riskLevel(n: number): RiskLevel {
  if (n >= 3) return "alert";
  if (n >= 2) return "warn";
  return "none";
}
function riskCardClasses(n: number): string {
  const lvl = riskLevel(n);
  if (lvl === "alert") return "border-red-500/60 bg-red-500/15";
  if (lvl === "warn") return "border-yellow-400/60 bg-yellow-400/15";
  return "";
}
function FollowUpBadge({ n }: { n: number }) {
  const lvl = riskLevel(n);
  if (lvl === "none") return null;
  const cls = lvl === "alert"
    ? "border-red-500/60 bg-red-500/20 text-red-100"
    : "border-yellow-400/60 bg-yellow-400/20 text-yellow-100";
  // The full phrasing wrapped to three lines inside a ~320px card, so only the
  // count is drawn. Nothing is lost: the sentence lives in aria-label + title.
  const full = `Follow up needed · ${n} ${n === 1 ? "absence" : "absences"}`;
  return (
    <span
      aria-label={full}
      title={full}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${cls}`}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {n} {n === 1 ? "absence" : "absences"}
    </span>
  );
}



/** Single source of truth for the tab strip and its mobile <Select> twin. */
const ADMIN_TABS: { value: string; label: string }[] = [
  { value: "attendance", label: "Master Attendance" },
  { value: "students", label: "Manage Students" },
  { value: "schedules", label: "Class Schedules & Testing" },
  { value: "events", label: "Events Calendar" },
  { value: "polls", label: "Polls" },
  { value: "results", label: "Tournament Results" },
  { value: "parents", label: "Parents & Premium" },
  { value: "invites", label: "Invite Codes" },
  { value: "qr", label: "Signup QR" },
  { value: "gallery", label: "Media Gallery" },
  { value: "curriculum", label: "Belt Curriculum" },
  { value: "techniques", label: "Technique Library" },
  { value: "belts", label: "Belt Systems" },
  { value: "guidelines", label: "Dojo Point Guidelines" },
  { value: "announcements", label: "Post Announcement" },
  { value: "manage-announcements", label: "Manage Announcements" },
  { value: "settings", label: "School Settings" },

];

function AdminPage() {

  const [tab, setTab] = useState("attendance");
  const [consentOnly, setConsentOnly] = useState(false);

  const openConsentReview = () => {
    setConsentOnly(true);
    setTab("parents");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
            <ShieldCheck className="h-3 w-3" /> Admin Console
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Staff <span className="text-gradient-red">Dashboard</span>
          </h1>
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4" aria-label="Needs attention">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
          Needs attention
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ConsentAttentionItem onOpen={openConsentReview} />
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        {/*
          Thirteen tabs never wrapped acceptably on a phone: TabsList ships a
          fixed h-9, so `flex-wrap` wrapped the labels while the box kept its
          one-row height and the overflow painted straight over the heading
          below. Below `sm` we swap the strip for a real labelled <Select>; at
          `sm`+ it is a single non-wrapping, scroll-snapping row.
        */}
        <div className="relative isolate">
          <div className="sm:hidden">
            <Label htmlFor="admin-section" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Section
            </Label>
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger id="admin-section" className="mt-1.5 h-11 w-full">
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_TABS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TabsList className="hidden h-auto w-full snap-x snap-mandatory flex-nowrap justify-start overflow-x-auto sm:flex">
            {ADMIN_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="shrink-0 snap-start">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>


        <TabsContent value="attendance" className="mt-6">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="students" className="mt-6">
          <ManageStudentsTab />
        </TabsContent>
        <TabsContent value="schedules" className="mt-6">
          <ClassSchedulesTab />
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <PhotoConsentBanner onViewList={openConsentReview} />
          <EventsAdminTab />
        </TabsContent>
        <TabsContent value="polls" className="mt-6">
          <PollsAdminTab />
        </TabsContent>
        <TabsContent value="parents" className="mt-6">
          <ParentsTab consentOnly={consentOnly} onConsentOnlyChange={setConsentOnly} />
        </TabsContent>
        <TabsContent value="invites" className="mt-6">
          <InviteCodesTab />
        </TabsContent>
        <TabsContent value="qr" className="mt-6">
          <InviteQrTab />
        </TabsContent>
        <TabsContent value="gallery" className="mt-6">
          <PhotoConsentBanner onViewList={openConsentReview} />
          <GalleryAdminTab />
        </TabsContent>
        <TabsContent value="curriculum" className="mt-6">
          <CurriculumAdminTab />
        </TabsContent>
        <TabsContent value="techniques" className="mt-6">
          <TechniqueLibraryAdminTab />
        </TabsContent>
        <TabsContent value="belts" className="mt-6">
          <BeltSystemsAdminTab />
        </TabsContent>
        <TabsContent value="guidelines" className="mt-6">
          <PointGuidelinesTab />
        </TabsContent>
        <TabsContent value="announcements" className="mt-6">
          <div className="space-y-6">
            <AnnouncementForm />
            <TournamentManager />
          </div>
        </TabsContent>
        <TabsContent value="manage-announcements" className="mt-6">
          <AnnouncementsManageTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SchoolSettingsTab />
        </TabsContent>

      </Tabs>

    </div>
  );
}

function useStudents() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-students"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, current_belt, belt_rank_id, attendance_count, parent_id, active, class_name, points, consecutive_absences")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });
}

/* ---------- ATTENDANCE ---------- */

function AttendanceTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string>(ALL_CLASSES);
  const [presentLock, setPresentLock] = useState<Record<string, number>>({});
  const [pointsLock, setPointsLock] = useState<Record<string, number>>({});
  const [absentLock, setAbsentLock] = useState<Record<string, number>>({});
  const [sessionPoints, setSessionPoints] = useState(0);
  const { data: consentOff } = useConsentOffProfiles();
  const consentOffIds = useMemo(
    () => new Set((consentOff ?? []).map((p) => p.id)),
    [consentOff],
  );

  const studentsQ = useStudents();
  const classesQ = useClasses();
  const enrollQ = useEnrollments();
  const classes = classesQ.data ?? [];
  /** Membership comes from the join table, so a child in two classes shows in both. */
  const { studentsByClass } = useMemo(() => indexEnrollments(enrollQ.data), [enrollQ.data]);

  const today = new Date().toISOString().slice(0, 10);

  const holidaysQ = useQuery({
    queryKey: ["holidays-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_holidays")
        .select("class_name")
        .eq("holiday_date", today);
      if (error) throw error;
      return new Set((data ?? []).map((h) => h.class_name));
    },
  });
  const holidayClasses = holidaysQ.data ?? new Set<string>();
  /** The filter now holds a class id; holidays are still recorded by class name. */
  const selectedClass = classes.find((c) => c.id === classFilter) ?? null;
  const currentClassIsHoliday = !!selectedClass && holidayClasses.has(selectedClass.class_name);

  const filtered = useMemo(() => {
    const list = (studentsQ.data ?? []).filter((s) => s.active);
    const byClass =
      classFilter === ALL_CLASSES
        ? list
        : list.filter((s) => studentsByClass.get(classFilter)?.has(s.id));
    if (!q.trim()) return byClass;
    const needle = q.toLowerCase();
    return byClass.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.current_belt}`.toLowerCase().includes(needle),
    );
  }, [q, classFilter, studentsQ.data, studentsByClass]);

  const counts = useMemo(() => {
    const activeIds = new Set((studentsQ.data ?? []).filter((s) => s.active).map((s) => s.id));
    const map: Record<string, number> = { [ALL_CLASSES]: activeIds.size };
    for (const c of classes) {
      let n = 0;
      for (const id of studentsByClass.get(c.id) ?? []) if (activeIds.has(id)) n++;
      map[c.id] = n;
    }
    return map;
  }, [studentsQ.data, classes, studentsByClass]);

  const lockButton = (
    setter: (fn: (s: Record<string, number>) => Record<string, number>) => void,
    id: string,
  ) => {
    const until = Date.now() + 3000;
    setter((s) => ({ ...s, [id]: until }));
    setTimeout(() => {
      setter((s) => {
        const c = { ...s };
        if (c[id] && c[id] <= Date.now()) delete c[id];
        return c;
      });
    }, 3100);
  };

  const checkIn = useMutation({
    mutationFn: async (student: Student) => {
      // changeAttendance() is the single funnel that bumps the counter and writes
      // the dated attendance_events row the parent dashboard counts.
      await changeAttendance({
        studentId: student.id,
        currentAttendance: student.attendance_count,
        delta: 1,
      });
      // Absence streak is not attendance accounting, so it stays out of the funnel.
      const { error } = await supabase
        .from("students")
        .update({ consecutive_absences: 0 })
        .eq("id", student.id);
      if (error) throw error;
      return student.id;
    },
    onSuccess: (id) => {
      lockButton(setPresentLock, id);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["attendance-year"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Dojo Points: award +1/+5/+10, confirm with the new running total and offer a
   * 3-second Undo that removes the audit row again. A per-session tally keeps
   * instructors honest about how much they've handed out on this device.
   */
  const addPoints = useMutation({
    mutationFn: async ({ student, delta }: { student: Student; delta: number }) =>
      awardPoints({ studentId: student.id, currentPoints: student.points, delta }),
    onSuccess: (award) => {
      lockButton(setPointsLock, award.studentId);
      setSessionPoints((t) => t + award.delta);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success(`+${award.delta} · now ${award.newTotal}`, {
        duration: 3000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await revertPointEvent({
                studentId: award.studentId,
                currentPoints: award.newTotal,
                delta: award.delta,
                eventId: award.eventId,
              });
              setSessionPoints((t) => t - award.delta);
              qc.invalidateQueries({ queryKey: ["admin-students"] });
              toast.success("Points reverted");
            } catch (e) {
              toast.error((e as Error).message);
            }
          },
        },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAbsent = useMutation({
    mutationFn: async (student: Student) => {
      const { error } = await supabase
        .from("students")
        .update({ consecutive_absences: student.consecutive_absences + 1 })
        .eq("id", student.id);
      if (error) throw error;
      return student.id;
    },
    onSuccess: (id) => {
      lockButton(setAbsentLock, id);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleHoliday = useMutation({
    mutationFn: async () => {
      if (!selectedClass) throw new Error("Select a specific class first.");
      if (currentClassIsHoliday) {
        const { error } = await supabase
          .from("class_holidays")
          .delete()
          .eq("class_name", selectedClass.class_name)
          .eq("holiday_date", today);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_holidays")
          .insert({ class_name: selectedClass.class_name, holiday_date: today, note: "Marked in-app" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(currentClassIsHoliday ? "Holiday cleared" : "Holiday set — absences paused");
      qc.invalidateQueries({ queryKey: ["holidays-today", today] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter keys are class ids now — the whole point of Round 12 is to stop
  // identifying a class by its name.
  const filterOptions: { key: string; label: string }[] = [
    { key: ALL_CLASSES, label: "All Classes" },
    ...classes.map((c) => ({ key: c.id, label: c.class_name })),
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase">Master Attendance Sheet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Filter by class, then tap +1 to log a session. Buttons cool down for 3 seconds to prevent double taps.
            Dojo Points show the new total and can be undone for 3 seconds.
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-primary" aria-live="polite">
            Points awarded this session: {sessionPoints}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search student…"
            className="h-11 pl-9 text-base"
          />
        </div>
      </div>

      {/* Class filter bar */}
      <div className="mt-5 flex flex-wrap gap-2">
        {filterOptions.map((opt) => {
          const active = classFilter === opt.key;
          const isHol = opt.key !== ALL_CLASSES && holidayClasses.has(opt.label);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setClassFilter(opt.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-red-glow"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {opt.label}
              {isHol && <span className="rounded bg-yellow-400/20 px-1.5 py-0.5 text-xs text-yellow-100">Holiday</span>}
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-black/25 text-white" : "bg-secondary text-foreground/70"}`}>
                {counts[opt.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Holiday toggle */}
      {classFilter !== ALL_CLASSES && (
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${currentClassIsHoliday ? "border-yellow-400/50 bg-yellow-400/10" : "border-border bg-background"}`}>
          <div className="text-xs">
            <div className="font-bold uppercase tracking-widest text-foreground">
              {currentClassIsHoliday
                ? `${selectedClass?.class_name} — Closed today`
                : `${selectedClass?.class_name} — Regular session`}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {currentClassIsHoliday
                ? "Absence tracking is paused. Students will not accrue consecutive absences today."
                : "Mark today as a Holiday/Gym Closed day to pause absence tracking for this class."}
            </div>
          </div>
          <Button
            size="sm"
            variant={currentClassIsHoliday ? "outline" : "outline"}
            onClick={() => toggleHoliday.mutate()}
            disabled={toggleHoliday.isPending}
            className={currentClassIsHoliday ? "border-yellow-400/60 text-yellow-100" : ""}
          >
            {currentClassIsHoliday ? "Clear holiday" : "Mark today as Holiday"}
          </Button>
        </div>
      )}

      {/* Two columns, not three: the card's width comes from this grid, not the
          viewport, and ~320px cards starve the name/badge row. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">

        {studentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!studentsQ.isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No students in this view. Adjust the filter or add students in Manage Students.</p>
        )}
        {filtered.map((s) => {
          const presentActive = !!presentLock[s.id];
          const pointsActive = !!pointsLock[s.id];
          const absentActive = !!absentLock[s.id];
          const risk = riskCardClasses(s.consecutive_absences);
          return (
            <div
              key={s.id}
              className={`flex flex-col gap-3 rounded-xl border p-3 transition-all ${
                presentActive
                  ? "border-primary bg-primary/5 shadow-red-glow"
                  : risk || "border-border bg-background"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-semibold">{s.first_name} {s.last_name}</div>
                  <FollowUpBadge n={s.consecutive_absences} />
                  {consentOffIds.has(s.parent_id) && <NoPhotosMarker />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <AdminBeltBadge rankId={s.belt_rank_id} fallback={s.current_belt} dense />
                  <Badge variant="outline">{s.class_name}</Badge>
                  <span>{s.attendance_count} classes · {s.points} pts</span>
                </div>
              </div>
              {/* Controls always sit under the name. The card's width is set by
                  the grid, not the viewport, so a viewport breakpoint here would
                  turn the card horizontal exactly as it gets narrower. */}
              <div className="flex shrink-0 flex-col items-stretch gap-1">


                <Button
                  size="lg"
                  onClick={() => checkIn.mutate(s)}
                  disabled={checkIn.isPending || presentActive}
                  className="h-11 min-w-[120px] bg-gradient-red text-sm font-bold uppercase tracking-wider shadow-red-glow active:scale-95"
                >
                  {presentActive
                    ? <><Check className="mr-1 h-4 w-4" /> Logged</>
                    : <><Plus className="mr-1 h-4 w-4" />+1 Class</>}
                </Button>
                <div className="flex gap-1" role="group" aria-label={`Award Dojo Points to ${s.first_name}`}>
                  {[1, 5, 10].map((delta) => (
                    <Button
                      key={delta}
                      size="sm"
                      variant="outline"
                      onClick={() => addPoints.mutate({ student: s, delta })}
                      disabled={addPoints.isPending || pointsActive}
                      className="h-9 flex-1 border-primary/40 text-xs uppercase tracking-wider text-primary hover:bg-primary/10"
                    >
                      {pointsActive ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <><Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> +{delta}</>
                      )}
                    </Button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markAbsent.mutate(s)}
                  disabled={markAbsent.isPending || absentActive || (classFilter !== ALL_CLASSES && currentClassIsHoliday)}
                  title={currentClassIsHoliday ? "Absence tracking paused (holiday)" : ""}
                  className="h-8 border-yellow-400/50 text-xs uppercase tracking-wider text-yellow-100 hover:bg-yellow-400/10"
                >
                  {absentActive
                    ? <><Check className="mr-1 h-3.5 w-3.5" /> Logged</>
                    : <><UserX className="mr-1 h-3.5 w-3.5" /> Absent</>}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- MANAGE STUDENTS ---------- */

function ManageStudentsTab() {
  const qc = useQueryClient();
  const studentsQ = useStudents();
  const classesQ = useClasses();
  const enrollQ = useEnrollments();
  const ranksQ = useBeltRanks();
  const systemsQ = useBeltSystems();
  const classes = classesQ.data ?? [];
  const { byStudent } = useMemo(() => indexEnrollments(enrollQ.data), [enrollQ.data]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noRankOnly, setNoRankOnly] = useState(false);
  const [noClassOnly, setNoClassOnly] = useState(false);
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const allStudents = studentsQ.data ?? [];
  const noRankCount = allStudents.filter((s) => !s.belt_rank_id).length;
  /**
   * A student enrolled in nothing is allowed, but they are invisible to
   * attendance and to every class count — so the number has to be countable and
   * drivable to zero after each wave of signups, exactly like a missing rank.
   */
  const noClassCount = allStudents.filter((s) => s.active && !byStudent.get(s.id)?.length).length;

  /**
   * AY1: a rank that disagrees with every programme the student trains in. A
   * dual-programme child matches one of their programmes and never appears here.
   */
  const mismatchIds = useMemo(() => {
    const ranks = ranksQ.data ?? [];
    const systems = systemsQ.data ?? [];
    return new Set(
      allStudents
        .filter((s) =>
          isRankProgrammeMismatch({
            student: s,
            enrollments: enrollQ.data,
            classes,
            ranks,
            systems,
          }),
        )
        .map((s) => s.id),
    );
  }, [allStudents, enrollQ.data, classes, ranksQ.data, systemsQ.data]);
  const mismatchCount = mismatchIds.size;

  const assignJiuJitsu = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("assign_jiu_jitsu_levels");
      if (error) throw error;
      return data as { assigned: number; skipped: number; skipped_students: unknown[] };
    },
    onSuccess: (res) => {
      toast.success(jiuJitsuAssignmentSummary(res));
      for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * The roster list shows active students only. Archived ones live in their own
   * section below, which is also the only place a delete control exists.
   */
  const activeStudents = allStudents.filter((s) => s.active);
  const archivedStudents = allStudents.filter((s) => !s.active);

  const visibleStudents = activeStudents.filter(
    (s) =>
      (!noRankOnly || !s.belt_rank_id) &&
      (!noClassOnly || !byStudent.get(s.id)?.length) &&
      (!mismatchOnly || mismatchIds.has(s.id)),
  );


  // Add form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [systemId, setSystemId] = useState<string | null>(null);
  const [rankId, setRankId] = useState<string | null>(null);
  /**
   * Two paths. "linked" is the original behaviour. "parked" writes to
   * pending_student_imports instead, where handle_new_user picks the child up the
   * moment their parent signs up with the same email.
   */
  const [addMode, setAddMode] = useState<"linked" | "parked">("linked");

  const addStudent = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim() || !parentEmail.trim()) {
        throw new Error("Please fill in all fields.");
      }
      if (!rankId) throw new Error("Choose a belt system and rank for this student.");
      if (!classId) throw new Error("Choose the class this student trains in.");
      const emailNorm = normalizeParentEmail(parentEmail);
      const profile = await findProfileByEmail(emailNorm);

      if (addMode === "parked") {
        // A parked row for an account that already exists is never consumed:
        // handle_new_user only runs at signup. Refuse rather than create a child
        // who silently never appears.
        if (profile) {
          throw new Error(
            `${emailNorm} already has an account (${profile.family_name}). Switch to "Parent already has an account" — parking this student would never link them.`,
          );
        }
        const dupe = await findDuplicateStudent({
          firstName,
          lastName,
          parentEmail: emailNorm,
          parentId: null,
        });
        if (dupe) {
          throw new Error(
            `${firstName.trim()} ${lastName.trim()} is already waiting for ${emailNorm}. No second copy created.`,
          );
        }
        const rank = (ranksQ.data ?? []).find((r) => r.id === rankId);
        await parkStudent({
          firstName,
          lastName,
          parentEmail: emailNorm,
          className: classes.find((c) => c.id === classId)?.class_name ?? "Unassigned",
          classId,
          currentBelt: rank?.name ?? "White",
          beltRankId: rankId,
        });
        return { parked: true as const, email: emailNorm };
      }

      if (!profile) throw new Error(`No parent account found for ${emailNorm}. Ask the parent to sign up first, or choose "Parent hasn't signed up yet".`);

      const dupe = await findDuplicateStudent({
        firstName,
        lastName,
        parentEmail: emailNorm,
        parentId: profile.id,
      });
      if (dupe) {
        throw new Error(
          `${firstName.trim()} ${lastName.trim()} is already ${dupe.kind === "parked" ? `waiting for ${emailNorm}` : `on the roster for ${emailNorm}`}. No second copy created.`,
        );
      }

      // class_name is never written from here: the enrollment row below is the
      // source of truth and a trigger derives the display label from it.
      const { data: created, error } = await supabase
        .from("students")
        .insert({
          parent_id: profile.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          belt_rank_id: rankId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: enrErr } = await supabase
        .from("student_classes")
        .insert({ student_id: created.id, class_id: classId, is_primary: true });
      if (enrErr) throw enrErr;
      return { parked: false as const, email: emailNorm };
    },
    onSuccess: (res) => {
      toast.success(
        res.parked
          ? `Held for ${res.email} — they'll be linked automatically at signup`
          : "Student added and enrolled",
      );
      setFirstName(""); setLastName(""); setParentEmail("");
      setClassId(""); setSystemId(null); setRankId(null);
      qc.invalidateQueries({ queryKey: ["unlinked-imports"] });
      for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Add new */}
        <form
          onSubmit={(e) => { e.preventDefault(); addStudent.mutate(); }}
          className="h-fit rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold uppercase">Add New Student</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a student to a parent's account, or hold them until that parent signs up.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                { key: "linked", label: "Parent already has an account" },
                { key: "parked", label: "Parent hasn't signed up yet" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                aria-pressed={addMode === opt.key}
                onClick={() => setAddMode(opt.key)}
                className={`rounded-xl border p-3 text-left text-xs font-semibold ${
                  addMode === opt.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Parent's email</Label>
              <Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required className="mt-1" placeholder="parent@example.com" />
            </div>
            <div>
              <Label>First class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a class…" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Extra classes can be added from the student's row once they exist.
              </p>
            </div>
            <BeltPicker
              idPrefix="add-student"
              systemId={systemId}
              rankId={rankId}
              onChange={(next) => { setSystemId(next.systemId); setRankId(next.rankId); }}
            />

          </div>

          {addMode === "parked" && (
            <p className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
              {firstName.trim() || lastName.trim()
                ? `${firstName.trim()} ${lastName.trim()}`.trim()
                : "This student"}{" "}
              will be held until a parent signs up with{" "}
              <span className="font-semibold text-foreground">
                {parentEmail.trim() ? normalizeParentEmail(parentEmail) : "their email address"}
              </span>
              , then linked automatically with this class and rank. They appear in the
              Unlinked Students Audit below until then.
            </p>
          )}

          <Button type="submit" disabled={addStudent.isPending} className="mt-6 w-full bg-gradient-red">
            {addStudent.isPending
              ? addMode === "parked" ? "Holding…" : "Adding…"
              : addMode === "parked" ? "Hold For Signup" : "Add Student"}
          </Button>

        </form>

        {/* List */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold uppercase">All Students</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit details, promote belts or adjust Dojo Points. Rows highlight when a student has consecutive absences.
              </p>
            </div>
          </div>

          {/* A missing belt rank hides a child from every leaderboard and from
              their own curriculum, so it has to be countable, not just visible. */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant={noRankOnly ? "default" : "outline"}
              className={noRankOnly ? "bg-gradient-red" : ""}
              aria-pressed={noRankOnly}
              onClick={() => setNoRankOnly((v) => !v)}
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              No belt rank set ({noRankCount})
            </Button>
            <Button
              size="sm"
              variant={noClassOnly ? "default" : "outline"}
              className={noClassOnly ? "bg-gradient-red" : ""}
              aria-pressed={noClassOnly}
              onClick={() => setNoClassOnly((v) => !v)}
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Students in no class ({noClassCount})
            </Button>
            {/* AY1: a rank that agrees with none of the student's programmes. */}
            <Button
              size="sm"
              variant={mismatchOnly ? "default" : "outline"}
              className={mismatchOnly ? "bg-gradient-red" : ""}
              aria-pressed={mismatchOnly}
              onClick={() => setMismatchOnly((v) => !v)}
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Rank doesn't match programme ({mismatchCount})
            </Button>
            {/* AX3: the roster is also edited by hand, so this can't only run on import. */}
            <Button
              size="sm"
              variant="outline"
              disabled={assignJiuJitsu.isPending}
              onClick={() => assignJiuJitsu.mutate()}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {assignJiuJitsu.isPending ? "Assigning…" : "Assign jiu jitsu levels"}
            </Button>
            {noRankCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {noRankCount} student{noRankCount === 1 ? "" : "s"} without a rank won't appear on any
                leaderboard or see curriculum until a rank is set.
              </span>
            )}
            {noClassCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {noClassCount} student{noClassCount === 1 ? "" : "s"} in no class won't appear on any
                attendance sheet until they are enrolled.
              </span>
            )}
            {mismatchCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {mismatchCount} student{mismatchCount === 1 ? "'s rank" : "s' ranks"} disagree with every
                programme they train in — their leaderboard division follows the rank, so check the belt.
              </span>
            )}

          </div>

          <div className="mt-5 space-y-3">
            {studentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!studentsQ.isLoading && activeStudents.length === 0 && archivedStudents.length === 0 && (
              <p className="text-sm text-muted-foreground">No students yet. Add your first above.</p>
            )}
            {!studentsQ.isLoading && activeStudents.length === 0 && archivedStudents.length > 0 && (
              <p className="text-sm text-muted-foreground">
                No active students. {archivedStudents.length} archived — restore them from the Archived
                Students section below.
              </p>
            )}
            {!studentsQ.isLoading && activeStudents.length > 0 && visibleStudents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active students match this filter. Nothing to fix here.
              </p>
            )}

            {visibleStudents.map((s) =>
              editingId === s.id ? (
                <StudentEditRow key={s.id} student={s} onDone={() => setEditingId(null)} />
              ) : (
                <StudentRow key={s.id} student={s} onEdit={() => setEditingId(s.id)} />
              ),
            )}
          </div>
        </div>
      </div>

      <ArchivedStudentsPanel students={archivedStudents} />

      <CsvImporter />

      <UnassignedClassPanel />
      <UnlinkedAudit />


    </div>
  );
}

function StudentRow({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const qc = useQueryClient();
  const adjustPoints = useMutation({
    mutationFn: async (delta: number) =>
      awardPoints({
        studentId: student.id,
        currentPoints: student.points,
        delta,
        reason: "Manual adjustment (roster)",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-students"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`rounded-xl border p-3 transition-all sm:flex sm:flex-wrap sm:items-center sm:gap-3 ${riskCardClasses(student.consecutive_absences) || "border-border bg-background"}`}>
      {/* Mobile: a strict vertical stack. The old single flex row let the belt
          chip and the points stepper share a line they could not both fit on,
          so the chip painted over the stepper and the name truncated. */}
      <div className="min-w-0 sm:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 break-words font-semibold">{student.first_name} {student.last_name}</div>
          <FollowUpBadge n={student.consecutive_absences} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <AdminBeltBadge rankId={student.belt_rank_id} fallback={student.current_belt} dense />
          <span>{student.attendance_count} classes</span>
        </div>
        <EnrollmentEditor studentId={student.id} />
      </div>

      <div className="mt-3 flex w-full items-center justify-between gap-1 rounded-lg border border-border bg-card p-1 sm:mt-0 sm:w-auto sm:justify-start">
        <Button size="icon" variant="ghost" aria-label="Remove one Dojo Point" className="h-11 w-11 shrink-0" onClick={() => adjustPoints.mutate(-1)} disabled={adjustPoints.isPending || student.points === 0}>
          <Minus className="h-4 w-4" />
        </Button>
        <div className="min-w-[60px] px-1 text-center">
          <div className="font-display text-lg font-bold leading-none text-primary">{student.points}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Dojo pts</div>
        </div>
        <Button size="icon" variant="ghost" aria-label="Add one Dojo Point" className="h-11 w-11 shrink-0" onClick={() => adjustPoints.mutate(1)} disabled={adjustPoints.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 flex w-full gap-2 sm:mt-0 sm:w-auto">
        <Button size="sm" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none" onClick={onEdit}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
        {/* Archive is the reversible action, and the ONLY removal control on an
            active student. Deleting requires archiving first — see the Archived
            Students section. */}
        <ArchiveStudentButton student={student} />
      </div>
    </div>
  );

}

/** "1 attendance record" / "47 attendance records" — counts always come from the DB. */
function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Sets `active = false`. One boolean write, nothing else. */

function ArchiveStudentButton({ student }: { student: Student }) {
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").update({ active: false }).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${student.first_name} archived — restore them any time`);
      for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-11 flex-1 sm:h-9 sm:flex-none">
          <UserX className="mr-1 h-3.5 w-3.5" /> Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archive {student.first_name} {student.last_name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            They come off the attendance sheet, the leaderboard, class counts and their
            parent's dashboard, but nothing is deleted — their attendance, points and history
            stay exactly as they are. You can restore them at any time from the Archived
            Students section.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={archive.isPending} onClick={() => archive.mutate()}>
            Archive student
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Archived students. Collapsed by default, and the only place in the app with a
 * delete control: an admin must archive a student first and then find them here.
 * That ordering is the safety mechanism — there is deliberately no shortcut, and
 * no bulk or multi-select delete.
 */
function ArchivedStudentsPanel({ students }: { students: Student[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").update({ active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student restored with their attendance and points intact");
      for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="font-display text-lg font-bold uppercase">
            Archived Students ({students.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Archived students are hidden everywhere in the app but keep their full history.
            Restore is instant. Deleting is permanent and only possible from here.
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="mt-5 space-y-3">
          {students.length === 0 && (
            <p className="text-sm text-muted-foreground">Nobody is archived right now.</p>
          )}
          {students.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-background p-3 sm:flex sm:items-center sm:gap-3"
            >
              <div className="min-w-0 sm:flex-1">
                <div className="break-words font-semibold">
                  {s.first_name} {s.last_name}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <AdminBeltBadge rankId={s.belt_rank_id} fallback={s.current_belt} dense />
                  <span>Former class: {s.class_name}</span>
                  <span>{s.attendance_count} classes</span>
                  <span>{s.points} Dojo pts</span>
                </div>
              </div>
              <div className="mt-2 flex gap-2 sm:mt-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 flex-1 sm:h-9 sm:flex-none"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(s.id)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Restore
                </Button>
                <DeleteStudentDialog student={s} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Permanent delete. The counts in the sentence are read from the database when
 * the dialog opens — never estimated — because deleting cascades to attendance
 * events, point events, poll votes and class enrolments, and there is no undo.
 * The button stays disabled until the admin types the student's full name.
 */
function DeleteStudentDialog({ student }: { student: Student }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const fullName = `${student.first_name} ${student.last_name}`;

  const countsQ = useQuery({
    queryKey: ["student-delete-counts", student.id],
    enabled: open,
    queryFn: async () => {
      const head = { count: "exact" as const, head: true };
      const [att, pts, votes, enr] = await Promise.all([
        supabase.from("attendance_events").select("id", head).eq("student_id", student.id),
        supabase.from("point_events").select("id", head).eq("student_id", student.id),
        supabase.from("poll_votes").select("id", head).eq("student_id", student.id),
        supabase.from("student_classes").select("id", head).eq("student_id", student.id),
      ]);
      for (const r of [att, pts, votes, enr]) if (r.error) throw r.error;
      return {
        attendance: att.count ?? 0,
        points: pts.count ?? 0,
        votes: votes.count ?? 0,
        enrolments: enr.count ?? 0,
      };
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").delete().eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${fullName} deleted permanently`);
      setOpen(false);
      setTyped("");
      for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const c = countsQ.data;
  const sentence = c
    ? `This permanently deletes ${fullName}, ${count(c.attendance, "attendance record")}, ${count(
        c.points,
        "point entry",
        "point entries",
      )}${c.votes > 0 ? `, ${count(c.votes, "poll vote")}` : ""} and ${count(
        c.enrolments,
        "class enrolment",
      )}. This cannot be undone.`
    : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-11 flex-1 border-destructive/50 text-destructive sm:h-9 sm:flex-none">
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {fullName} for good?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {countsQ.isLoading && "Reading this student's records…"}
                {countsQ.isError && "Could not read this student's records — nothing has been deleted."}
                {sentence}
              </p>
              <p>
                Archiving is the reversible option: an archived student is already hidden from
                every screen and can be restored at any time. Deleting is not reversible — their
                whole history goes with them.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div>
          <Label htmlFor={`confirm-${student.id}`} className="text-xs">
            Type <span className="font-bold text-foreground">{fullName}</span> to confirm
          </Label>
          <Input
            id={`confirm-${student.id}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={typed.trim() !== fullName || !c || del.isPending}
            onClick={() => del.mutate()}
          >
            {del.isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


function StudentEditRow({ student, onDone }: { student: Student; onDone: () => void }) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState(student.first_name);
  const [lastName, setLastName] = useState(student.last_name);
  const ranksQ = useBeltRanks();
  const currentRank = (ranksQ.data ?? []).find((r) => r.id === student.belt_rank_id);
  const [systemId, setSystemId] = useState<string | null>(currentRank?.system_id ?? null);
  const [rankId, setRankId] = useState<string | null>(student.belt_rank_id ?? null);
  // No class field here: membership lives in student_classes and students.class_name
  // is a trigger-derived label. Writing it here would recreate the drift trap.
  const [points, setPoints] = useState(String(student.points));
  // Baseline is captured once when the form opens and deliberately never
  // re-synced from the live prop: the delta must be measured against what the
  // admin saw, so a concurrent roster award is preserved rather than clobbered.
  const [pointsBaseline] = useState(student.points);
  const [attendance, setAttendance] = useState(String(student.attendance_count));
  // Same baseline rule as points: captured once when the form opens and never
  // re-synced, so a check-in made from the roster meanwhile survives.
  const [attendanceBaseline] = useState(student.attendance_count);

  // Keep the belt system in sync once the ranks list resolves.
  useEffect(() => {
    if (!systemId && currentRank) setSystemId(currentRank.system_id);
  }, [currentRank, systemId]);

  const save = useMutation({
    mutationFn: async () => {
      // AZ(b): current_belt is the documented fallback for students with no rank,
      // and it used to keep whatever the import wrote while belt_rank_id moved on.
      // Writing both here stops the column drifting at source.
      const rank = (ranksQ.data ?? []).find((r) => r.id === rankId);
      const { error } = await supabase
        .from("students")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          belt_rank_id: rankId,
          ...(rank ? { current_belt: rank.name } : {}),
        })
        .eq("id", student.id);
      if (error) throw error;

      // Points never get written straight to students: awardPoints() is the one
      // funnel that also writes the point_events audit row the leaderboard sums.
      const entered = Math.max(0, parseInt(points || "0", 10) || 0);
      const delta = entered - pointsBaseline;
      if (delta !== 0) {
        const { data: fresh, error: readErr } = await supabase
          .from("students")
          .select("points")
          .eq("id", student.id)
          .maybeSingle();
        if (readErr) throw readErr;
        await awardPoints({
          studentId: student.id,
          currentPoints: fresh?.points ?? pointsBaseline,
          delta,
          reason: "Manual correction (edit student)",
        });
      }

      // Attendance is the same story one column over: changeAttendance() keeps the
      // counter and the attendance_events log in step. Unchanged field = no write.
      const enteredAtt = Math.max(0, parseInt(attendance || "0", 10) || 0);
      const attDelta = enteredAtt - attendanceBaseline;
      let attendanceResult: { delta: number; requested: number } | null = null;
      if (attDelta !== 0) {
        const { data: freshAtt, error: attReadErr } = await supabase
          .from("students")
          .select("attendance_count")
          .eq("id", student.id)
          .maybeSingle();
        if (attReadErr) throw attReadErr;
        const change = await changeAttendance({
          studentId: student.id,
          currentAttendance: freshAtt?.attendance_count ?? attendanceBaseline,
          delta: attDelta,
        });
        attendanceResult = { delta: change.delta, requested: change.requested };
      }
      return { attendanceResult };
    },


    onSuccess: (res) => {
      const att = res?.attendanceResult;
      if (att && att.delta !== att.requested) {
        // Partial removals must not look like full ones: name both numbers.
        toast.warning(
          `Saved, but only ${Math.abs(att.delta)} of the ${Math.abs(att.requested)} classes you asked to remove were on file — attendance was lowered by ${Math.abs(att.delta)}.`,
        );
      } else {
        toast.success("Saved");
      }
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["attendance-year"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label className="text-xs">First name</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Last name</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Classes</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Enrolment is managed on the student's row above — a student can be in more than one class.
          </p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <BeltPicker
            idPrefix={`edit-${student.id}`}
            systemId={systemId}
            rankId={rankId}
            onChange={(next) => { setSystemId(next.systemId); setRankId(next.rankId); }}
          />
        </div>

        <div>
          <Label className="text-xs">Dojo points</Label>
          <Input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Attendance count</Label>
          <Input type="number" min={0} value={attendance} onChange={(e) => setAttendance(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}><X className="mr-1 h-4 w-4" /> Cancel</Button>
        <Button className="bg-gradient-red" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <ReassignParentPanel student={student} onDone={onDone} />
    </div>
  );
}

/**
 * AM — move a student to a different parent account.
 *
 * The whole move is one database function call: the student row is reassigned in
 * place, so their belt rank, Dojo points, attendance and every logged point or
 * attendance event follow them. Deleting and re-adding the student would lose all
 * of that history, which is why there is no "remove and re-create" path here.
 *
 * The target account must already exist — a parent has to sign up with an invite
 * code first, and inventing a profile row here would create an account nobody can
 * log into. The function reports that case as a plain message rather than
 * silently doing nothing.
 */
function ReassignParentPanel({ student, onDone }: { student: Student; onDone: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  const move = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_reassign_student", {
        _student_id: student.id,
        _new_parent_email: email.trim(),
      });
      if (error) throw error;
      return data as unknown as { student_name: string; new_family_name: string };
    },
    onSuccess: (res) => {
      toast.success(`${res.student_name} moved to the ${res.new_family_name} family`);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["students-mine"] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      setEmail("");
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 border-t border-border pt-4">
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Users className="mr-1 h-3.5 w-3.5" /> Move to another parent
        </Button>
      ) : (
        <div>
          <Label className="text-xs" htmlFor={`move-${student.id}`}>
            New parent's account email
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {student.first_name} keeps their rank, Dojo points and full attendance history. The
            account must already exist.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id={`move-${student.id}`}
              type="email"
              value={email}
              placeholder="parent@example.com"
              onChange={(e) => setEmail(e.target.value)}
              className="sm:flex-1"
            />
            <Button
              variant="outline"
              disabled={move.isPending || email.trim() === ""}
              onClick={() => move.mutate()}
            >
              {move.isPending ? "Moving…" : "Move student"}
            </Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setEmail(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ---------- ANNOUNCEMENTS ---------- */

function AnnouncementForm() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<"school_news" | "tournament">("school_news");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>(["Jiu Jitsu"]);
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");

  const post = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        category,
        title: title.trim(),
        body: body.trim(),
        created_by: u.user?.id ?? null,
        tag: category === "school_news" ? (tag.trim() || "News") : null,
        // Legacy `discipline` stays populated with the first selection so the
        // places that still read it keep working.
        discipline: category === "tournament" ? (disciplines[0] ?? null) : null,
        disciplines: category === "tournament" && disciplines.length > 0 ? disciplines : null,
        location: category === "tournament" ? location.trim() : null,
        event_date: category === "tournament" && eventDate ? eventDate : null,
      };
      const { error } = await supabase.from("announcements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement posted");
      setTitle(""); setBody(""); setTag(""); setLocation(""); setEventDate("");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!title.trim() || !body.trim()) return; post.mutate(); }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="font-display text-xl font-bold uppercase">Post an Announcement</h2>
      <p className="mt-1 text-sm text-muted-foreground">Publishes instantly to every parent dashboard.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as "school_news" | "tournament")}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="school_news"><Megaphone className="mr-2 inline h-4 w-4" />School News</SelectItem>
              <SelectItem value="tournament"><Trophy className="mr-2 inline h-4 w-4" />Upcoming Tournament</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {category === "school_news" ? (
          <div>
            <Label>Tag</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Schedule, Facility, Gear…" className="mt-1" />
          </div>
        ) : (
          <DisciplinePicker idPrefix="new-tournament" value={disciplines} onChange={setDisciplines} />
        )}

        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className="mt-1" />
        </div>

        {category === "tournament" && (
          <>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="League City, TX" className="mt-1" />
            </div>
            <div>
              <Label>Event date</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1" />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <Label>Details</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required rows={4} className="mt-1" />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={post.isPending} className="bg-gradient-red">
          {post.isPending ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </form>
  );
}

type Tournament = {
  id: string;
  title: string;
  body: string;
  discipline: string | null;
  disciplines: string[] | null;
  event_date: string | null;
  event_end_date: string | null;
  venue: string | null;
  address: string | null;
  divisions: string | null;
  registration_deadline: string | null;
  spectator_info: string | null;
  event_url: string | null;
};

function TournamentManager() {
  const qc = useQueryClient();
  const tournamentsQ = useQuery({
    queryKey: ["admin-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, discipline, disciplines, event_date, event_end_date, venue, address, divisions, registration_deadline, spectator_info, event_url")
        .eq("category", "tournament")
        .order("event_date");
      if (error) throw error;
      return (data ?? []) as Tournament[];
    },
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-xl font-bold uppercase">Manage Tournaments</h2>
      <p className="mt-1 text-sm text-muted-foreground">Edit event details shown to families.</p>
      <div className="mt-6 space-y-4">
        {(tournamentsQ.data ?? []).map((tournament) => (
          <TournamentEditor
            key={tournament.id}
            tournament={tournament}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["admin-tournaments"] });
              qc.invalidateQueries({ queryKey: ["announcements"] });
            }}
          />
        ))}
      </div>
    </section>
  );
}

function TournamentEditor({ tournament, onSaved }: { tournament: Tournament; onSaved: () => void }) {
  const [form, setForm] = useState<Tournament>({
    ...tournament,
    // A row written before disciplines existed still has its legacy value; the
    // shared helper seeds from it so saving cannot silently blank the tag.
    disciplines: disciplinesOf(tournament),
  });
  const set = (key: keyof Tournament, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const optional = (value: string | null) => value?.trim() || null;
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("announcements")
        .update({
          title: form.title.trim(),
          body: form.body.trim(),
          // Both fields are written together from one control, so the badge and
          // the calendar filter can never disagree about the same tournament.
          discipline: form.disciplines?.[0] ?? null,
          disciplines: form.disciplines && form.disciplines.length > 0 ? form.disciplines : null,
          event_date: optional(form.event_date),
          event_end_date: optional(form.event_end_date),
          venue: optional(form.venue),
          address: optional(form.address),
          divisions: optional(form.divisions),
          registration_deadline: optional(form.registration_deadline),
          spectator_info: optional(form.spectator_info),
          event_url: optional(form.event_url),
          location: [optional(form.venue), optional(form.address)].filter(Boolean).join(" · ") || null,
        })
        .eq("id", tournament.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tournament updated");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="rounded-xl border border-border bg-background/50 p-5"
      onSubmit={(event) => { event.preventDefault(); save.mutate(); }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`tournament-title-${tournament.id}`}>Event name</Label>
          <Input id={`tournament-title-${tournament.id}`} value={form.title} onChange={(e) => set("title", e.target.value)} required className="mt-1" />
        </div>
        <div>
          <DisciplinePicker
            idPrefix={`tournament-${tournament.id}`}
            value={form.disciplines ?? []}
            onChange={(disciplines) => setForm((current) => ({ ...current, disciplines }))}
          />
        </div>
        <div>
          <Label htmlFor={`tournament-venue-${tournament.id}`}>Venue</Label>
          <Input id={`tournament-venue-${tournament.id}`} value={form.venue ?? ""} onChange={(e) => set("venue", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor={`tournament-start-${tournament.id}`}>Start date</Label>
          <Input id={`tournament-start-${tournament.id}`} type="date" value={form.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor={`tournament-end-${tournament.id}`}>End date</Label>
          <Input id={`tournament-end-${tournament.id}`} type="date" value={form.event_end_date ?? ""} onChange={(e) => set("event_end_date", e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`tournament-address-${tournament.id}`}>Address</Label>
          <Input id={`tournament-address-${tournament.id}`} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor={`tournament-divisions-${tournament.id}`}>Divisions</Label>
          <Input id={`tournament-divisions-${tournament.id}`} value={form.divisions ?? ""} onChange={(e) => set("divisions", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor={`tournament-deadline-${tournament.id}`}>Registration deadline</Label>
          <Input id={`tournament-deadline-${tournament.id}`} type="date" value={form.registration_deadline ?? ""} onChange={(e) => set("registration_deadline", e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`tournament-spectator-${tournament.id}`}>Spectator information</Label>
          <Input id={`tournament-spectator-${tournament.id}`} value={form.spectator_info ?? ""} onChange={(e) => set("spectator_info", e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`tournament-url-${tournament.id}`}>Official link</Label>
          <Input id={`tournament-url-${tournament.id}`} type="url" value={form.event_url ?? ""} onChange={(e) => set("event_url", e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`tournament-note-${tournament.id}`}>Parent note</Label>
          <Textarea id={`tournament-note-${tournament.id}`} value={form.body} onChange={(e) => set("body", e.target.value)} rows={3} className="mt-1" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        {form.event_url ? (
          <Button asChild type="button" variant="ghost" size="sm">
            <a href={form.event_url} target="_blank" rel="noreferrer">Official page <ExternalLink aria-hidden="true" /></a>
          </Button>
        ) : <span />}
        <Button type="submit" disabled={save.isPending} className="bg-gradient-red">
          <Save aria-hidden="true" /> {save.isPending ? "Saving…" : "Save event"}
        </Button>
      </div>
    </form>
  );
}

/* ---------- CLASS SCHEDULES & TESTING ---------- */

/**
 * There is deliberately NO cap on the number of classes: nothing in the database
 * constrains it, and the old hard-coded 11 was already exceeded by the real
 * school, which blocked adding while doing nothing about what existed.
 */

type ClassSchedule = {
  id: string;
  class_name: string;
  next_test_date: string | null;
  location: string | null;
  is_teen_adult: boolean;
  /** AT2 — which programme this class belongs to, set by hand, never inferred. */
  program_id: string | null;
  /** The announcement posted for this class's testing date, if any. */
  test_announcement_id: string | null;
  updated_at: string;
};


function ClassSchedulesTab() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const schedulesQ = useQuery({
    queryKey: ["class-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_schedules")
        .select(
          "id, class_name, next_test_date, location, is_teen_adult, program_id, test_announcement_id, updated_at",
        )
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassSchedule[];
    },
  });

  /**
   * Counted through student_classes now, not by matching class names, so a class
   * reading 0 students genuinely has nobody enrolled rather than a spelling
   * mismatch. Same source as division_of(), so the two can never disagree.
   */
  const countsQ = useQuery({
    queryKey: ["class-student-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("class_student_counts");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as { class_name: string; student_count: number }[]) {
        map.set(r.class_name, r.student_count);
      }
      return map;
    },
  });

  const addClass = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Enter a class name.");
      const { error } = await supabase
        .from("class_schedules")
        .insert({ class_name: name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class added");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["class-student-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class removed");
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["class-student-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = schedulesQ.data ?? [];

  return (
    <div className="space-y-6">
      <ProgramsCard />
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="font-display text-xl font-bold uppercase">Class Schedules &amp; Testing</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a mass testing date for each class. Saving pushes that date to every enrolled student's countdown.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            {list.length} {list.length === 1 ? "class" : "classes"}
          </Badge>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); addClass.mutate(); }}
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[220px] flex-1">
            <Label>New class name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Adults BJJ, Competition Team…"
              className="mt-1"
            />
          </div>
          <Button
            type="submit"
            className="bg-gradient-red"
            disabled={addClass.isPending}
          >
            <Plus className="mr-1 h-4 w-4" /> Add class
          </Button>
        </form>

        <div className="mt-6 grid gap-3">
          {schedulesQ.isLoading && <p className="text-sm text-muted-foreground">Loading classes…</p>}
          {!schedulesQ.isLoading && list.length === 0 && (
            <p className="text-sm text-muted-foreground">No classes yet. Add one above to get started.</p>
          )}
          {list.map((c) => (
            <ClassScheduleRow
              key={c.id}
              schedule={c}
              studentCount={countsQ.data?.get(c.class_name) ?? null}
              onRemove={() => removeClass.mutate(c.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


function ClassScheduleRow({
  schedule,
  studentCount,
  onRemove,
}: {
  schedule: ClassSchedule;
  studentCount: number | null;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(schedule.next_test_date ?? "");
  const [location, setLocation] = useState(schedule.location ?? "");
  // Ticked by default: a testing date staff bother to set is news.
  const [post, setPost] = useState(true);

  /**
   * Teen/adult classes drive the Teen & Adults leaderboard division — class beats
   * belt, because teens and adults here hold solid belts too. Saved immediately;
   * it is one boolean with nothing to batch it with.
   */
  const saveTeenAdult = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("class_schedules")
        .update({ is_teen_adult: next })
        .eq("id", schedule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["my-division"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const programsQ = usePrograms();
  const programs = programsQ.data ?? [];

  const saveProgram = useMutation({
    mutationFn: async (next: string | null) => {
      const { error } = await supabase
        .from("class_schedules")
        .update({ program_id: next })
        .eq("id", schedule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programme updated");
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["classes-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });




  useEffect(() => {
    setDate(schedule.next_test_date ?? "");
  }, [schedule.next_test_date]);

  useEffect(() => {
    setLocation(schedule.location ?? "");
  }, [schedule.location]);

  // Save-on-blur, same pattern as the Belt Systems tab: only writes when the
  // value actually changed, so the next room rename needs no migration.
  const saveLocation = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from("class_schedules")
        .update({ location: next.trim() === "" ? null : next.trim() })
        .eq("id", schedule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location saved");
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["class-schedule-mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commitLocation = () => {
    const next = location.trim();
    if (next === (schedule.location ?? "").trim()) return;
    saveLocation.mutate(next);
  };


  /**
   * AO1 — one transaction, not five round trips.
   *
   * This used to be a sequence of separate requests: schedule update, student
   * fan-out, then the announcement. Any failure part-way through left the
   * database in a state no screen represents — e.g. the class showing a testing
   * date its students do not have, or an announcement for a date that was
   * cleared. set_class_test_date does all of it in a single statement, so it
   * either all lands or none of it does.
   *
   * The testing date remains the single source of truth: the calendar derives
   * its Belt Testing chip straight from class_schedules.next_test_date.
   */
  const save = useMutation({
    mutationFn: async () => {
      // _date is a nullable date in the function; the generated arg type omits
      // the null, so clearing the date needs the cast.
      const { data, error } = await supabase.rpc("set_class_test_date", {
        _schedule_id: schedule.id,
        _date: (date === "" ? null : date) as unknown as string,
        _post_announcement: post,
      });

      if (error) throw error;
      return data as unknown as {
        class_name: string;
        students_updated: number;
        announcement_action: string;
        cleared: boolean;
      };
    },
    onSuccess: ({ students_updated: count, cleared }) => {
      toast.success(
        cleared
          ? `Testing date cleared for ${schedule.class_name} (${count} student${count === 1 ? "" : "s"})`
          : `Testing date pushed to ${count} student${count === 1 ? "" : "s"} in ${schedule.class_name}`,
      );

      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["students-mine"] });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      qc.invalidateQueries({ queryKey: ["calendar-tests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const daysAway = date
    ? Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000))
    : null;

  // With no date there is nothing to post, so the checkbox alone is not a change.
  const dirty =
    date !== (schedule.next_test_date ?? "") ||
    (date !== "" && post !== !!schedule.test_announcement_id);


  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg font-bold uppercase break-words">{schedule.class_name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {schedule.next_test_date
              ? `Currently set for ${new Date(schedule.next_test_date).toLocaleDateString()}${daysAway !== null ? ` · ${daysAway}d away` : ""}`
              : "No test scheduled"}
            {schedule.test_announcement_id && " · announcement posted"}
          </div>
          <div className="mt-1 text-xs">
            {studentCount === null ? (
              <span className="text-muted-foreground">Counting students…</span>
            ) : studentCount === 0 ? (
              <span className="text-destructive-foreground">
                0 students match this class name — check the spelling against the roster
              </span>
            ) : (
              <span className="text-muted-foreground">
                {studentCount} student{studentCount === 1 ? "" : "s"} matched
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label
            className="flex items-center gap-2 text-sm"
            htmlFor={`teen-adult-${schedule.id}`}
          >
            <Checkbox
              id={`teen-adult-${schedule.id}`}
              checked={schedule.is_teen_adult}
              onCheckedChange={(v) => saveTeenAdult.mutate(v === true)}
              disabled={saveTeenAdult.isPending}
            />
            <span>
              Teen / adult class
              <span className="block text-xs text-muted-foreground">
                Puts these students on the Teen &amp; Adults leaderboard, whatever their belt.
              </span>
            </span>
          </label>

          {/* AT2 — the programme is set per class, never inferred from the name. */}
          <div className="min-w-[200px]">
            <Label htmlFor={`program-${schedule.id}`} className="text-xs">Programme</Label>
            <Select
              value={schedule.program_id ?? "none"}
              onValueChange={(v) => saveProgram.mutate(v === "none" ? null : v)}
            >
              <SelectTrigger id={`program-${schedule.id}`} className="mt-1 h-9">
                <SelectValue placeholder="No programme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No programme</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>


      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Label className="text-xs" htmlFor={`test-date-${schedule.id}`}>Next mass testing date</Label>
          <Input
            id={`test-date-${schedule.id}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-11 w-full"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Clear the date to remove this class from the calendar.
          </p>
        </div>
        <div className="min-w-0">
          <Label className="text-xs" htmlFor={`location-${schedule.id}`}>Location / room</Label>
          <Input
            id={`location-${schedule.id}`}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={commitLocation}
            placeholder="e.g. Big Dojo"
            className="mt-1 h-11 w-full"
          />
        </div>
      </div>

      <label
        className="mt-3 flex items-start gap-2 text-sm"
        htmlFor={`post-announcement-${schedule.id}`}
      >
        <Checkbox
          id={`post-announcement-${schedule.id}`}
          checked={post}
          onCheckedChange={(v) => setPost(v === true)}
          className="mt-0.5"
        />
        <span>
          Also post an announcement
          <span className="block text-xs text-muted-foreground">
            One School News post per class, updated in place when the date moves — never a duplicate.
          </span>
        </span>
      </label>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          className="h-11 w-full bg-gradient-red sm:w-auto"
          disabled={save.isPending || !dirty}
          onClick={() => save.mutate()}
        >
          <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save & push"}
        </Button>
        <Button
          variant="outline"
          className="h-11 w-full text-destructive-foreground sm:w-auto"
          aria-label={`Remove ${schedule.class_name}`}
          onClick={onRemove}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Remove class
        </Button>
      </div>
    </div>
  );

}


/* ---------- CSV IMPORTER ---------- */

type CsvRow = {
  first_name: string;
  last_name: string;
  parent_email: string;
  start_date?: string;
  current_belt?: string;
};

type ImportResult = {
  student: string;
  status: "ok" | "warning" | "unlinked" | "error";
  message: string;
};

/**
 * The belt column is kept verbatim (trimmed) — coercing an unrecognised value
 * such as "Camo Purple" to "White" would silently rewrite a child's rank.
 * Matching against the rank tables happens separately, and a miss is reported.
 */
function normalizeBelt(input: string | undefined): string {
  const raw = (input ?? "").trim();
  return raw.length > 0 ? raw : "White";
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string, alts: string[] = []): number => {
    const candidates = [name, ...alts];
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iFirst = idx("first_name", ["first", "firstname"]);
  const iLast = idx("last_name", ["last", "lastname", "surname"]);
  const iEmail = idx("parent_email", ["email", "parent", "parentemail", "primary_email"]);
  const iStart = idx("start_date", ["start", "startdate", "date", "join_date", "enrollment_date"]);
  const iBelt = idx("current_belt", ["belt", "rank", "current_rank"]);
  const rows: CsvRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]);
    const first_name = iFirst >= 0 ? cols[iFirst] ?? "" : "";
    const last_name = iLast >= 0 ? cols[iLast] ?? "" : "";
    const parent_email = iEmail >= 0 ? cols[iEmail] ?? "" : "";
    const start_date = iStart >= 0 ? cols[iStart] ?? "" : "";
    const current_belt = iBelt >= 0 ? cols[iBelt] ?? "" : "";
    if (!first_name && !last_name && !parent_email) continue;
    rows.push({ first_name, last_name, parent_email, start_date, current_belt });
  }
  return rows;
}

function CsvImporter() {
  const qc = useQueryClient();
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();
  const allRanks = ranksQ.data ?? [];
  const systemsById = new Map((systemsQ.data ?? []).map((s) => [s.id, s]));
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const classesQ = useClasses();
  const classes = classesQ.data ?? [];
  /** The batch is assigned by class id; the name is only carried for display. */
  const [assignedClass, setAssignedClass] = useState<string>("");
  const assignedClassName =
    classes.find((c) => c.id === assignedClass)?.class_name ?? "Unassigned";
  /**
   * A Kicksite export says "Purple", which is a rank name in more than one belt
   * system — and a roster is imported one class at a time, so staff always know
   * which system the batch belongs to. Choosing it up front turns the ambiguity
   * into an answer instead of a warning; "" keeps the old all-systems behaviour.
   */
  const [systemId, setSystemId] = useState<string>("");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [jjSummary, setJjSummary] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);

  /**
   * Match a CSV belt value against the ranks of the chosen system (or all three
   * when none is chosen) and return *all* candidates. Several camo short_names
   * are identical to solid rank names ("Purple" is both Camo Purple and Solid
   * Purple), so picking a winner across systems would silently file a roster of
   * eight-year-olds into the camo system. Within one system an exact `name`
   * match wins over a `short_name` match; anything still ambiguous is reported,
   * never guessed.
   */
  const findRanks = (belt: string) => {
    const needle = belt.trim().toLowerCase();
    if (!needle) return [];
    const pool = systemId ? allRanks.filter((r) => r.system_id === systemId) : allRanks;
    const byName = pool.filter((r) => r.name.trim().toLowerCase() === needle);
    if (byName.length > 0) return byName;
    return pool.filter((r) => (r.short_name ?? "").trim().toLowerCase() === needle);
  };


  const onFile = async (file: File) => {
    setFileName(file.name);
    setResults([]);
    const text = await file.text();
    try {
      const parsed = parseCsv(text);
      setRows(parsed);
      if (parsed.length === 0) toast.error("No valid rows found in the CSV.");
    } catch (e) {
      toast.error((e as Error).message);
      setRows([]);
    }
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    if (!assignedClass) {
      toast.error("Choose the class to enrol this batch in first.");
      return;
    }
    setImporting(true);
    const out: ImportResult[] = [];
    for (const row of rows) {
      const name = `${row.first_name} ${row.last_name}`.trim() || row.parent_email;
      try {
        if (!row.first_name || !row.last_name || !row.parent_email) {
          throw new Error("Missing First Name, Last Name or Parent Email");
        }
        const email = row.parent_email.trim().toLowerCase();
        const belt = normalizeBelt(row.current_belt);
        const startDate =
          row.start_date && !Number.isNaN(new Date(row.start_date).getTime())
            ? new Date(row.start_date).toISOString().slice(0, 10)
            : null;
        const { data: profile, error: profErr } = await supabase
          .from("profiles").select("id").ilike("email", email).maybeSingle();
        if (profErr) throw profErr;

        // CSV rows carry belt *text*, which may name a rank in more than one
        // system. Resolved ONCE here, before the parked/linked split: a parked
        // row must carry the same resolved rank a linked one would get, or the
        // child arrives rankless whenever their parent signs up later (AL). The
        // importer's system selector is honoured, so an ambiguous name like
        // "Gold" resolves here even though the database function cannot.
        const candidates = findRanks(belt);
        const rank = candidates.length === 1 ? candidates[0] : undefined;

        if (!profile) {
          // Stage as unlinked so admins can spot typos in the audit view. The
          // class is resolved to an *id* here, where a human is watching, so the
          // child arrives enrolled — not merely labelled — when their parent
          // signs up later (AS5).
          // One writer for parked rows (src/lib/park-student.ts), shared with the
          // single Add Student form: email normalisation lives there, because a
          // stray capital is a child who never links at signup.
          await parkStudent({
            firstName: row.first_name,
            lastName: row.last_name,
            parentEmail: email,
            className: assignedClassName,
            classId: assignedClass,
            currentBelt: belt,
            beltRankId: rank?.id ?? null,
            startDate,
          });

          out.push({
            student: name,
            status: "unlinked",
            message: `Queued in audit — no parent account for ${email}${
              rank ? "" : ` · belt "${belt}" unresolved, set it once they sign up`
            }`,
          });
          continue;
        }

        // No match — or more than one match — means the student imports without a
        // rank, reported as a warning, never as a clean success.
        const payload = {
          parent_id: profile.id,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          current_belt: belt,
          ...(rank ? { belt_rank_id: rank.id } : {}),

          ...(startDate ? { start_date: startDate } : {}),
        };
        const { data: createdStudent, error } = await supabase
          .from("students")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        // Enrolment, not a text class name: the trigger derives the label.
        const { error: enrErr } = await supabase
          .from("student_classes")
          .insert({ student_id: createdStudent.id, class_id: assignedClass, is_primary: true });
        if (enrErr) throw enrErr;
        if (rank) {
          const sysName = systemsById.get(rank.system_id)?.name;
          out.push({
            student: name,
            status: "ok",
            message: `Imported — ${rank.name}${sysName ? ` · ${sysName}` : ""}`,
          });
        } else if (candidates.length > 1) {
          const named = candidates
            .map((r) => `${r.name}${systemsById.get(r.system_id)?.name ? ` (${systemsById.get(r.system_id)!.name})` : ""}`)
            .join(", ");
          out.push({
            student: name,
            status: "warning",
            message: `Imported — belt "${belt}" matches more than one system (${named}); set the rank in the roster`,
          });
        } else {
          out.push({
            student: name,
            status: "warning",
            message: `Imported — belt "${belt}" did not match any rank; set it in the roster`,
          });
        }
      } catch (e) {
        out.push({ student: name, status: "error", message: (e as Error).message });
      }
    }
    setResults(out);
    setImporting(false);
    const okCount = out.filter((r) => r.status === "ok").length;
    const warnCount = out.filter((r) => r.status === "warning").length;
    const unlinked = out.filter((r) => r.status === "unlinked").length;
    const summary = `Imported ${okCount + warnCount} / ${out.length} students${
      warnCount ? ` · ${warnCount} with no belt rank` : ""
    }${unlinked ? ` · ${unlinked} queued in the Unlinked Audit` : ""}`;

    if (warnCount > 0) toast.warning(summary);
    else toast.success(summary);

    /**
     * AX2: jiu-jitsu-only children arrive from a roster rankless, and a migration
     * that already ran can't help them. Assign right here, while the admin is
     * still reading the summary.
     */
    if (okCount + warnCount > 0) {
      const { data: assignData, error: assignErr } = await supabase.rpc("assign_jiu_jitsu_levels");
      if (assignErr) setJjSummary(`Jiu Jitsu levels could not be assigned: ${assignErr.message}`);
      else setJjSummary(jiuJitsuAssignmentSummary(assignData as never));
    }

    qc.invalidateQueries({ queryKey: ["admin-students"] });
    qc.invalidateQueries({ queryKey: ["unlinked-imports"] });
    for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
  };


  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase">Import Kicksite CSV</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a Kicksite roster with columns: <code className="rounded bg-secondary px-1">First Name, Last Name, Parent Email, Start Date, Current Belt</code>. Rows whose parent email has no matching account go to the Unlinked Students Audit so you can catch typos.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-background/40 p-4 hover:border-primary/60">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">
                {fileName ? fileName : "Choose a CSV file"}
              </div>
              <div className="text-xs text-muted-foreground">
                {rows.length > 0 ? `${rows.length} rows detected` : "Comma-separated, first row is headers"}
              </div>
            </div>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          />
          <span className="rounded-md border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider">Browse…</span>
        </label>

        <div>
          <Label htmlFor="csv-class">Enrol every imported student in</Label>
          <Select value={assignedClass} onValueChange={setAssignedClass}>
            <SelectTrigger id="csv-class" className="mt-1">
              <SelectValue placeholder="Choose a class…" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="csv-system">Belt system for this batch</Label>
          <Select value={systemId || "any"} onValueChange={(v) => setSystemId(v === "any" ? "" : v)}>
            <SelectTrigger id="csv-system" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Match across all systems</SelectItem>
              {(systemsQ.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            A belt named &ldquo;Purple&rdquo; exists in more than one system. Pick the system this
            roster belongs to and belts are matched only within it.
          </p>
        </div>

      </div>

      {rows.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">First</th>
                  <th className="px-3 py-2">Last</th>
                  <th className="px-3 py-2">Parent Email</th>
                  <th className="px-3 py-2">Start Date</th>
                  <th className="px-3 py-2">Belt</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{r.first_name}</td>
                    <td className="px-3 py-2">{r.last_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.parent_email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.start_date ?? ""}</td>
                    <td className="px-3 py-2 text-muted-foreground">{normalizeBelt(r.current_belt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && (
            <div className="border-t border-border bg-secondary/40 px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground">
              + {rows.length - 50} more rows will import
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length === 0 || importing}
          onClick={() => { setRows([]); setResults([]); setFileName(""); }}
        >
          Clear
        </Button>
        <Button
          type="button"
          className="bg-gradient-red"
          disabled={rows.length === 0 || importing}
          onClick={runImport}
        >
          <Upload className="mr-1 h-4 w-4" />
          {importing ? "Importing…" : `Import ${rows.length} student${rows.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      {jjSummary && (
        <p className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          {jjSummary}
        </p>
      )}

      {results.length > 0 && (

        <div className="mt-5 space-y-1 text-xs">
          {results.map((r, i) => {
            const cls =
              r.status === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : r.status === "warning" || r.status === "unlinked"
                ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-100"
                : "border-red-500/40 bg-red-500/10 text-red-100";
            return (
              <div key={i} className={`flex items-center justify-between rounded-md border px-3 py-1.5 ${cls}`}>
                <span className="font-semibold">{r.student}</span>
                <span className="text-xs opacity-80">{r.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- STUDENTS WITH NO CLASS ASSIGNED ---------- */

type UnassignedStudent = {
  id: string;
  first_name: string;
  last_name: string;
  current_belt: string;
  created_at: string;
};

function UnassignedClassPanel() {
  const unassignedQ = useQuery({
    queryKey: ["unassigned-class-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, current_belt, created_at")
        .eq("class_name", "Unassigned")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UnassignedStudent[];
    },
  });

  const list = unassignedQ.data ?? [];
  if (unassignedQ.isLoading || list.length === 0) return null;

  return (
    <div className="rounded-2xl border border-primary/50 bg-primary/5 p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold uppercase">Needs a class assigned</h2>
        <Badge variant="outline" className="border-primary/50 text-primary">
          {list.length}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        These students were linked from a roster import with no class listed, so they were parked in
        "Unassigned". Set the real class in Manage Students — until then their schedule card and testing
        countdown stay blank.
      </p>
      <ul className="mt-5 space-y-2">
        {list.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-background p-3"
          >
            <span className="font-semibold">
              {s.first_name} {s.last_name}
            </span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {s.current_belt}
            </Badge>
            <Badge variant="outline">Unassigned</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- UNLINKED STUDENTS AUDIT ---------- */


type PendingImport = {
  id: string;
  first_name: string;
  last_name: string;
  parent_email: string;
  class_name: string;
  current_belt: string;
  belt_rank_id: string | null;
  start_date: string | null;
  created_at: string;
};

function UnlinkedAudit() {
  const qc = useQueryClient();
  const pendingQ = useQuery({
    queryKey: ["unlinked-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_student_imports")
        .select("id, first_name, last_name, parent_email, class_name, current_belt, belt_rank_id, start_date, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingImport[];
    },
  });

  const relink = useMutation({
    mutationFn: async (row: PendingImport) => {
      const email = row.parent_email.trim().toLowerCase();
      const { data: profile, error: profErr } = await supabase
        .from("profiles").select("id").ilike("email", email).maybeSingle();
      if (profErr) throw profErr;
      if (!profile) throw new Error(`Still no account for ${email}. Fix the email or ask the parent to sign up.`);
      const { error: insErr } = await supabase.from("students").insert({
        parent_id: profile.id,
        first_name: row.first_name,
        last_name: row.last_name,
        class_name: row.class_name,
        current_belt: row.current_belt,
        // AL: the rank was resolved at import time and parked on the row, so a
        // manual retry-link must carry it across too — otherwise the two link
        // paths disagree and only the manual one produces a rankless student.
        belt_rank_id: row.belt_rank_id,
        ...(row.start_date ? { start_date: row.start_date } : {}),
      });
      if (insErr) throw insErr;
      const { error: delErr } = await supabase.from("pending_student_imports").delete().eq("id", row.id);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      toast.success("Student linked");
      qc.invalidateQueries({ queryKey: ["unlinked-imports"] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pending_student_imports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unlinked-imports"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, parent_email }: { id: string; parent_email: string }) => {
      const { error } = await supabase
        .from("pending_student_imports")
        .update({ parent_email: parent_email.trim().toLowerCase() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unlinked-imports"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const list = pendingQ.data ?? [];

  return (
    <div className="rounded-2xl border border-yellow-400/40 bg-card p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-300" />
        <h2 className="font-display text-lg font-bold uppercase">Unlinked Students Audit</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Imported students whose parent email doesn't match any account yet. Fix the email or click "Retry link" once the parent signs up.
      </p>

      <div className="mt-5 space-y-2">
        {pendingQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!pendingQ.isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing waiting — every imported student is linked to a parent account.</p>
        )}
        {list.map((row) => (
          <UnlinkedRow
            key={row.id}
            row={row}
            onRetry={() => relink.mutate(row)}
            onRemove={() => remove.mutate(row.id)}
            onEmailChange={(email) => update.mutate({ id: row.id, parent_email: email })}
            busy={relink.isPending || remove.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function UnlinkedRow({
  row,
  onRetry,
  onRemove,
  onEmailChange,
  busy,
}: {
  row: PendingImport;
  onRetry: () => void;
  onRemove: () => void;
  onEmailChange: (email: string) => void;
  busy: boolean;
}) {
  const [email, setEmail] = useState(row.parent_email);
  const dirty = email.trim().toLowerCase() !== row.parent_email.toLowerCase();
  return (
    <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/5 p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-semibold">{row.first_name} {row.last_name}</span>
          <Badge variant="outline" className="border-primary/40 text-primary">{row.current_belt}</Badge>
          <Badge variant="outline">{row.class_name}</Badge>
        </div>
      </div>

      {/* The email gets its own full-width row: a long address like
          bryananthonyrivera@gmail.com must be readable in full, and sharing a
          line with the action buttons is what made them overlap it. */}
      <div className="relative mt-2 w-full">
        <Label htmlFor={`unlinked-email-${row.id}`} className="sr-only">Parent email</Label>
        <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`unlinked-email-${row.id}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => { if (dirty) onEmailChange(email); }}
          className="h-11 w-full pl-8 text-xs"
        />
      </div>
      <div className="mt-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        Added {new Date(row.created_at).toLocaleDateString()}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onRetry} disabled={busy} variant="outline" className="h-11 w-full border-primary/50 text-primary sm:w-auto">
          <Link2 className="mr-1 h-4 w-4" /> Retry link
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={busy} className="h-11 w-full sm:w-auto">
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Discard the import for {row.first_name} {row.last_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the parked roster row for {row.parent_email}. It will not be
                linked automatically if that parent signs up later — you would have to
                re-import or add the student by hand.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground">
                Discard import
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );

}

/* ---------- PARENT USER MANAGEMENT ---------- */

type ParentProfile = {
  id: string;
  email: string;
  family_name: string | null;
  subscription_status: "free" | "premium";
  photo_consent: boolean;
  photo_consent_updated_at: string | null;
  created_at: string;
};

function ParentsTab({
  consentOnly,
  onConsentOnlyChange,
}: {
  consentOnly: boolean;
  onConsentOnlyChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: pendingConsent } = useUnacknowledgedConsentOff();
  const acknowledge = useAcknowledgeConsentEvents();
  const { data: adminIds } = useAdminUserIds();

  const profilesQ = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, family_name, subscription_status, photo_consent, photo_consent_updated_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ParentProfile[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "free" | "premium" }) => {
      const { error } = await supabase.from("profiles").update({ subscription_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "premium" ? "Upgraded to Premium" : "Downgraded to Free");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (profilesQ.data ?? []).filter((p) => {
    if (consentOnly && p.photo_consent) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return `${p.email} ${p.family_name ?? ""}`.toLowerCase().includes(needle);
  });

  const pendingCount = (pendingConsent ?? []).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-bold uppercase">Parent Accounts &amp; Premium</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle a family between Free and Premium. Premium unlocks the Leaderboard and Community Feed.
            Photo display preference is shown per family — check it before publishing photos.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or family…"
            className="h-10 pl-9 text-sm"
            aria-label="Search parent accounts"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={consentOnly ? "default" : "outline"}
          className={consentOnly ? "bg-gradient-red" : ""}
          aria-pressed={consentOnly}
          onClick={() => onConsentOnlyChange(!consentOnly)}
        >
          <CameraOff className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Photos off only
        </Button>
        {pendingCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {pendingCount} recent consent change{pendingCount === 1 ? "" : "s"} still need a staff review.
          </span>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {profilesQ.isLoading && <p className="text-sm text-muted-foreground" aria-busy="true">Loading…</p>}
        {!profilesQ.isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground">No parent accounts match.</p>
        )}
        {list.map((p) => {
          const premium = p.subscription_status === "premium";
          const staff = adminIds?.has(p.id) ?? false;
          return (
            <div key={p.id} className={`rounded-xl border p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3 ${premium ? "border-primary/40 bg-primary/5" : "border-border bg-background"}`}>
              <div className="min-w-0 sm:flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words font-semibold">{p.family_name ?? "—"}</span>
                  {staff && (
                    <Badge variant="outline" className="border-primary/50 text-primary">
                      <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" /> Admin
                    </Badge>
                  )}
                  {premium && (
                    <Badge className="bg-gradient-red text-primary-foreground">
                      <Crown className="mr-1 h-3 w-3" /> Premium
                    </Badge>
                  )}
                  {p.photo_consent ? (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      <Camera className="mr-1 h-3 w-3" aria-hidden="true" /> Photos on
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400/60 text-amber-200">
                      <CameraOff className="mr-1 h-3 w-3" aria-hidden="true" /> Photos off
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 break-words text-xs text-muted-foreground">
                  {p.email}
                  {p.photo_consent_updated_at
                    ? ` · preference updated ${new Date(p.photo_consent_updated_at).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center">
                {(pendingConsent ?? []).some((e) => e.profile_id === p.id) && (
                  <Button
                    variant="outline"
                    className="h-11 w-full sm:h-9 sm:w-auto"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(p.id)}
                  >
                    Mark reviewed
                  </Button>
                )}
                <Button
                  variant={premium ? "outline" : "default"}
                  className={`h-11 w-full sm:w-auto ${premium ? "" : "bg-gradient-red"}`}
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: p.id, status: premium ? "free" : "premium" })}
                >
                  {premium ? "Set to Free" : "Upgrade to Premium"}
                </Button>
                <AdminRoleButton
                  profileId={p.id}
                  email={p.email}
                  familyName={p.family_name}
                  isAdmin={staff}
                  adminCount={adminIds?.size ?? 0}
                />
              </div>
            </div>
          );
        })}
      </div>

      <RoleChangeHistory />
    </div>
  );
}


/* ---------- INVITE CODES ---------- */

type InviteCode = {
  code: string;
  label: string | null;
  active: boolean;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
};

function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function InviteCodesTab() {
  const qc = useQueryClient();
  const [code, setCode] = useState(() => randomCode());
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expiry, setExpiry] = useState("");

  const codesQ = useQuery({
    queryKey: ["invite-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("code, label, active, max_uses, used_count, expires_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteCode[];
    },
  });

  const createCode = useMutation({
    mutationFn: async () => {
      const clean = code.trim().toUpperCase();
      if (clean.length < 4) throw new Error("Code must be at least 4 characters.");
      const uses = Math.max(1, parseInt(maxUses || "1", 10) || 1);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("invite_codes").insert({
        code: clean,
        label: label.trim() || null,
        max_uses: uses,
        expires_at: expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite code created");
      setCode(randomCode());
      setLabel("");
      setMaxUses("1");
      setExpiry("");
      qc.invalidateQueries({ queryKey: ["invite-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: async ({ code: c, active }: { code: string; active: boolean }) => {
      const { error } = await supabase.from("invite_codes").update({ active }).eq("code", c);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite code updated");
      qc.invalidateQueries({ queryKey: ["invite-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = codesQ.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form
        onSubmit={(e) => { e.preventDefault(); createCode.mutate(); }}
        className="h-fit rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold uppercase">Generate Invite Code</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Families need a valid code to create a portal account.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="invite-code">Code</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="invite-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="font-mono uppercase tracking-widest"
              />
              <Button type="button" variant="outline" onClick={() => setCode(randomCode())}>
                New
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="invite-label">Label (optional)</Label>
            <Input
              id="invite-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Rodriguez family"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invite-max">Max uses</Label>
              <Input
                id="invite-max"
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invite-exp">Expires (optional)</Label>
              <Input
                id="invite-exp"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <Button type="submit" disabled={createCode.isPending} className="w-full bg-gradient-red">
            <Plus className="mr-1 h-4 w-4" /> Create code
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold uppercase">All Invite Codes</h2>
        {codesQ.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
        {!codesQ.isLoading && rows.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No invite codes yet.</p>
        )}
        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => {
            const expired = !!r.expires_at && new Date(r.expires_at).getTime() < Date.now();
            const used = r.used_count >= r.max_uses;
            const usable = r.active && !expired && !used;
            return (
              <li key={r.code} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-base font-bold uppercase tracking-widest">{r.code}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {r.label && <span>{r.label}</span>}
                    <span>{r.used_count} / {r.max_uses} used</span>
                    {r.expires_at && <span>expires {new Date(r.expires_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={usable ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}
                >
                  {!r.active ? "Deactivated" : expired ? "Expired" : used ? "Fully used" : "Active"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActive.mutate({ code: r.code, active: !r.active })}
                  disabled={setActive.isPending}
                >
                  {r.active ? <><X className="mr-1 h-3.5 w-3.5" /> Deactivate</> : <><Check className="mr-1 h-3.5 w-3.5" /> Reactivate</>}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------- DOJO POINT GUIDELINES ---------- */

type Guideline = { id: string; rule_text: string; sort_order: number };

function PointGuidelinesTab() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const q = useQuery({
    queryKey: ["point-guidelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dojo_point_guidelines")
        .select("id, rule_text, sort_order")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Guideline[];
    },
  });

  const rows = q.data ?? [];

  const addRule = useMutation({
    mutationFn: async () => {
      const text = draft.trim();
      if (!text) throw new Error("Write a rule first.");
      const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 1;
      const { error } = await supabase
        .from("dojo_point_guidelines")
        .insert({ rule_text: text, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["point-guidelines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRule = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const clean = text.trim();
      if (!clean) throw new Error("Rule cannot be empty.");
      const { error } = await supabase
        .from("dojo_point_guidelines")
        .update({ rule_text: clean })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("Guideline saved");
      qc.invalidateQueries({ queryKey: ["point-guidelines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dojo_point_guidelines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["point-guidelines"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase">Dojo Point Guidelines</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        The shared coach reference for awarding Dojo Points. Keep it consistent across every mat.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); addRule.mutate(); }}
        className="mt-5 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="new-guideline">New guideline</Label>
          <Input
            id="new-guideline"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="+5 for helping clean the mats"
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={addRule.isPending} className="bg-gradient-red">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </form>

      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No guidelines yet — add the first one above.</p>
      )}

      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3"
          >
            {editingId === r.id ? (
              <>
                <Input
                  aria-label="Edit guideline"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-w-[200px] flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => saveRule.mutate({ id: r.id, text: editText })}
                  disabled={saveRule.isPending}
                  className="bg-gradient-red"
                >
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-sm text-foreground">{r.rule_text}</span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Edit guideline: ${r.rule_text}`}
                  onClick={() => { setEditingId(r.id); setEditText(r.rule_text); }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Delete guideline: ${r.rule_text}`}
                  onClick={() => deleteRule.mutate(r.id)}
                  disabled={deleteRule.isPending}
                  className="border-red-500/50 text-red-200 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
