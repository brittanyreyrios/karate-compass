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

/** Round 58: per-child consent — any guardian OFF means no photos. Admin-only view. */
export type StudentPhotoConsent = {
  student_id: string;
  guardian_count: number;
  consent_off_count: number;
  no_photos: boolean;
  conflict: boolean;
};

export function useStudentPhotoConsent() {
  return useQuery({
    queryKey: ["admin-student-photo-consent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_photo_consent")
        .select("student_id, guardian_count, consent_off_count, no_photos, conflict");
      if (error) throw error;
      return (data ?? []) as StudentPhotoConsent[];
    },
  });
}

/** Per-child list staff can act on; disagreements are called out as conflicts. */
export function ChildConsentList({
  students,
  profiles,
  links,
}: {
  students: { id: string; first_name: string; last_name: string; active: boolean }[];
  profiles: { id: string; email: string; photo_consent: boolean }[];
  links: { student_id: string; profile_id: string; is_primary: boolean }[];
}) {
  const q = useStudentPhotoConsent();
  const rows = (q.data ?? [])
    .filter((c) => c.no_photos)
    .map((c) => ({ c, s: students.find((s) => s.id === c.student_id) }))
    .filter((r) => r.s && r.s.active)
    .sort((a, b) => Number(b.c.conflict) - Number(a.c.conflict));

  return (
    <section className="mt-4 rounded-xl border border-yellow-400/40 bg-yellow-400/5 p-4" aria-label="Children who must not be photographed">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
        <CameraOff className="h-4 w-4" aria-hidden="true" /> No photos — by child ({rows.length})
      </h3>
      {q.isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Every active child may be photographed.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map(({ c, s }) => (
            <li key={c.student_id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s!.first_name} {s!.last_name}</span>
                {c.conflict ? (
                  <span className="rounded-full border border-red-500/60 bg-red-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-red-50">
                    Guardians disagree — treat as NO photos
                  </span>
                ) : (
                  <NoPhotosMarker />
                )}
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {links
                  .filter((l) => l.student_id === c.student_id)
                  .map((l) => {
                    const p = profiles.find((x) => x.id === l.profile_id);
                    return (
                      <li key={l.profile_id} className="break-all">
                        {p?.email ?? "Unknown account"}
                        {l.is_primary ? " (main family)" : ""}: {p?.photo_consent ? "photos OK" : "NO photos"}
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
