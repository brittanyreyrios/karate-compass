import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteShellSkeleton } from "@/components/skeletons";
import { getCspNonce } from "@/lib/csp-nonce";

export const getRouter = () => {
  const queryClient = new QueryClient();
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

  return router;
};
