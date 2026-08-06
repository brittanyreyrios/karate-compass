import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * School-wide settings that Britt can edit without a redeploy. Values are plain
 * text and readable by any signed-in user; only admins can write them (RLS).
 */
export const GOOGLE_REVIEW_URL_KEY = "google_review_url";

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ["app-setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? null;
    },
  });
}

export function useSetAppSetting(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-setting", key] }),
  });
}

/**
 * Only a real, absolute http(s) link is ever surfaced to parents — a blank or
 * half-pasted setting must hide the card rather than render a dead button.
 */
export function isUsableUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
