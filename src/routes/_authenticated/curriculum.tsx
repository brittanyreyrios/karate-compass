import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BELT_PROGRESSION, CURRICULUM } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/curriculum")({
  head: () => ({
    meta: [
      { title: "Belt Curriculum — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Video-based technique library organized by belt rank." },
    ],
  }),
  component: Curriculum,
});

function Curriculum() {
  const { data: students } = useQuery({
    queryKey: ["students-mine"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").order("created_at");
      return data ?? [];
    },
  });
  const student = students?.[0];
  const currentIdx = student
    ? BELT_PROGRESSION.findIndex((b) => b.name.toLowerCase() === student.current_belt.toLowerCase())
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="text-xs uppercase tracking-[0.3em] text-primary">Technique library</div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Belt <span className="text-gradient-red">Curriculum</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Every technique required to advance. Videos unlock as your child progresses through each belt rank.
        </p>
      </header>

      <div className="mt-10 space-y-8">
        {CURRICULUM.map((c) => {
          const idx = BELT_PROGRESSION.findIndex((b) => b.name === c.belt);
          const unlocked = idx <= currentIdx + 1;
          const isCurrent = idx === currentIdx;
          return (
            <section key={c.belt} className={`rounded-2xl border p-6 transition-all ${isCurrent ? "border-primary/60 bg-gradient-hero shadow-red-glow" : "border-border bg-card"}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-14 w-3 shrink-0 rounded-sm" style={{ backgroundColor: BELT_PROGRESSION.find((b) => b.name === c.belt)!.color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-display text-2xl font-bold uppercase">{c.belt} Belt</h2>
                      {isCurrent && <Badge className="bg-primary text-primary-foreground">Current</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {c.duration}</span>
                      <span>{c.techniques.length} techniques</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {c.techniques.map((t, i) => (
                  <VideoCard key={t} title={t} idx={i + 1} unlocked={unlocked} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function VideoCard({ title, idx, unlocked }: { title: string; idx: number; unlocked: boolean }) {
  return (
    <div className={`group relative overflow-hidden rounded-xl border transition-all ${unlocked ? "cursor-pointer border-border bg-background hover:border-primary/50" : "border-border bg-background/40"}`}>
      <div className="relative aspect-video bg-gradient-to-br from-secondary via-secondary/60 to-background">
        <div className="absolute inset-0 grid place-items-center">
          {unlocked ? (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary shadow-red-glow transition-transform group-hover:scale-110">
              <Play className="h-6 w-6 fill-white text-white" />
            </div>
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-black/40">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-bold uppercase tracking-widest">
          Ep {String(idx).padStart(2, "0")}
        </div>
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">
          {unlocked ? "Watch technique" : "Locked"}
        </div>
      </div>
    </div>
  );
}
