import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Nothing here yet" and "this didn't load" are different facts, and a parent acts
 * differently on each — so a failed query must never render as an empty screen.
 *
 * Deliberately plain English: no raw error text, no stack trace, no table names and
 * no IDs. Nothing is logged, stored or sent anywhere — the route-level
 * errorComponent already reports genuine crashes.
 */
export function QueryErrorState({
  what = "this section",
  onRetry,
  className = "",
}: {
  /** Short, human phrase for what failed, e.g. "the leaderboard". */
  what?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center ${className}`}
    >
      <AlertTriangle
        className="mx-auto h-8 w-8 text-destructive"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        We couldn't load {what} just now. This is a connection problem, not missing
        information — your child's records are safe.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}
