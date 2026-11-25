/**
 * The shared technique library.
 *
 * Deliberately NOT part of `curriculum_items`: that table feeds the karate belt
 * entitlement boundary. Everything here lives in `technique_library` and reaches
 * the browser only through `get_technique_library()`. Active members receive
 * all published techniques regardless of enrollment; drafts only reach admins.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";

export type TechniqueItem = {
  id: string;
  program_id: string;
  program_name: string;
  /** Technique label — display and filtering only. */
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

/**
 * Starter positions. The admin form treats these as suggestions only: they are
 * merged with the distinct category values already saved, and staff can type any
 * new value — the column is free text and nothing in the database restricts it.
 */

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
  const { user, loading } = useSession();
  return useQuery({
    queryKey: ["technique-library", user?.id],
    enabled: !loading && Boolean(user),
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
