import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Medal, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cleanDisciplines } from "@/lib/calendar-data";
import { DisciplinePicker, DisciplineTags } from "@/components/discipline-tags";
import {
  TOURNAMENT_RESULT_COLUMNS,
  placementChipClass,
  placementLabel,
  type TournamentResult,
} from "@/lib/tournament-results";

const MANUAL = "manual";

type FormState = {
  student_id: string;
  announcement_id: string;
  tournament_name: string;
  tournament_date: string;
  event_name: string;
  placement: string;
  notes: string;
  disciplines: string[];
};

const EMPTY: FormState = {
  student_id: "",
  announcement_id: MANUAL,
  tournament_name: "",
  tournament_date: "",
  event_name: "",
  placement: "",
  notes: "",
  disciplines: [],
};

type Row = TournamentResult & { students?: { first_name: string; last_name: string } | null };

export function TournamentResultsAdminTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");

  const studentsQ = useQuery({
    queryKey: ["admin-students-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, active")
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Only tournament announcements can be linked; everything else is typed by hand.
  const tournamentsQ = useQuery({
    queryKey: ["admin-tournament-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, event_date, disciplines, discipline")
        .eq("category", "tournament")
        .order("event_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resultsQ = useQuery({
    queryKey: ["admin-tournament-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_results")
        .select(`${TOURNAMENT_RESULT_COLUMNS}, students!inner(first_name, last_name)`)
        .order("tournament_date", { ascending: false })
        .order("placement", { ascending: true, nullsFirst: false })
        .order("event_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!editing) return;
    setForm({
      student_id: editing.student_id,
      announcement_id: editing.announcement_id ?? MANUAL,
      tournament_name: editing.tournament_name,
      tournament_date: editing.tournament_date,
      event_name: editing.event_name,
      placement: editing.placement === null ? "" : String(editing.placement),
      notes: editing.notes ?? "",
      disciplines: cleanDisciplines(editing.disciplines),
    });
  }, [editing]);

  /** Picking a tournament prefills the STORED columns; staff can still edit them. */
  const pickTournament = (id: string) => {
    if (id === MANUAL) {
      setForm((f) => ({ ...f, announcement_id: MANUAL }));
      return;
    }
    const t = (tournamentsQ.data ?? []).find((a) => a.id === id);
    setForm((f) => ({
      ...f,
      announcement_id: id,
      tournament_name: t?.title ?? f.tournament_name,
      tournament_date: t?.event_date ?? f.tournament_date,
      disciplines: t
        ? cleanDisciplines(t.disciplines ?? (t.discipline ? [t.discipline] : []))
        : f.disciplines,
    }));
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-tournament-results"] });
    qc.invalidateQueries({ queryKey: ["tournament-results"] });
  };

  const save = useMutation({
    mutationFn: async (keepTournament: boolean) => {
      if (!form.student_id) throw new Error("Choose a student.");
      if (!form.tournament_name.trim()) throw new Error("Tournament name is required.");
      if (!form.tournament_date) throw new Error("Tournament date is required.");
      if (!form.event_name.trim()) throw new Error("Event name is required.");
      const placement = form.placement.trim() === "" ? null : Number(form.placement);
      if (placement !== null && (!Number.isInteger(placement) || placement < 1)) {
        throw new Error("Placement must be 1 or higher, or left blank for “Competed”.");
      }

      const { data: u } = await supabase.auth.getUser();
      const row = {
        student_id: form.student_id,
        announcement_id: form.announcement_id === MANUAL ? null : form.announcement_id,
        // Always written, never resolved through the announcement at read time.
        tournament_name: form.tournament_name.trim(),
        tournament_date: form.tournament_date,
        event_name: form.event_name.trim(),
        placement,
        disciplines: form.disciplines.length > 0 ? form.disciplines : null,
        notes: form.notes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("tournament_results")
          .update(row)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tournament_results")
          .insert({ ...row, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
      return keepTournament;
    },
    onSuccess: (keepTournament) => {
      invalidate();
      toast.success(editing ? "Result updated." : "Result saved.");
      if (editing) {
        setEditing(null);
        setForm(EMPTY);
      } else if (keepTournament) {
        // Same student + tournament + tags stay put so several events at one
        // tournament need the tournament entered once.
        setForm((f) => ({ ...f, event_name: "", placement: "", notes: "" }));
      } else {
        setForm(EMPTY);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tournament_results").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Result deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = resultsQ.data ?? [];
    if (!term) return all;
    return all.filter((r) =>
      [
        r.students?.first_name ?? "",
        r.students?.last_name ?? "",
        r.tournament_name,
        r.event_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [resultsQ.data, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            {editing ? "Edit result" : "Add a result"}
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tr-student">Student</Label>
            <Select
              value={form.student_id}
              onValueChange={(v) => setForm((f) => ({ ...f, student_id: v }))}
            >
              <SelectTrigger id="tr-student" className="mt-1.5 h-11">
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {(studentsQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tr-tournament">Tournament</Label>
            <Select value={form.announcement_id} onValueChange={pickTournament}>
              <SelectTrigger id="tr-tournament" className="mt-1.5 h-11">
                <SelectValue placeholder="Choose a tournament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL}>Enter manually (outside / past event)</SelectItem>
                {(tournamentsQ.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                    {t.event_date ? ` — ${t.event_date}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tr-name">Tournament name</Label>
            <Input
              id="tr-name"
              className="mt-1.5 h-11"
              value={form.tournament_name}
              onChange={(e) => setForm((f) => ({ ...f, tournament_name: e.target.value }))}
              placeholder="e.g. NAGA Houston"
            />
          </div>

          <div>
            <Label htmlFor="tr-date">Tournament date</Label>
            <Input
              id="tr-date"
              type="date"
              className="mt-1.5 h-11"
              value={form.tournament_date}
              onChange={(e) => setForm((f) => ({ ...f, tournament_date: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="tr-event">Event / division</Label>
            <Input
              id="tr-event"
              className="mt-1.5 h-11"
              value={form.event_name}
              onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
              placeholder="Forms, Sparring, Gi, No-Gi…"
            />
          </div>

          <div>
            <Label htmlFor="tr-placement">Placement (optional)</Label>
            <Input
              id="tr-placement"
              type="number"
              min={1}
              step={1}
              className="mt-1.5 h-11"
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
              placeholder="Leave blank for “Competed”"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="tr-notes">Notes (optional)</Label>
            <Textarea
              id="tr-notes"
              className="mt-1.5"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <DisciplinePicker
              idPrefix="tr"
              value={form.disciplines}
              onChange={(next) => setForm((f) => ({ ...f, disciplines: next }))}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            disabled={save.isPending}
            onClick={() => save.mutate(false)}
          >
            {editing ? "Save changes" : "Save result"}
          </Button>
          {!editing && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={save.isPending}
              onClick={() => save.mutate(true)}
            >
              Save and add another event
            </Button>
          )}
          {(editing || form.student_id) && (
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              {editing ? "Cancel" : "Clear form"}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            Recorded results
          </h2>
          <Input
            className="h-11 sm:max-w-xs"
            placeholder="Search student, tournament or event"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search results"
          />
        </div>

        {resultsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No results recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {r.students?.first_name} {r.students?.last_name} — {r.event_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.tournament_name} · {r.tournament_date}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase ${placementChipClass(r.placement)}`}
                    >
                      {placementLabel(r.placement)}
                    </span>
                    <DisciplineTags disciplines={cleanDisciplines(r.disciplines)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(`Delete ${r.event_name} at ${r.tournament_name}?`)) {
                        del.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
