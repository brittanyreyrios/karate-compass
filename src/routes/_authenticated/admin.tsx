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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BELT_PROGRESSION, CLASS_NAMES } from "@/lib/dojo-constants";
import { GalleryAdminTab, CurriculumAdminTab, InviteQrTab } from "@/components/admin-content-tabs";
import { EventsAdminTab } from "@/components/admin-events-tab";
import { PollsAdminTab } from "@/components/admin-polls-tab";
import {
  ConsentAttentionItem,
  PhotoConsentBanner,
  NoPhotosMarker,
  useConsentOffProfiles,
  useUnacknowledgedConsentOff,
  useAcknowledgeConsentEvents,
} from "@/components/admin-photo-consent";
import { awardPoints, revertPointEvent } from "@/lib/points";



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
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${cls}`}>
      <AlertTriangle className="h-3 w-3" /> Follow Up Needed · {n} absences
    </span>
  );
}

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
        <TabsList className="flex-wrap">
          <TabsTrigger value="attendance">Master Attendance</TabsTrigger>
          <TabsTrigger value="students">Manage Students</TabsTrigger>
          <TabsTrigger value="schedules">Class Schedules &amp; Testing</TabsTrigger>
          <TabsTrigger value="events">Events Calendar</TabsTrigger>
          <TabsTrigger value="polls">Polls</TabsTrigger>
          <TabsTrigger value="parents">Parents &amp; Premium</TabsTrigger>
          <TabsTrigger value="invites">Invite Codes</TabsTrigger>
          <TabsTrigger value="qr">Signup QR</TabsTrigger>
          <TabsTrigger value="gallery">Media Gallery</TabsTrigger>
          <TabsTrigger value="curriculum">Belt Curriculum</TabsTrigger>
          <TabsTrigger value="guidelines">Dojo Point Guidelines</TabsTrigger>
          <TabsTrigger value="announcements">Post Announcement</TabsTrigger>
        </TabsList>

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
        <TabsContent value="guidelines" className="mt-6">
          <PointGuidelinesTab />
        </TabsContent>
        <TabsContent value="announcements" className="mt-6">
          <div className="space-y-6">
            <AnnouncementForm />
            <TournamentManager />
          </div>
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
        .select("id, first_name, last_name, current_belt, attendance_count, parent_id, active, class_name, points, consecutive_absences")
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
  const currentClassIsHoliday =
    classFilter !== ALL_CLASSES && holidayClasses.has(classFilter);

  const filtered = useMemo(() => {
    const list = (studentsQ.data ?? []).filter((s) => s.active);
    const byClass = classFilter === ALL_CLASSES ? list : list.filter((s) => s.class_name === classFilter);
    if (!q.trim()) return byClass;
    const needle = q.toLowerCase();
    return byClass.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.current_belt}`.toLowerCase().includes(needle),
    );
  }, [q, classFilter, studentsQ.data]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { [ALL_CLASSES]: 0 };
    for (const c of CLASS_NAMES) map[c] = 0;
    for (const s of studentsQ.data ?? []) {
      if (!s.active) continue;
      map[ALL_CLASSES]++;
      map[s.class_name] = (map[s.class_name] ?? 0) + 1;
    }
    return map;
  }, [studentsQ.data]);

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
      const { error } = await supabase
        .from("students")
        .update({
          attendance_count: student.attendance_count + 1,
          consecutive_absences: 0,
        })
        .eq("id", student.id);
      if (error) throw error;
      // Yearly log entry — drives the parent dashboard's per-calendar-year total.
      const { data: u } = await supabase.auth.getUser();
      const { error: logErr } = await supabase.from("attendance_events").insert({
        student_id: student.id,
        occurred_on: new Date().toISOString().slice(0, 10),
        created_by: u.user?.id ?? null,
      });
      if (logErr) throw logErr;
      return student.id;
    },
    onSuccess: (id) => {
      lockButton(setPresentLock, id);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
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
      if (classFilter === ALL_CLASSES) throw new Error("Select a specific class first.");
      if (currentClassIsHoliday) {
        const { error } = await supabase
          .from("class_holidays")
          .delete()
          .eq("class_name", classFilter)
          .eq("holiday_date", today);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_holidays")
          .insert({ class_name: classFilter, holiday_date: today, note: "Marked in-app" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(currentClassIsHoliday ? "Holiday cleared" : "Holiday set — absences paused");
      qc.invalidateQueries({ queryKey: ["holidays-today", today] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filterOptions: { key: string; label: string }[] = [
    { key: ALL_CLASSES, label: "All Classes" },
    ...CLASS_NAMES.map((c) => ({ key: c, label: c })),
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
          const isHol = opt.key !== ALL_CLASSES && holidayClasses.has(opt.key);
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
              {currentClassIsHoliday ? `${classFilter} — Closed today` : `${classFilter} — Regular session`}
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
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
                  <Badge variant="outline" className="border-primary/40 text-primary">{s.current_belt}</Badge>
                  <Badge variant="outline">{s.class_name}</Badge>
                  <span>{s.attendance_count} classes · {s.points} pts</span>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-1">
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
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [className, setClassName] = useState<string>(CLASS_NAMES[0]);
  const [belt, setBelt] = useState<string>("White");

  const addStudent = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim() || !parentEmail.trim()) {
        throw new Error("Please fill in all fields.");
      }
      const emailNorm = parentEmail.trim().toLowerCase();
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", emailNorm)
        .maybeSingle();
      if (profErr) throw profErr;
      if (!profile) throw new Error(`No parent account found for ${emailNorm}. Ask the parent to sign up first.`);

      const { error } = await supabase.from("students").insert({
        parent_id: profile.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        current_belt: belt,
        class_name: className,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student added");
      setFirstName(""); setLastName(""); setParentEmail("");
      setClassName(CLASS_NAMES[0]); setBelt("White");
      qc.invalidateQueries({ queryKey: ["admin-students"] });
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
            The parent must already have an account for their email to match.
          </p>

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
              <Label>Assigned class</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASS_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <BeltPicker
              idPrefix="add-student"
              systemId={systemId}
              rankId={rankId}
              onChange={(next) => { setSystemId(next.systemId); setRankId(next.rankId); }}
            />

          </div>

          <Button type="submit" disabled={addStudent.isPending} className="mt-6 w-full bg-gradient-red">
            {addStudent.isPending ? "Adding…" : "Add Student"}
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
          <div className="mt-5 space-y-3">
            {studentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!studentsQ.isLoading && (studentsQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No students yet. Add your first above.</p>
            )}
            {(studentsQ.data ?? []).map((s) =>
              editingId === s.id ? (
                <StudentEditRow key={s.id} student={s} onDone={() => setEditingId(null)} />
              ) : (
                <StudentRow key={s.id} student={s} onEdit={() => setEditingId(s.id)} />
              ),
            )}
          </div>
        </div>
      </div>

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
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-all ${riskCardClasses(student.consecutive_absences) || "border-border bg-background"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate font-semibold">{student.first_name} {student.last_name}</div>
          <FollowUpBadge n={student.consecutive_absences} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <AdminBeltBadge rankId={student.belt_rank_id} fallback={student.current_belt} />
          <Badge variant="outline">{student.class_name}</Badge>
          <span>{student.attendance_count} classes</span>
        </div>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        <Button size="icon" variant="ghost" aria-label="Remove one Dojo Point" className="h-8 w-8" onClick={() => adjustPoints.mutate(-1)} disabled={adjustPoints.isPending || student.points === 0}>
          <Minus className="h-4 w-4" />
        </Button>
        <div className="min-w-[60px] px-1 text-center">
          <div className="font-display text-lg font-bold leading-none text-primary">{student.points}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Dojo pts</div>
        </div>
        <Button size="icon" variant="ghost" aria-label="Add one Dojo Point" className="h-8 w-8" onClick={() => adjustPoints.mutate(1)} disabled={adjustPoints.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Button size="sm" variant="outline" onClick={onEdit}>
        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
      </Button>
    </div>
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
  const [className, setClassName] = useState(student.class_name);
  const [points, setPoints] = useState(String(student.points));
  const [attendance, setAttendance] = useState(String(student.attendance_count));

  // Keep the belt system in sync once the ranks list resolves.
  useEffect(() => {
    if (!systemId && currentRank) setSystemId(currentRank.system_id);
  }, [currentRank, systemId]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          belt_rank_id: rankId,
          class_name: className,
          points: Math.max(0, parseInt(points || "0", 10) || 0),
          attendance_count: Math.max(0, parseInt(attendance || "0", 10) || 0),
        })
        .eq("id", student.id);
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-students"] });
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
          <Label className="text-xs">Class</Label>
          <Select value={className} onValueChange={setClassName}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASS_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
  const [discipline, setDiscipline] = useState("Jiu-Jitsu");
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
        discipline: category === "tournament" ? discipline : null,
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
          <div>
            <Label>Discipline</Label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Jiu-Jitsu">Jiu-Jitsu</SelectItem>
                <SelectItem value="Karate">Karate</SelectItem>
                <SelectItem value="Mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        .select("id, title, body, discipline, event_date, event_end_date, venue, address, divisions, registration_deadline, spectator_info, event_url")
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
  const [form, setForm] = useState(tournament);
  const set = (key: keyof Tournament, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const optional = (value: string | null) => value?.trim() || null;
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("announcements")
        .update({
          title: form.title.trim(),
          body: form.body.trim(),
          discipline: optional(form.discipline),
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
          <Label htmlFor={`tournament-discipline-${tournament.id}`}>Discipline</Label>
          <Input id={`tournament-discipline-${tournament.id}`} value={form.discipline ?? ""} onChange={(e) => set("discipline", e.target.value)} className="mt-1" />
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

const MAX_CLASSES = 11;

type ClassSchedule = {
  id: string;
  class_name: string;
  next_test_date: string | null;
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
        .select("id, class_name, next_test_date, updated_at")
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassSchedule[];
    },
  });

  const addClass = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Enter a class name.");
      if ((schedulesQ.data ?? []).length >= MAX_CLASSES) {
        throw new Error(`Maximum of ${MAX_CLASSES} classes reached.`);
      }
      const { error } = await supabase
        .from("class_schedules")
        .insert({ class_name: name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class added");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = schedulesQ.data ?? [];

  return (
    <div className="space-y-6">
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
            {list.length} / {MAX_CLASSES} classes
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
              disabled={list.length >= MAX_CLASSES}
            />
          </div>
          <Button
            type="submit"
            className="bg-gradient-red"
            disabled={addClass.isPending || list.length >= MAX_CLASSES}
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
            <ClassScheduleRow key={c.id} schedule={c} onRemove={() => removeClass.mutate(c.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ClassScheduleRow({
  schedule,
  onRemove,
}: {
  schedule: ClassSchedule;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(schedule.next_test_date ?? "");

  useEffect(() => {
    setDate(schedule.next_test_date ?? "");
  }, [schedule.next_test_date]);

  const save = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Pick a date first.");
      const { error: schedErr } = await supabase
        .from("class_schedules")
        .update({ next_test_date: date })
        .eq("id", schedule.id);
      if (schedErr) throw schedErr;

      const { error: stuErr, count } = await supabase
        .from("students")
        .update({ next_test_date: date }, { count: "exact" })
        .eq("class_name", schedule.class_name);
      if (stuErr) throw stuErr;
      return count ?? 0;
    },
    onSuccess: (count) => {
      toast.success(`Testing date pushed to ${count} student${count === 1 ? "" : "s"} in ${schedule.class_name}`);
      qc.invalidateQueries({ queryKey: ["class-schedules"] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["students-mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const daysAway = date
    ? Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4">
      <div className="min-w-[160px] flex-1">
        <div className="font-display text-lg font-bold uppercase">{schedule.class_name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {schedule.next_test_date
            ? `Currently set for ${new Date(schedule.next_test_date).toLocaleDateString()}${daysAway !== null ? ` · ${daysAway}d away` : ""}`
            : "No test scheduled"}
        </div>
      </div>
      <div>
        <Label className="text-xs">Next mass testing date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-[180px]"
        />
      </div>
      <Button
        className="bg-gradient-red"
        disabled={save.isPending || !date || date === (schedule.next_test_date ?? "")}
        onClick={() => save.mutate()}
      >
        <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save & push"}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Remove class" onClick={onRemove} title="Remove class">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
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
  status: "ok" | "unlinked" | "error";
  message: string;
};

function normalizeBelt(input: string | undefined): string {
  if (!input) return "White";
  const needle = input.trim().toLowerCase();
  const match = BELT_PROGRESSION.find((b) => b.name.toLowerCase() === needle);
  return match?.name ?? "White";
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
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [assignedClass, setAssignedClass] = useState<string>(CLASS_NAMES[0]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);

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

        if (!profile) {
          // Stage as unlinked so admins can spot typos in the audit view.
          const { error } = await supabase.from("pending_student_imports").insert({
            first_name: row.first_name.trim(),
            last_name: row.last_name.trim(),
            parent_email: email,
            class_name: assignedClass,
            current_belt: belt,
            ...(startDate ? { start_date: startDate } : {}),
          });
          if (error) throw error;
          out.push({
            student: name,
            status: "unlinked",
            message: `Queued in audit — no parent account for ${email}`,
          });
          continue;
        }

        const payload = {
          parent_id: profile.id,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          class_name: assignedClass,
          current_belt: belt,
          ...(startDate ? { start_date: startDate } : {}),
        };
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
        out.push({ student: name, status: "ok", message: `Imported (${belt} belt)` });
      } catch (e) {
        out.push({ student: name, status: "error", message: (e as Error).message });
      }
    }
    setResults(out);
    setImporting(false);
    const okCount = out.filter((r) => r.status === "ok").length;
    const unlinked = out.filter((r) => r.status === "unlinked").length;
    toast.success(
      `Imported ${okCount} / ${out.length} students${unlinked ? ` · ${unlinked} queued in the Unlinked Audit` : ""}`,
    );
    qc.invalidateQueries({ queryKey: ["admin-students"] });
    qc.invalidateQueries({ queryKey: ["unlinked-imports"] });
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
          <Label>Assign every imported student to</Label>
          <Select value={assignedClass} onValueChange={setAssignedClass}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASS_NAMES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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

      {results.length > 0 && (
        <div className="mt-5 space-y-1 text-xs">
          {results.map((r, i) => {
            const cls =
              r.status === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : r.status === "unlinked"
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
        .select("id, first_name, last_name, parent_email, class_name, current_belt, start_date, created_at")
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
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/5 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{row.first_name} {row.last_name}</span>
          <Badge variant="outline" className="border-primary/40 text-primary">{row.current_belt}</Badge>
          <Badge variant="outline">{row.class_name}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => { if (dirty) onEmailChange(email); }}
              className="h-9 pl-8 text-xs"
            />
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Added {new Date(row.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="border-primary/50 text-primary">
        <Link2 className="mr-1 h-3.5 w-3.5" /> Retry link
      </Button>
      <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy}>
        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
      </Button>
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
        {profilesQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!profilesQ.isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground">No parent accounts match.</p>
        )}
        {list.map((p) => {
          const premium = p.subscription_status === "premium";
          return (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${premium ? "border-primary/40 bg-primary/5" : "border-border bg-background"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.family_name ?? "—"}</span>
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
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.email}
                  {p.photo_consent_updated_at
                    ? ` · preference updated ${new Date(p.photo_consent_updated_at).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
              {(pendingConsent ?? []).some((e) => e.profile_id === p.id) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acknowledge.isPending}
                  onClick={() => acknowledge.mutate(p.id)}
                >
                  Mark reviewed
                </Button>
              )}
              <Button
                size="sm"
                variant={premium ? "outline" : "default"}
                className={premium ? "" : "bg-gradient-red"}
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: p.id, status: premium ? "free" : "premium" })}
              >
                {premium ? "Set to Free" : "Upgrade to Premium"}
              </Button>
            </div>
          );
        })}
      </div>
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
