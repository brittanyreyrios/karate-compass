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
 *
 * "Parses as a URL" is not enough: a placeholder such as
 * `…/writereview?placeid=` parses fine and points nowhere, which is exactly how
 * a fabricated value once reached every parent's dashboard. So a URL carrying an
 * empty query-parameter value is rejected too. Deliberately NOT a Google-URL
 * validator: the short `https://g.page/r/<id>/review` form has no query string
 * at all and must keep passing.
 */
export function isUsableUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (!u.hostname) return false;
    for (const [, v] of u.searchParams) {
      if (v.trim() === "") return false;
    }
    return true;
  } catch {
    return false;
  }
}

