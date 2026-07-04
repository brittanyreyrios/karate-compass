import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Check, Megaphone, Trophy, ShieldCheck } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Staff admin console: master attendance sheet and announcement controls." },
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
};

function AdminPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [justCheckedIn, setJustCheckedIn] = useState<Record<string, number>>({});

  const studentsQ = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, current_belt, attendance_count, parent_id, active")
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  // Realtime for admin too
  useEffect(() => {
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-students"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => {
    const list = studentsQ.data ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.current_belt}`.toLowerCase().includes(needle),
    );
  }, [q, studentsQ.data]);

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
          <TabsTrigger value="announcements">Post Announcement</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold uppercase">Master Attendance Sheet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap the +1 button to log a class. Parents see updates instantly.
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

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {studentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!studentsQ.isLoading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No students found. Add students in the database to see them here.</p>
              )}
              {filtered.map((s) => {
                const flash = !!justCheckedIn[s.id];
                return (
                  <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${flash ? "border-primary bg-primary/5 shadow-red-glow" : "border-border bg-background"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.first_name} {s.last_name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="border-primary/40 text-primary">{s.current_belt}</Badge>
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
        </TabsContent>

        <TabsContent value="announcements" className="mt-6">
          <AnnouncementForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
      const payload: Record<string, unknown> = {
        category,
        title: title.trim(),
        body: body.trim(),
        created_by: u.user?.id ?? null,
      };
      if (category === "school_news") {
        payload.tag = tag.trim() || "News";
      } else {
        payload.discipline = discipline;
        payload.location = location.trim();
        payload.event_date = eventDate || null;
      }
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
