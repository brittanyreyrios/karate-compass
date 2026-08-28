import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cleanDisciplines } from "@/lib/calendar-data";
import { DisciplinePicker } from "@/components/discipline-tags";
import { useClasses, useEnrollments, usePrograms, indexEnrollments } from "@/lib/enrollment";

const MANUAL = "manual";
const ALL = "all";

/**
 * DUPLICATE COMPARISON CONTRACT
 *
 * Round 22 shipped a bug where code compared "Jiu-Jitsu" against stored
 * "Jiu Jitsu" and the match silently never fired. Here the same class of bug
 * would mean staff get double rows, so tournament name and event name are
 * compared through this one normaliser on BOTH sides — trimmed, lowercased, and
 * internal whitespace collapsed. Dates are compared as plain date strings.
 */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  class_name: string;
};

type Picked = { checked: boolean; placement: string; override: boolean };

export function TournamentBulkEntry() {
  const qc = useQueryClient();

  const [announcementId, setAnnouncementId] = useState(MANUAL);
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [eventName, setEventName] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState(ALL);
  const [classFilter, setClassFilter] = useState(ALL);
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [report, setReport] = useState<string[] | null>(null);

  const classesQ = useClasses();
  const enrollQ = useEnrollments();
  const programsQ = usePrograms();

  // Active students only — archived / inactive rows are filtered in the query,
  // so they can never reach the picker.
  const studentsQ = useQuery({
    queryKey: ["admin-students-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, active, class_name")
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as unknown as StudentRow[];
    },
  });

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

  /** Existing rows for this tournament + event, used for duplicate detection. */
  const existingQ = useQuery({
    queryKey: ["tournament-results-existing", norm(tournamentName), tournamentDate, norm(eventName)],
    enabled: !!tournamentName.trim() && !!tournamentDate && !!eventName.trim(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_results")
        .select("student_id, tournament_name, event_name, tournament_date")
        .eq("tournament_date", tournamentDate);
      if (error) throw error;
      // Normalised comparison on both sides — the database holds whatever staff
      // typed, so filtering happens here rather than with an exact eq().
      return (data ?? [])
        .filter(
          (r) =>
            norm(r.tournament_name) === norm(tournamentName) &&
            norm(r.event_name) === norm(eventName),
        )
        .map((r) => r.student_id as string);
    },
  });

  const alreadyRecorded = useMemo(() => new Set(existingQ.data ?? []), [existingQ.data]);

  const pickTournament = (id: string) => {
    setAnnouncementId(id);
    if (id === MANUAL) return;
    const t = (tournamentsQ.data ?? []).find((a) => a.id === id);
    if (!t) return;
    setTournamentName(t.title ?? "");
    setTournamentDate(t.event_date ?? "");
    setDisciplines(cleanDisciplines(t.disciplines ?? (t.discipline ? [t.discipline] : [])));
  };

  const idx = useMemo(() => indexEnrollments(enrollQ.data), [enrollQ.data]);

  const classesForProgram = useMemo(() => {
    const all = classesQ.data ?? [];
    if (programFilter === ALL) return all;
    return all.filter((c) => c.program_id === programFilter);
  }, [classesQ.data, programFilter]);

  const shown = useMemo(() => {
    const term = norm(search);
    let list = studentsQ.data ?? [];
    if (classFilter !== ALL) {
      const ids = idx.studentsByClass.get(classFilter) ?? new Set<string>();
      list = list.filter((s) => ids.has(s.id));
    } else if (programFilter !== ALL) {
      const ids = new Set<string>();
      for (const c of classesForProgram) {
        for (const sid of idx.studentsByClass.get(c.id) ?? []) ids.add(sid);
      }
      list = list.filter((s) => ids.has(s.id));
    }
    if (term) {
      list = list.filter((s) => norm(`${s.first_name} ${s.last_name}`).includes(term));
    }
    return list;
  }, [studentsQ.data, classFilter, programFilter, classesForProgram, idx, search]);

  const state = (id: string): Picked =>
    picked[id] ?? { checked: false, placement: "", override: false };
  const setState = (id: string, patch: Partial<Picked>) =>
    setPicked((p) => ({ ...p, [id]: { ...state(id), ...patch } }));

  const selected = shown.filter((s) => {
    const st = state(s.id);
    if (!st.checked) return false;
    return !alreadyRecorded.has(s.id) || st.override;
  });

  const skippedDuplicates = shown.filter(
    (s) => state(s.id).checked && alreadyRecorded.has(s.id) && !state(s.id).override,
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!tournamentName.trim()) throw new Error("Tournament name is required.");
      if (!tournamentDate) throw new Error("Tournament date is required.");
      if (!eventName.trim()) throw new Error("Event name is required.");
      if (selected.length === 0) throw new Error("Tick at least one student who competed.");

      // Every placement is validated BEFORE the array is built. A single
      // insert([...]) is atomic: one bad box would otherwise reject the whole
      // batch as a raw Postgres CHECK error.
      for (const s of selected) {
        const raw = state(s.id).placement.trim();
        if (raw === "") continue; // blank = competed without placing, the common case
        const n = Number(raw);
        if (!/^\d+$/.test(raw) || !Number.isInteger(n) || n < 1) {
          throw new Error(
            `${s.first_name} ${s.last_name}: placement must be a whole number 1 or higher, or left blank for “Competed”.`,
          );
        }
      }

      const { data: u } = await supabase.auth.getUser();
      const rows = selected.map((s) => {
        const raw = state(s.id).placement.trim();
        return {
          student_id: s.id,
          announcement_id: announcementId === MANUAL ? null : announcementId,
          // Written on every row, exactly as Round 32 — deleting the linked
          // announcement must break the link, never the record.
          tournament_name: tournamentName.trim(),
          tournament_date: tournamentDate,
          event_name: eventName.trim(),
          placement: raw === "" ? null : Number(raw),
          disciplines: disciplines.length > 0 ? disciplines : null,
          notes: null,
          created_by: u.user?.id ?? null,
        };
      });

      // ONE call, one array. Not a loop — a loop failing partway would leave
      // some children recorded and others not, invisibly.
      const { data, error } = await supabase
        .from("tournament_results")
        .insert(rows)
        .select("id, student_id");

      if (error) {
        console.error("Bulk tournament result insert failed", error);
        throw new Error(
          "We couldn't save this batch just now. No results were saved — nothing was recorded for any student. Please try again.",
        );
      }

      return {
        created: (data ?? []).length,
        names: selected.map((s) => `${s.first_name} ${s.last_name}`),
        skipped: skippedDuplicates.map((s) => `${s.first_name} ${s.last_name}`),
      };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-tournament-results"] });
      qc.invalidateQueries({ queryKey: ["tournament-results"] });
      qc.invalidateQueries({ queryKey: ["tournament-results-existing"] });
      const lines = [
        `${r.created} result${r.created === 1 ? "" : "s"} saved for ${eventName.trim()} at ${tournamentName.trim()}: ${r.names.join(", ")}.`,
        ...(r.skipped.length > 0
          ? [`Skipped as already recorded: ${r.skipped.join(", ")}.`]
          : []),
      ];
      setReport(lines);
      toast.success(lines.join(" "));
      setPicked({});
    },
    onError: (e: Error) => {
      setReport(null);
      toast.error(e.message);
    },
  });

  const readyForRoster = !!tournamentName.trim() && !!tournamentDate && !!eventName.trim();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">
          Bulk entry — one event, many students
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        One event per batch. A child who competed in two events needs the batch run twice.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bulk-tournament">Tournament</Label>
          <Select value={announcementId} onValueChange={pickTournament}>
            <SelectTrigger id="bulk-tournament" className="mt-1.5 h-11">
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
          <Label htmlFor="bulk-event">Event / division for this batch</Label>
          <Input
            id="bulk-event"
            className="mt-1.5 h-11"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Sparring, No-Gi, Forms…"
          />
        </div>

        <div>
          <Label htmlFor="bulk-name">Tournament name</Label>
          <Input
            id="bulk-name"
            className="mt-1.5 h-11"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            placeholder="e.g. NAGA Houston"
          />
        </div>

        <div>
          <Label htmlFor="bulk-date">Tournament date</Label>
          <Input
            id="bulk-date"
            type="date"
            className="mt-1.5 h-11"
            value={tournamentDate}
            onChange={(e) => setTournamentDate(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <DisciplinePicker idPrefix="bulk" value={disciplines} onChange={setDisciplines} />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            className="h-11"
            placeholder="Search student name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search students"
          />
          <Select
            value={programFilter}
            onValueChange={(v) => {
              setProgramFilter(v);
              setClassFilter(ALL);
            }}
          >
            <SelectTrigger className="h-11" aria-label="Filter by programme">
              <SelectValue placeholder="All programmes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All programmes</SelectItem>
              {(programsQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-11" aria-label="Filter by class">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All classes</SelectItem>
              {classesForProgram.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.class_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!readyForRoster ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Enter the tournament name, date and event name to load the roster.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPicked((p) => {
                    const next = { ...p };
                    for (const s of shown) {
                      if (alreadyRecorded.has(s.id)) continue;
                      next[s.id] = { ...state(s.id), checked: true };
                    }
                    return next;
                  })
                }
              >
                Select all shown
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPicked({})}>
                Clear selection
              </Button>
              <span className="text-xs text-muted-foreground">
                {selected.length} selected · {shown.length} shown
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {shown.map((s) => {
                const st = state(s.id);
                const dup = alreadyRecorded.has(s.id);
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <label className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={st.checked}
                        disabled={dup && !st.override}
                        onCheckedChange={(v) => setState(s.id, { checked: v === true })}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">
                          {s.first_name} {s.last_name}
                        </span>
                        <span className="block text-xs text-muted-foreground">{s.class_name}</span>
                        {dup && (
                          <span className="mt-0.5 block text-xs font-semibold text-amber-500">
                            Already recorded for this event — excluded from this batch
                          </span>
                        )}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      {dup && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setState(s.id, { override: !st.override, checked: !st.override })
                          }
                        >
                          {st.override ? "Exclude again" : "Record anyway"}
                        </Button>
                      )}
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className="h-11 w-32"
                        aria-label={`Placement for ${s.first_name} ${s.last_name}`}
                        placeholder="Placement"
                        value={st.placement}
                        onChange={(e) => setState(s.id, { placement: e.target.value })}
                      />
                    </div>
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="text-sm text-muted-foreground">No active students match.</li>
              )}
            </ul>
          </>
        )}
      </div>

      {report && (
        <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-sm">
          {report.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Button
          className="w-full sm:w-auto"
          disabled={save.isPending || selected.length === 0}
          onClick={() => save.mutate()}
        >
          {save.isPending
            ? "Saving…"
            : `Save ${selected.length} result${selected.length === 1 ? "" : "s"}`}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Blank placement means the student competed without placing — the normal case.
        </p>
      </div>
    </div>
  );
}
