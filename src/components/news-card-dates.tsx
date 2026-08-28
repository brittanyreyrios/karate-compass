import { Calendar, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateRange } from "@/lib/date-only";

/**
 * Round 34: the dashboard and the announcements page each hand-built their own
 * school-news date markup, and they had drifted twice — Round 25 fixed the same
 * labelling problem on both surfaces and they diverged again afterwards. The
 * layout rule now lives here, once, the way TournamentCard did in Round 26.
 *
 * The rule:
 *  - top row: tag (and the pin indicator) on the left, the EVENT date on the
 *    right — and nothing else ever goes in that slot. With no event_date the
 *    right side renders nothing and the row collapses.
 *  - the posted date is always the LAST line of the card, small and muted,
 *    prefixed "Posted".
 *
 * The posted date must never be promoted into the top-right: that was the old
 * dashboard behaviour and it is exactly why cards changed shape depending on
 * whether the post happened to have an event date.
 */
export function NewsCardTopRow({
  tag,
  eventDate,
  eventEndDate,
  pinned = false,
}: {
  tag: string | null;
  eventDate: string | null;
  eventEndDate: string | null;
  pinned?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/40 text-primary">
          {tag ?? "News"}
        </Badge>
        {pinned && (
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
            <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
          </span>
        )}
      </div>
      {eventDate && (
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-foreground">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          {formatDateRange(eventDate, eventEndDate)}
        </span>
      )}
    </div>
  );
}

export function NewsPostedLine({ createdAt }: { createdAt: string }) {
  return (
    <div className="mt-3 text-xs text-muted-foreground">
      Posted {new Date(createdAt).toLocaleDateString()}
    </div>
  );
}
