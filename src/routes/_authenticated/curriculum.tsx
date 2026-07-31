import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lock, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BELT_PROGRESSION } from "@/lib/dojo-constants";
import { supabase } from "@/integrations/supabase/client";
import { count } from "@/lib/plural";

export const Route = createFileRoute("/_authenticated/curriculum")({
  head: () => ({
    meta: [
      { title: "Belt Curriculum — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content: "The technique requirements for every belt rank at Tiger's Den Martial Arts & Fitness.",
      },
    ],
  }),
  component: Curriculum,
});

type CurriculumItem = {
  id: string;
  belt: string;
  technique: string;
  category: string | null;
  notes: string | null;
  sort_order: number;
};

function Curriculum() {
  const { data: students } = useQuery({
    queryKey: ["students-mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, current_belt")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const itemsQ = useQuery({
    queryKey: ["curriculum-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curriculum_items")
        .select("id, belt, technique, category, notes, sort_order")
        .eq("active", true)
        .order("sort_order")
        .order("technique");
      if (error) throw error;
      return (data ?? []) as CurriculumItem[];
    },
  });

  const student = students?.[0];
  const currentIdx = student
    ? BELT_PROGRESSION.findIndex((b) => b.name.toLowerCase() === student.current_belt.toLowerCase())
    : -1;

  const items = itemsQ.data ?? [];
  const byBelt = BELT_PROGRESSION.map((b) => ({
    belt: b,
    items: items.filter((i) => i.belt.toLowerCase() === b.name.toLowerCase()),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="text-xs uppercase tracking-[0.3em] text-primary">Technique library</div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Belt <span className="text-gradient-red">Curriculum</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Every technique required to advance, published by Tiger's Den instructors. Ranks above your
          student's current belt are shown greyed out until they get there.
        </p>
      </header>

      {itemsQ.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading curriculum…</p>}

      {!itemsQ.isLoading && byBelt.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-bold uppercase">Curriculum coming soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your instructors are still building out the technique requirements. Ask at the front desk for
            the printed requirement sheet in the meantime.
          </p>
        </div>
      )}

      {byBelt.length > 0 && (
        <div className="mt-10 space-y-8">
          {byBelt.map(({ belt, items: list }) => {
            const idx = BELT_PROGRESSION.findIndex((b) => b.name === belt.name);
            const unlocked = currentIdx < 0 || idx <= currentIdx + 1;
            const isCurrent = idx === currentIdx;
            return (
              <section
                key={belt.name}
                className={`rounded-2xl border p-6 transition-all ${
                  isCurrent ? "border-primary/60 bg-gradient-hero shadow-red-glow" : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className="h-14 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: belt.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl font-bold uppercase">{belt.name} Belt</h2>
                        {isCurrent && <Badge className="bg-primary text-primary-foreground">Current rank</Badge>}
                        {!unlocked && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Lock className="mr-1 h-3 w-3" aria-hidden="true" /> Upcoming
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                        {count(list.length, "requirement")}
                      </div>
                    </div>
                  </div>
                </div>

                <ul className={`mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${unlocked ? "" : "opacity-60"}`}>
                  {list.map((t, i) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-border bg-background p-4"
                    >
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
              </section>
            );
          })}
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
