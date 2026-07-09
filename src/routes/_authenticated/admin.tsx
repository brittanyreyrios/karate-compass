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
import { BELT_PROGRESSION, CLASS_NAMES } from "@/lib/mock-data";

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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cls}`}>
      <AlertTriangle className="h-3 w-3" /> Follow Up Needed · {n} absences
    </span>
  );
}

function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary">
            <ShieldCheck className="h-3 w-3" /> Admin Console
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Staff <span className="text-gradient-red">Dashboard</span>
          </h1>
        </div>
      </header>

      <Tabs defaultValue="attendance" className="mt-8">
        <TabsList>
          <TabsTrigger value="attendance">Master Attendance</TabsTrigger>
          <TabsTrigger value="students">Manage Students</TabsTrigger>
          <TabsTrigger value="schedules">Class Schedules &amp; Testing</TabsTrigger>
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
        <TabsContent value="announcements" className="mt-6">
          <AnnouncementForm />
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
  const [justCheckedIn, setJustCheckedIn] = useState<Record<string, number>>({});

  const studentsQ = useStudents();

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

  const checkIn = useMutation({
    mutationFn: async (student: Student) => {
      const { error } = await supabase
        .from("students")
        .update({ attendance_count: student.attendance_count + 1 })
        .eq("id", student.id);
      if (error) throw error;
      return student.id;
    },
    onSuccess: (id) => {
      setJustCheckedIn((s) => ({ ...s, [id]: Date.now() }));
      setTimeout(() => setJustCheckedIn((s) => { const c = { ...s }; delete c[id]; return c; }), 1500);
      qc.invalidateQueries({ queryKey: ["admin-students"] });
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
            Filter by class, then tap +1 to log a session. Parents see updates instantly.
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
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-black/25 text-white" : "bg-secondary text-foreground/70"}`}>
                {counts[opt.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {studentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!studentsQ.isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No students in this view. Adjust the filter or add students in Manage Students.</p>
        )}
        {filtered.map((s) => {
          const flash = !!justCheckedIn[s.id];
          return (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${flash ? "border-primary bg-primary/5 shadow-red-glow" : "border-border bg-background"}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.first_name} {s.last_name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-primary/40 text-primary">{s.current_belt}</Badge>
                  <Badge variant="outline">{s.class_name}</Badge>
                  <span>{s.attendance_count} classes</span>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => checkIn.mutate(s)}
                disabled={checkIn.isPending}
                className="h-14 min-w-[92px] bg-gradient-red text-base font-bold uppercase tracking-wider shadow-red-glow active:scale-95"
              >
                {flash ? <Check className="h-5 w-5" /> : <><Plus className="mr-1 h-5 w-5" />1 Class</>}
              </Button>
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
          <div>
            <Label>Starting belt</Label>
            <Select value={belt} onValueChange={setBelt}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BELT_PROGRESSION.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" disabled={addStudent.isPending} className="mt-6 w-full bg-gradient-red">
          {addStudent.isPending ? "Adding…" : "Add Student"}
        </Button>
      </form>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold uppercase">All Students</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit details, promote belts or adjust Dojo Points.
        </p>
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
  );
}

function StudentRow({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const qc = useQueryClient();
  const adjustPoints = useMutation({
    mutationFn: async (delta: number) => {
      const { error } = await supabase
        .from("students")
        .update({ points: Math.max(0, student.points + delta) })
        .eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-students"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{student.first_name} {student.last_name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-primary/40 text-primary">{student.current_belt}</Badge>
          <Badge variant="outline">{student.class_name}</Badge>
          <span>{student.attendance_count} classes</span>
        </div>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => adjustPoints.mutate(-1)} disabled={adjustPoints.isPending || student.points === 0}>
          <Minus className="h-4 w-4" />
        </Button>
        <div className="min-w-[60px] px-1 text-center">
          <div className="font-display text-lg font-bold leading-none text-primary">{student.points}</div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Dojo pts</div>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => adjustPoints.mutate(1)} disabled={adjustPoints.isPending}>
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
  const [belt, setBelt] = useState(student.current_belt);
  const [className, setClassName] = useState(student.class_name);
  const [points, setPoints] = useState(String(student.points));
  const [attendance, setAttendance] = useState(String(student.attendance_count));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          current_belt: belt,
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
        <div>
          <Label className="text-xs">Belt tier</Label>
          <Select value={belt} onValueChange={setBelt}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BELT_PROGRESSION.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
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
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San Diego, CA" className="mt-1" />
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
      <Button variant="ghost" size="icon" onClick={onRemove} title="Remove class">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
