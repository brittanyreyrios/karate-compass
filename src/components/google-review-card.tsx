import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_REVIEW_URL_KEY, isUsableUrl, useAppSetting } from "@/lib/app-settings";

/**
 * A Google review ask, shown once per family until they dismiss it.
 *
 * Deliberately NON-INCENTIVIZED: no points, no discount, no free class, and no
 * "leave us 5 stars". Google's policy forbids review gating and incentives, and
 * a school risks having its whole review history wiped for it — so the copy asks
 * for an honest review and nothing else. Do not add a reward here.
 *
 * Dismissal is stored per profile in the database, not in localStorage, so it
 * follows the parent across their phone and the front-desk iPad.
 */
export function GoogleReviewCard({ profileId }: { profileId: string | null | undefined }) {
  const qc = useQueryClient();
  const urlQ = useAppSetting(GOOGLE_REVIEW_URL_KEY);

  const dismissedQ = useQuery({
    queryKey: ["review-dismissed", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_prompt_dismissals")
        .select("profile_id")
        .eq("profile_id", profileId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("review_prompt_dismissals")
        .upsert({ profile_id: profileId! }, { onConflict: "profile_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-dismissed", profileId] }),
  });

  const url = urlQ.data;
  // Nothing renders until we know the link is real AND the family has not
  // already dismissed it — no flash of a card that is about to disappear.
  if (!isUsableUrl(url) || dismissedQ.isLoading || dismissedQ.data !== false) return null;

  return (
    <section className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss review request"
        className="absolute right-2 top-2 h-9 w-9 text-muted-foreground hover:text-foreground"
        onClick={() => dismiss.mutate()}
        disabled={dismiss.isPending}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="flex flex-wrap items-center gap-5 pr-10">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"
          aria-hidden="true"
        >
          <Star className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">
            Enjoying Tiger's Den?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            An honest Google review helps other local families find us. Whatever you write is
            entirely up to you — there is no reward for leaving one, and none for the rating you
            give.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <a href={url!} target="_blank" rel="noreferrer">
            Write a review <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  );
}
