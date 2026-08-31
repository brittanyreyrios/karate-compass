import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter, type AnyRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteShellSkeleton } from "@/components/skeletons";
import { getCspNonce } from "@/lib/csp-nonce";
import { handleMaybeSessionLoss, isSessionLossError } from "@/lib/session-loss";

export const getRouter = () => {
  /*
    App-wide session-loss handling lives here, on the cache, deliberately: every
    authenticated page reads through this one QueryClient, so a page that isn't written
    yet is covered too. A per-page patch would leave every other page silently broken.
    The route-level beforeLoad gate in _authenticated/route.tsx is untouched — it still
    covers cold navigations; this covers a session dying under a mounted page.
  */
  let routerRef: AnyRouter | undefined;

  const redirectToAuth = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    /*
      Only bail out if the parent is already looking at the expired-session notice.
      Bailing on "/auth" alone was wrong: the root SIGNED_OUT listener can invalidate the
      router first, so the beforeLoad gate lands the parent on a bare /auth and the
      explanation never appears.
    */
    const here = new URL(window.location.href);
    if (here.pathname === "/auth" && here.searchParams.get("expired") === "1") return;
    try {
      await queryClient.cancelQueries();
    } catch {
      /* nothing to cancel is fine */
    }
    queryClient.clear();
    try {
      // scope: 'local' — a global sign-out calls the server, and on an already-dead
      // session that can reject or hang. The redirect must not depend on it.
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("Local sign-out after session loss failed (redirecting anyway)", error);
    }
    // Unconditional: runs even if the sign-out above threw.
    if (routerRef) {
      routerRef.navigate({ to: "/auth", search: { expired: "1" }, replace: true });
    } else {
      window.location.replace("/auth?expired=1");
    }
  };

  const onCacheError = (error: unknown) => {
    void handleMaybeSessionLoss(error, redirectToAuth);
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: onCacheError }),
    mutationCache: new MutationCache({ onError: onCacheError }),
    defaultOptions: {
      queries: {
        /*
          QueryCache.onError only fires once retries are exhausted, so on React Query's
          defaults a dead session would leave a broken page up for several seconds of
          backoff. Session-loss shapes short-circuit; genuine network errors keep the
          normal 3 retries because those often do recover.
        */
        retry: (failureCount, error) => !isSessionLossError(error) && failureCount < 3,
      },
      mutations: {
        retry: false,
      },
    },
  });
  // Stamps the SSR inline scripts with this request's nonce so the strict
  // script-src on the published host still allows hydration.
  const nonce = getCspNonce();

  const router = createRouter({
    routeTree,
    ...(nonce ? { ssr: { nonce } } : {}),
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    /*
      Route transitions and the client-only authenticated subtree used to show
      nothing at all: on a phone over gym wifi that reads as a broken app. A
      page-shaped skeleton fills the gap, with the same two guards used by the
      query skeletons — wait 150ms so fast navigations don't flash, then hold for
      400ms so it never appears for a single frame.
    */
    defaultPendingComponent: RouteShellSkeleton,
    defaultPendingMs: 150,
    defaultPendingMinMs: 400,
  });

  routerRef = router;

  return router;
};
