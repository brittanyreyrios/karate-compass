import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BeltChip } from "@/components/belt-chip";
import { supabase } from "@/integrations/supabase/client";
import { count } from "@/lib/plural";
import { TIER_LABELS, useBeltRanks, useBeltSystems, type CurriculumTier } from "@/lib/belts";
import { CurriculumSkeleton } from "@/components/skeletons";

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
  rank_name: string | null;
  /** Rank name, or "All Intermediate students" for tier-wide material. */
  group_label: string;
  /** True for the student's exact rank, or their exact tier. */
  is_current: boolean;
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
    const entitled = itemsQ.data?.get(s.id) ?? [];
    const current = entitled.filter((i) => i.is_current);
    // The RPC already orders earned material newest-rank-first with tier-wide
    // groups last, so grouping in arrival order preserves that.
    const earnedGroups: { label: string; items: CurriculumItem[] }[] = [];
    for (const item of entitled.filter((i) => !i.is_current)) {
      const last = earnedGroups[earnedGroups.length - 1];
      if (last && last.label === item.group_label) last.items.push(item);
      else earnedGroups.push({ label: item.group_label, items: [item] });
    }
    return { student: s, rank, system, current, earnedGroups };
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
          {perChild.map(({ student, rank, system, current, earnedGroups }) => (
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
                  {/* Current-rank count only — it must not inflate as a student advances. */}
                  <div className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                    {count(current.length, "requirement")} at this rank
                  </div>
                </div>
              </div>

              <h3 className="mt-8 font-display text-sm font-bold uppercase tracking-[0.2em] text-primary">
                Working on now
              </h3>
              {current.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing published for this rank yet. Ask at the front desk for the printed requirement
                  sheet in the meantime.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {current.map((t, i) => (
                    <RequirementCard key={t.id} item={t} index={i} />
                  ))}
                </ul>
              )}

              {earnedGroups.length > 0 && (
                <details className="mt-8 rounded-xl border border-border bg-background/60">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                    Everything {student.first_name} has earned so far
                  </summary>
                  <div className="space-y-6 border-t border-border px-4 py-4">
                    {earnedGroups.map((group) => (
                      <div key={group.label}>
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          {group.label}
                        </h4>
                        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {group.items.map((t, i) => (
                            <RequirementCard key={t.id} item={t} index={i} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
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

function RequirementCard({ item, index }: { item: CurriculumItem; index: number }) {
  return (
    <li className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="font-semibold">{item.technique}</div>
          {item.category && (
            <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
              {item.category}
            </div>
          )}
          {item.notes && <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>}
        </div>
      </div>
    </li>
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
