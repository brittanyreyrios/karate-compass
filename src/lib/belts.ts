import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tiger's Den runs three parallel belt systems (youth stripe / camo / solid).
 * Rank order, colors and pattern all live in the database (`belt_systems` and
 * `belt_ranks`) so staff can correct them without a migration.
 */
export type BeltPattern = "solid" | "stripe" | "camo";
export type CurriculumTier = "beginner" | "intermediate" | "advanced";

export type BeltSystem = {
  id: string;
  slug: string;
  name: string;
  age_guidance: string | null;
  sort_order: number;
  /**
   * Round 10 AK3: not every program has belts. Tai chi has levels, so the UI
   * must not draw a belt graphic or say "belt" for it. Data-driven on purpose —
   * a future beltless program needs no code change, only a row.
   */
  uses_belts: boolean;
};


export type BeltRank = {
  id: string;
  system_id: string;
  name: string;
  short_name: string | null;
  pattern: BeltPattern;
  color_primary: string;
  color_accent: string | null;
  curriculum_tier: CurriculumTier;
  sort_order: number;
  active: boolean;
};

export const TIER_LABELS: Record<CurriculumTier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const CURRICULUM_TIERS: CurriculumTier[] = ["beginner", "intermediate", "advanced"];

export function useBeltSystems() {
  return useQuery({
    queryKey: ["belt-systems"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("belt_systems")
        .select("id, slug, name, age_guidance, sort_order, uses_belts")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as BeltSystem[];
    },
  });
}

/** "Belt" for a ranked system, "Level" for a beltless one (tai chi). */
export function rankNoun(system: BeltSystem | undefined | null) {
  return system && system.uses_belts === false ? "Level" : "Belt";
}


export function useBeltRanks() {
  return useQuery({
    queryKey: ["belt-ranks"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Sorted by the *system's* sort_order first, then the rank's. Ranks in
      // different systems share sort_order values, so ordering on the rank alone
      // is nondeterministic and any list rendered from it can reshuffle between
      // runs — which is exactly how a CSV import picked a different system twice.
      const { data, error } = await supabase
        .from("belt_ranks")
        .select(
          "id, system_id, name, short_name, pattern, color_primary, color_accent, curriculum_tier, sort_order, active, belt_systems(sort_order)",
        );
      if (error) throw error;
      const rows = (data ?? []) as (BeltRank & {
        belt_systems: { sort_order: number } | null;
      })[];
      return rows
        .slice()
        .sort(
          (a, b) =>
            (a.belt_systems?.sort_order ?? 0) - (b.belt_systems?.sort_order ?? 0) ||
            a.sort_order - b.sort_order ||
            a.name.localeCompare(b.name),
        )
        .map(({ belt_systems: _system, ...rank }) => rank as BeltRank);
    },

  });
}


/** Ranks of one system, in order. */
export function ranksOfSystem(ranks: BeltRank[] | undefined, systemId: string | undefined) {
  if (!ranks || !systemId) return [];
  return ranks
    .filter((r) => r.system_id === systemId && r.active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Progress is always computed inside the student's own system — a camo student
 * is 3 of 7 through the camo ladder, never a fraction of the solid one.
 */
export type BeltProgress = {
  label: string;
  step: number;
  total: number;
  pct: number;
  ladder: BeltRank[];
  currentIndex: number;
};

const PROGRESS_LABELS: Record<string, string> = {
  solid: "Road to Black Belt",
  camo: "Camo Belt Progress",
  youth_stripe: "White Belt Progress",
};

export function computeBeltProgress(
  system: BeltSystem | undefined,
  ranks: BeltRank[] | undefined,
  rankId: string | null | undefined,
): BeltProgress | null {
  if (!system || !ranks || !rankId) return null;
  const ladder = ranksOfSystem(ranks, system.id);
  if (ladder.length === 0) return null;
  const currentIndex = ladder.findIndex((r) => r.id === rankId);
  if (currentIndex < 0) return null;
  const total = ladder.length;
  const step = currentIndex + 1;
  return {
    label: PROGRESS_LABELS[system.slug] ?? `${system.name} Progress`,
    step,
    total,
    pct: Math.round((currentIndex / (total - 1 || 1)) * 100),
    ladder,
    currentIndex,
  };
}

/** "Camo Purple · Camo Belt" */
export function rankWithSystem(rank: BeltRank | undefined, system: BeltSystem | undefined) {
  if (!rank) return "Unassigned rank";
  return system ? `${rank.name} · ${system.name}` : rank.name;
}
