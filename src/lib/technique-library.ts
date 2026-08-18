/**
 * Round 13 AU — the jiu jitsu / wrestling technique library.
 *
 * Deliberately NOT part of `curriculum_items`: that table feeds the karate belt
 * entitlement boundary. Everything here lives in `technique_library` and reaches
 * the browser only through `get_technique_library()`, which resolves the parent
 * from auth.uid() and decides entitlement in SQL — a family never receives an
 * item it is not entitled to, and drafts only ever reach admins.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TechniqueItem = {
  id: string;
  program_id: string;
  program_name: string;
  /** "Jiu Jitsu" or "Wrestling" — display and filtering only. */
  label: string;
  title: string;
  category: string;
  /** A label, never a lock. */
  difficulty: string | null;
  notes: string | null;
  sort_order: number;
  published: boolean;
  video_youtube_id: string | null;
  video_title: string | null;
  video_seconds: number | null;
  video_orientation: "landscape" | "portrait" | null;
};

/** Suggested positions — free text in the database, so staff can add more. */
export const TECHNIQUE_CATEGORIES = [
  "Guard",
  "Mount",
  "Escapes",
  "Takedowns",
  "Submissions",
  "Pins",
] as const;

export const TECHNIQUE_LABELS = ["Jiu Jitsu", "Wrestling"] as const;

export const TECHNIQUE_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function useTechniqueLibrary() {
  return useQuery({
    queryKey: ["technique-library"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_technique_library");
      if (error) throw error;
      return (data ?? []) as TechniqueItem[];
    },
  });
}

/** Group in the order the server returned (category, sort_order, title). */
export function groupByCategory(items: TechniqueItem[]) {
  const groups: { category: string; items: TechniqueItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }
  return groups;
}
