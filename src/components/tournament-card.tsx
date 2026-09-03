import { Link } from "@tanstack/react-router";
import { Calendar, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DisciplineTags } from "@/components/discipline-tags";
import { disciplinesOf } from "@/lib/calendar-data";
import { daysUntilDateOnly, formatDateOnly, formatDateRange } from "@/lib/date-only";
import type { Tournament } from "@/lib/announcements";
import { ScheduledBadge } from "@/components/scheduled-badge";
import { isScheduled } from "@/lib/schedule-time";
import { useShowScheduledMarker } from "@/lib/scheduled-announcements";

/**
 * The ONE tournament card. Rendered by both the dashboard (condensed) and the
 * announcements page (full) so the two surfaces cannot drift apart again.
 *
 * "full"     — body, divisions / register-by / spectator info.
 * "condensed" — badge, days counter, title, location, dates, official link,
 *               plus a small pointer footnote to the announcements page.
 */
export function TournamentCard({
  tournament: t,
  variant,
}: {
  tournament: Tournament;
  variant: "full" | "condensed";
}) {
  const days = t.event_date ? daysUntilDateOnly(t.event_date) : null;
  /**
   * Round 52: one check for BOTH sources. useTournaments() returns publish_at
   * uniformly from the announcements branch and the events branch, so the
   * marker cannot cover one path and miss the other.
   */
  const showScheduled = useShowScheduledMarker();
  const tags = disciplinesOf(t);

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-4 grid h-6 w-6 place-items-center rounded-full border-2 border-primary bg-background shadow-red-glow">
        <span className="h-2 w-2 rounded-full bg-primary" />
      </span>
      <article className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/60">
        <div className="flex items-center justify-between gap-2">
          {/* Untagged tournaments keep the neutral "Event" badge so the
              row still has something beside the days counter. */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <DisciplineTags disciplines={tags} />
            </div>
          ) : (
            <Badge className="bg-foreground/10 text-foreground hover:bg-foreground/15">Event</Badge>
          )}
          {days !== null && (
            <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">
              {days} days
            </span>
          )}
        </div>
        {showScheduled && isScheduled(t.publish_at) && (
          <div className="mt-3">
            <ScheduledBadge publishAt={t.publish_at!} />
          </div>
        )}
        <h3 className="mt-3 font-display text-lg font-bold uppercase leading-tight">{t.title}</h3>
        {variant === "full" && (
          <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(t.venue || t.address || t.location) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />{" "}
              {[t.venue, t.address].filter(Boolean).join(" · ") || t.location}
            </span>
          )}
          {t.event_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />{" "}
              {formatDateRange(t.event_date, t.event_end_date)}
            </span>
          )}
        </div>
        {variant === "full" && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {t.divisions && (
              <p>
                <span className="font-semibold text-foreground">Divisions:</span> {t.divisions}
              </p>
            )}
            {t.registration_deadline && (
              <p>
                <span className="font-semibold text-foreground">Register by:</span>{" "}
                {formatDateOnly(t.registration_deadline)}
              </p>
            )}
            {t.spectator_info && <p>{t.spectator_info}</p>}
          </div>
        )}
        {t.event_url && (
          <a
            href={t.event_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Official event page <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
        {variant === "condensed" && (
          <p className="mt-4 text-xs italic text-muted-foreground">
            <Link to="/announcements" className="hover:underline">
              More details in Announcements
            </Link>
          </p>
        )}
      </article>
    </li>
  );
}
