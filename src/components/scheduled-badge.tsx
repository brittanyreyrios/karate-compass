import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatChicagoDateTime } from "@/lib/schedule-time";

/**
 * Round 45: the one copy of the "not public yet" marker.
 *
 * It lived inline in admin-announcements-manage.tsx and now has to appear on the
 * parent-facing dashboard and Announcements page too — for admins only — so it
 * lives here once rather than in three places that would drift.
 *
 * formatChicagoDateTime already appends the correct zone abbreviation and picks
 * CST/CDT by date; never hardcode a zone or reformat the timestamp here.
 * publish_at is a timestamptz, so nothing from date-only.ts is involved.
 */
export function ScheduledBadge({ publishAt }: { publishAt: string }) {
  return (
    <Badge className="border-amber-400/60 bg-amber-500/15 text-amber-200" variant="outline">
      <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" /> Scheduled ·{" "}
      {formatChicagoDateTime(publishAt)}
    </Badge>
  );
}
