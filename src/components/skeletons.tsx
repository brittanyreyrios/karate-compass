import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading states are skeletons, not spinners: every data page below already has
 * a known shape, so we can hold that shape while the query resolves instead of
 * collapsing the page and then shoving it back open.
 *
 * `prefers-reduced-motion` is honoured centrally in styles.css — the shimmer is
 * disabled there rather than per component, so these wrappers stay dumb.
 *
 * Each block is wrapped in a live region marked aria-busy so screen readers
 * announce "loading" once, instead of reading a wall of empty boxes.
 */
function Loading({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Loading label="Loading your dashboard" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-10 w-full max-w-md" />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-3 h-3 w-2/3" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6">
            <Skeleton className="h-3 w-28" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function ListSkeleton({
  rows = 5,
  height = "h-16",
  label = "Loading",
}: {
  rows?: number;
  height?: string;
  label?: string;
}) {
  return (
    <Loading label={label} className="mt-6 space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`w-full rounded-xl ${height}`} />
      ))}
    </Loading>
  );
}

export function LeaderboardSkeleton() {
  return (
    <Loading label="Loading rankings" className="mt-6 space-y-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16 shrink-0" />
        </div>
      ))}
    </Loading>
  );
}

export function CardGridSkeleton({
  cards = 6,
  label = "Loading",
}: {
  cards?: number;
  label?: string;
}) {
  /* Must mirror the gallery album grid exactly (container query, not viewport),
     or the skeleton paints 3 columns at 1025-1279 and the content resolves to 2. */
  return (
    <Loading label={label} className="@container mt-6">
      <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function CalendarSkeleton() {
  return (
    <Loading label="Loading calendar" className="mt-6">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={`h-${i}`} className="h-4 w-full" />
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </Loading>
  );
}

export function CurriculumSkeleton() {
  return (
    <Loading label="Loading curriculum" className="mt-6 space-y-4">
      {[0, 1].map((group) => (
        <div key={group} className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

/**
 * Route-level pending state.
 *
 * Used as the router's `defaultPendingComponent`, so the first boot and every
 * route transition hold a page-shaped placeholder instead of collapsing to
 * white. It is deliberately generic — a title block plus a few cards — because
 * it has to stand in for any route, and deliberately a skeleton rather than a
 * spinner so it matches the per-query states around it.
 */
export function RouteShellSkeleton() {
  return (
    <Loading label="Loading page" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-3 h-3 w-full max-w-xl" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </Loading>
  );
}
