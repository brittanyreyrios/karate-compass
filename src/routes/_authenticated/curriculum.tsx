import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BeltChip } from "@/components/belt-chip";
import { VideoFacade } from "@/components/video-facade";
import { supabase } from "@/integrations/supabase/client";
import { count } from "@/lib/plural";
import { beltLabelStyle } from "@/lib/belt-colors";
import { formatRuntime } from "@/lib/youtube";
import { TIER_LABELS, useBeltRanks, useBeltSystems, type CurriculumTier } from "@/lib/belts";
import { CurriculumSkeleton } from "@/components/skeletons";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { QueryErrorState } from "@/components/query-error";


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
  video_youtube_id: string | null;
  video_title: string | null;
  video_seconds: number | null;
};

type ChildRow = CurriculumItem & {
  student_id: string;
  first_name: string;
  belt_rank_id_student: string | null;
  student_created_at: string;
};


function Curriculum() {
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();

  /**
   * ONE round trip for the whole page. get_curriculum_for_all_children resolves
   * the parent from auth.uid() server-side and applies exactly the same
   * entitlement rules as get_curriculum_for_student — the rank, the belt system
   * and the tier ceiling are all read in the database, never sent from the
   * browser, so the full library still never reaches the client. Previously this
   * was a waterfall: mount → fetch children → N× fetch curriculum.
   */
  const childrenQ = useQuery({
    queryKey: ["curriculum-for-children"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_curriculum_for_all_children");
      if (error) throw error;
      return (data ?? []) as ChildRow[];
    },
  });

  /**
   * Section Z: the RPC keeps `WHERE k.belt_rank_id IS NOT NULL` — it is the
   * entitlement boundary and stays untouched — which means a child with no rank
   * yet returns zero rows and used to vanish from this page entirely. The roster
   * therefore comes from its own students query, dispatched in the same render
   * (neither query gates the other), and curriculum rows are attached to it
   * client-side. A rankless child now renders their own section with the
   * "nothing published yet" copy instead of disappearing.
   */
  const studentsQ = useQuery({
    queryKey: ["students-mine-curriculum"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, belt_rank_id, created_at")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        first_name: string;
        belt_rank_id: string | null;
        created_at: string;
      }[];
    },
  });

  const ranks = ranksQ.data ?? [];
  const systems = systemsQ.data ?? [];

  const rawLoading = childrenQ.isLoading || studentsQ.isLoading || ranksQ.isLoading;
  const failedToLoad = childrenQ.isError || studentsQ.isError || ranksQ.isError;
  const retryAll = () => {
    void childrenQ.refetch();
    void studentsQ.refetch();
    void ranksQ.refetch();
  };
  const loading = useDelayedLoading(rawLoading);

  // Rows arrive grouped per child (student created_at, then the RPC's ordering
  // contract), so appending in arrival order preserves the RPC's ordering inside
  // each child's bucket.
  const rowsByStudent = new Map<string, ChildRow[]>();
  for (const row of childrenQ.data ?? []) {
    const bucket = rowsByStudent.get(row.student_id);
    if (bucket) bucket.push(row);
    else rowsByStudent.set(row.student_id, [row]);
  }

  // The roster drives the sections, so every child gets one — ranked or not.
  const perChild = (studentsQ.data ?? []).map((s) => ({
    studentId: s.id,
    firstName: s.first_name,
    rankId: s.belt_rank_id,
    rows: rowsByStudent.get(s.id) ?? [],
  }));

  const sections = perChild.map(({ studentId, firstName, rankId, rows }) => {
    const rank = ranks.find((r) => r.id === rankId);
    const system = systems.find((sys) => sys.id === rank?.system_id);
    // "Dojo Basics" is the beginner tier-wide material — etiquette and
    // fundamentals every student is held to, at every belt. It is pulled out of
    // the rank/earned buckets FIRST so each item renders exactly once.
    const basics = rows.filter((i) => i.belt_rank_id === null && i.curriculum_tier === "beginner");
    const basicIds = new Set(basics.map((i) => i.id));
    const rest = rows.filter((i) => !basicIds.has(i.id));
    const current = rest.filter((i) => i.is_current);
    const earnedGroups: { label: string; items: CurriculumItem[] }[] = [];
    for (const item of rest.filter((i) => !i.is_current)) {
      const last = earnedGroups[earnedGroups.length - 1];
      if (last && last.label === item.group_label) last.items.push(item);
      else earnedGroups.push({ label: item.group_label, items: [item] });
    }
    return { studentId, firstName, rank, system, basics, current, earnedGroups };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        {/* Wide tracking belongs on large display type only — below ~14px it reads
            as thin and spreads a short label across the page. */}
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          Technique library
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Belt <span className="text-gradient-red">Curriculum</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Requirements for your child's exact rank, published by Tiger's Den instructors. Each of our
          three belt systems has its own material, so what you see below is only what your child is
          currently working on.
        </p>
      </header>

      {loading && <CurriculumSkeleton />}

      {!loading && failedToLoad && (
        <QueryErrorState className="mt-10" what="your child's curriculum" onRetry={retryAll} />
      )}

      {!loading && !failedToLoad && sections.length === 0 && (
        <EmptyCard
          title="No students linked yet"
          body="Ask a Tiger's Den admin to link your child to your account and their curriculum will appear here."
        />
      )}

      {!loading && !failedToLoad && sections.length > 0 && (
        <div className="mt-10 space-y-12">
          {sections.map(({ studentId, firstName, rank, system, basics, current, earnedGroups }) => (
            <section key={studentId} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-bold uppercase sm:text-3xl">
                    {firstName}
                  </h2>
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
                    <Badge
                      variant="outline"
                      style={beltLabelStyle(rank.color_primary, rank.color_accent)}
                    >
                      {TIER_LABELS[rank.curriculum_tier]} curriculum
                    </Badge>
                  )}
                  {/* Current-rank count only — it must not inflate as a student advances. */}
                  <div className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {count(current.length, "requirement")} at this rank
                  </div>
                </div>
              </div>

              {basics.length > 0 && (
                <div className="mt-10">
                  <SectionHeading>Dojo Basics</SectionHeading>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Etiquette and fundamentals — for every student, at every belt.
                  </p>
                  <RequirementList items={basics} />
                </div>
              )}

              <div className="mt-10">
                <SectionHeading accent>Working on now</SectionHeading>
                {current.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nothing published for this rank yet. Ask at the front desk for the printed
                    requirement sheet in the meantime.
                  </p>
                ) : (
                  <RequirementList items={current} />
                )}
              </div>

              {earnedGroups.length > 0 && (
                <EarnedAccordion firstName={firstName} groups={earnedGroups} />
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

/** Section level: clearly larger than the technique names it labels. */
function SectionHeading({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <h3
      className={`font-display text-xl font-bold uppercase tracking-wide sm:text-2xl ${
        accent ? "text-primary" : ""
      }`}
    >
      {children}
    </h3>
  );
}

/**
 * Library layout: two wide columns on desktop, one on a phone, and `items-start`
 * so a short text-only requirement is allowed to stay short instead of being
 * stretched to match the video card beside it.
 */
function RequirementList({ items }: { items: CurriculumItem[] }) {
  return (
    <ul className="mt-5 grid items-start gap-x-6 gap-y-8 sm:grid-cols-2">
      {items.map((item, i) => (
        <RequirementCard key={item.id} item={item} index={i} />
      ))}
    </ul>
  );
}

function RequirementCard({ item, index }: { item: CurriculumItem; index: number }) {
  const runtime = formatRuntime(item.video_seconds);
  const position = String(index + 1).padStart(2, "0");
  // Metadata line, YouTube style: quieter than the title, one line, not stacked.
  const meta = [item.category, runtime, item.group_label].filter(Boolean) as string[];

  if (item.video_youtube_id) {
    return (
      <li>
        {/* No card border: the thumbnail already defines the shape. */}
        <VideoFacade
          videoId={item.video_youtube_id}
          technique={item.technique}
          videoSeconds={item.video_seconds}
          variant="cover"
        />
        <div className="mt-3">
          <h4 className="text-lg font-bold leading-snug sm:text-xl">
            <span className="mr-2 tabular-nums font-semibold text-muted-foreground">{position}</span>
            {item.technique}
          </h4>
          {meta.length > 0 && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{meta.join(" · ")}</p>
          )}
          {/* Notes carry real instruction, so they sit at full foreground. */}
          {item.notes && <p className="mt-2 text-sm leading-relaxed">{item.notes}</p>}
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-border bg-background p-4">
      <h4 className="text-base font-bold leading-snug sm:text-lg">
        <span className="mr-2 tabular-nums font-semibold text-muted-foreground">{position}</span>
        {item.technique}
      </h4>
      {item.category && <p className="mt-1 text-sm text-muted-foreground">{item.category}</p>}
      {item.notes && <p className="mt-2 text-sm leading-relaxed">{item.notes}</p>}
    </li>
  );
}

/**
 * The earned library is rendered ONLY once opened. A <details> keeps its children
 * in the DOM whether open or not, so a brown belt would otherwise build every
 * requirement — and every thumbnail <img> — from every rank below them before
 * anything became visible. The summary keeps the item count so nothing looks
 * missing while collapsed.
 */
function EarnedAccordion({
  firstName,
  groups,
}: {
  firstName: string;
  groups: { label: string; items: CurriculumItem[] }[];
}) {
  const [open, setOpen] = useState(false);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <details
      className="mt-10 rounded-xl border border-border bg-background/60"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex min-h-[44px] cursor-pointer items-center px-4 py-3 text-base font-semibold">
        Everything {firstName} has earned so far
        <span className="ml-2 text-sm font-medium text-muted-foreground">
          ({count(total, "requirement")})
        </span>
      </summary>
      {open && (
        <div className="space-y-8 border-t border-border px-4 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <h4 className="font-display text-base font-bold uppercase tracking-wide sm:text-lg">
                {group.label}
              </h4>
              <RequirementList items={group.items} />
            </div>
          ))}
        </div>
      )}
    </details>
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
