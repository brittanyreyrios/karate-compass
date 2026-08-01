import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraOff, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Families with photo display turned OFF — staff must not publish their student's media. */
export type ConsentOffProfile = {
  id: string;
  email: string;
  family_name: string | null;
  photo_consent_updated_at: string | null;
};

export function useConsentOffProfiles() {
  return useQuery({
    queryKey: ["admin-consent-off"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, family_name, photo_consent_updated_at")
        .eq("photo_consent", false)
        .order("photo_consent_updated_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as ConsentOffProfile[];
    },
  });
}

export type ConsentEvent = {
  id: string;
  profile_id: string;
  new_value: boolean;
  changed_at: string;
  acknowledged_at: string | null;
};

/** Unreviewed "turned consent OFF" events. Persists until a human acknowledges it. */
export function useUnacknowledgedConsentOff() {
  return useQuery({
    queryKey: ["admin-consent-events-unack"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_consent_events")
        .select("id, profile_id, new_value, changed_at, acknowledged_at")
        .is("acknowledged_at", null)
        .eq("new_value", false)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConsentEvent[];
    },
  });
}

export function useAcknowledgeConsentEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("photo_consent_events")
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: u.user?.id ?? null,
        })
        .eq("profile_id", profileId)
        .is("acknowledged_at", null)
        .eq("new_value", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked reviewed");
      qc.invalidateQueries({ queryKey: ["admin-consent-events-unack"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Point-of-use reminder (Section G4). Rendered at the top of tabs where staff
 * are about to publish imagery. Hidden entirely when nobody has consent off.
 */
export function PhotoConsentBanner({ onViewList }: { onViewList?: () => void }) {
  const offQ = useConsentOffProfiles();
  const n = offQ.data?.length ?? 0;
  if (offQ.isLoading || n === 0) return null;

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-400/60 bg-yellow-400/15 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-200" aria-hidden="true" />
        <p className="text-sm text-yellow-50">
          <span className="font-bold">
            {n} {n === 1 ? "family has" : "families have"} photo consent turned off.
          </span>{" "}
          Check the Parents tab before publishing photos.
        </p>
      </div>
      {onViewList && (
        <Button size="sm" variant="outline" className="border-yellow-400/60 text-yellow-50" onClick={onViewList}>
          View list
        </Button>
      )}
    </div>
  );
}

/** Small "no photos" marker for the attendance sheet (Section G6). */
export function NoPhotosMarker() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-400/20 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-yellow-100"
      title="Photo consent OFF — do not photograph this student"
    >
      <CameraOff className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Photo consent off — do not photograph</span>
      No photos
    </span>
  );
}

/** "Needs attention" item: unreviewed consent-off changes. */
export function ConsentAttentionItem({ onOpen }: { onOpen: () => void }) {
  const unackQ = useUnacknowledgedConsentOff();
  const n = unackQ.data?.length ?? 0;
  if (unackQ.isLoading) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
        n > 0
          ? "border-red-500/60 bg-red-500/15 hover:bg-red-500/25"
          : "border-border bg-background hover:border-primary/40"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <CameraOff className="h-4 w-4" aria-hidden="true" />
        Photo consent changes
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-widest ${
          n > 0 ? "bg-red-500/30 text-red-50" : "bg-secondary text-muted-foreground"
        }`}
      >
        {n > 0 ? `${n} new` : <><Check className="mr-1 inline h-3 w-3" aria-hidden="true" />All reviewed</>}
      </span>
    </button>
  );
}
