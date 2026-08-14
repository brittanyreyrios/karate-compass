import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * School-wide settings that Britt can edit without a redeploy. Values are plain
 * text and readable by any signed-in user; only admins can write them (RLS).
 */
export const GOOGLE_REVIEW_URL_KEY = "google_review_url";

/**
 * BA: the portal's one public address, set by a human and never detected.
 *
 * `window.location.origin` is the address the admin's browser happens to be at,
 * not the school's address — a QR generated inside the editor baked a
 * Lovable-internal host into a printed poster and sent scanners to Lovable's own
 * sign-in screen. A QR is permanent, so the address it encodes must be a
 * deliberate, readable, human-set value. Ships absent on purpose.
 */
export const PUBLIC_SITE_URL_KEY = "public_site_url";

/**
 * Joins the configured public address to an app path. Trailing slashes are
 * trimmed so a value saved as `https://example.com/` cannot produce
 * `https://example.com//auth`.
 */
export function publicSiteUrl(base: string | null | undefined, path: string) {
  if (!isUsableUrl(base)) return "";
  return `${base!.trim().replace(/\/+$/, "")}${path}`;
}


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

