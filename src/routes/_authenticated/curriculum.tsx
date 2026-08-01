import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BeltChip } from "@/components/belt-chip";
import { supabase } from "@/integrations/supabase/client";
import { count } from "@/lib/plural";
import { TIER_LABELS, useBeltRanks, useBeltSystems, type CurriculumTier } from "@/lib/belts";

export const Route = createFileRoute("/_authenticated/curriculum")({
  head: () => ({
    meta: [
      { title: "Belt Curriculum — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "The technique requirements for your child's exact belt rank at Tiger's Den Martial Arts & Fitness.",
      },
    ],
  }),
  component: Curriculum,
});

type CurriculumItem = {
  id: string;
  technique: string;
  category: string | null;
  notes: string | null;
  sort_order: number;
  belt_rank_id: string | null;
  curriculum_tier: CurriculumTier | null;
};

function Curriculum() {
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();

  const studentsQ = useQuery({
    queryKey: ["students-mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, current_belt, belt_rank_id")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const students = studentsQ.data ?? [];
  const ranks = ranksQ.data ?? [];
  const systems = systemsQ.data ?? [];

  // Entitlement is resolved on the server: get_curriculum_for_student verifies
  // the caller owns the student, reads the rank server-side and returns only the
  // entitled rows — the full library never reaches the browser.
  const itemsQ = useQuery({
    queryKey: ["curriculum-for-students", students.map((s) => s.id).join(",")],
    enabled: students.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        students.map(async (s) => {
          const { data, error } = await supabase.rpc("get_curriculum_for_student", {
            _student_id: s.id,
          });
          if (error) throw error;
          return [s.id, (data ?? []) as CurriculumItem[]] as const;
        }),
      );
      return new Map(entries);
    },
  });

  const loading = studentsQ.isLoading || ranksQ.isLoading || (students.length > 0 && itemsQ.isLoading);

  const perChild = students.map((s) => {
    const rank = ranks.find((r) => r.id === s.belt_rank_id);
    const system = systems.find((sys) => sys.id === rank?.system_id);
    return { student: s, rank, system, entitled: itemsQ.data?.get(s.id) ?? [] };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="text-xs uppercase tracking-[0.3em] text-primary">Technique library</div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Belt <span className="text-gradient-red">Curriculum</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Requirements for your child's exact rank, published by Tiger's Den instructors. Each of our
          three belt systems has its own material, so what you see below is only what your child is
          currently working on.
        </p>
      </header>

      {loading && <p className="mt-8 text-sm text-muted-foreground">Loading curriculum…</p>}

      {!loading && students.length === 0 && (
        <EmptyCard
          title="No students linked yet"
          body="Ask a Tiger's Den admin to link your child to your account and their curriculum will appear here."
        />
      )}

      {!loading && perChild.length > 0 && (
        <div className="mt-10 space-y-10">
          {perChild.map(({ student, rank, system, entitled }) => (
            <section key={student.id} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-bold uppercase">{student.first_name}</h2>
                  <div className="mt-2">
                    {rank ? (
                      <BeltChip
                        name={rank.name}
                        pattern={rank.pattern}
                        colorPrimary={rank.color_primary}
                        colorAccent={rank.color_accent}
                        systemName={system?.name ?? null}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No belt rank assigned yet — ask an instructor to set it.
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {rank && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {TIER_LABELS[rank.curriculum_tier]} curriculum
                    </Badge>
                  )}
                  <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                    {count(entitled.length, "requirement")}
                  </div>
                </div>
              </div>

              {entitled.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  Nothing published for this rank yet. Ask at the front desk for the printed requirement
                  sheet in the meantime.
                </p>
              ) : (
                <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {entitled.map((t, i) => (
                    <li key={t.id} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold">{t.technique}</div>
                          {t.category && (
                            <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                              {t.category}
                            </div>
                          )}
                          {t.notes && <p className="mt-2 text-sm text-muted-foreground">{t.notes}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Requirements are set by Tiger's Den instructors and can change — your instructor's word on the mat
        is always final.
      </p>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <ScrollText className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} aria-hidden="true" />
      <h2 className="mt-4 font-display text-lg font-bold uppercase">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
