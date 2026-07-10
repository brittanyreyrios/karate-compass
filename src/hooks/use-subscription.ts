import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "./use-auth";

export type SubscriptionStatus = "free" | "premium";

export function useSubscription() {
  const { user, loading: sessionLoading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id);

  const profileQ = useQuery({
    queryKey: ["profile-subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user!.id)
        .maybeSingle();
      return (data?.subscription_status ?? "free") as SubscriptionStatus;
    },
  });

  const status: SubscriptionStatus = profileQ.data ?? "free";
  const isPremium = isAdmin === true || status === "premium";
  const loading = sessionLoading || adminLoading || profileQ.isLoading;

  return { status, isPremium, isAdmin: !!isAdmin, loading };
}
