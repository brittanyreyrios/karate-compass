import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the Supabase session.
 *
 * Stability notes (this hook used to cause a render loop):
 *  - state is only updated when the access token actually changes, so the
 *    hourly TOKEN_REFRESHED / INITIAL_SESSION events don't churn consumers;
 *  - `loading` stays true until the very first session resolution, so
 *    protected UI never renders against an unverified session.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const apply = (next: Session | null) => {
      if (!mounted) return;
      setSession((prev) => {
        if (prev?.access_token === next?.access_token && prev?.user?.id === next?.user?.id) {
          return prev;
        }
        return next;
      });
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    supabase.auth.getSession().then(({ data }) => apply(data.session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, isLoading: loading, user: session?.user ?? null };
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });
}
