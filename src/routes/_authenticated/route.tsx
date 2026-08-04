import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RouteShellSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  // This subtree is client-only (ssr: false) and the session check is async, so
  // without an explicit pending state the very first paint is a white body under
  // the SSR'd header. 0ms here: on boot there is nothing to flash past.
  pendingMs: 0,
  pendingMinMs: 400,
  pendingComponent: RouteShellSkeleton,
  component: () => <Outlet />,
});
