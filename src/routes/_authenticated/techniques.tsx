import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoFacade } from "@/components/video-facade";
import { QueryErrorState } from "@/components/query-error";
import { LibrarySearch, matchesTerm } from "@/components/library-search";

import { count } from "@/lib/plural";
import {
  DIFFICULTY_LABELS,
  groupByCategory,
  useTechniqueLibrary,
  type TechniqueItem,
} from "@/lib/technique-library";

export const Route = createFileRoute("/_authenticated/techniques")({
  head: () => ({
    meta: [
      { title: "Technique Library — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "Jiu jitsu and wrestling technique videos for Tiger's Den families training in the grappling programme.",
      },
      { property: "og:title", content: "Technique Library — Tiger's Den Martial Arts & Fitness" },
      {
        property: "og:description",
        content: "Jiu jitsu and wrestling technique videos for Tiger's Den grappling families.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Techniques,
});

function Techniques() {
  const libraryQ = useTechniqueLibrary();
  const [label, setLabel] = useState<string>("all");
  const [term, setTerm] = useState("");

  const items = libraryQ.data ?? [];
  /** Published items only on the family view; drafts are flagged for admins. */
  const labels = useMemo(
    () => Array.from(new Set(items.map((i) => i.label))).sort(),
    [items],
  );
  /**
   * Chip and search compose: an item must satisfy both. Filtering happens here,
   * over rows get_technique_library() already returned — never in the database.
   */
  const shown = items.filter(
    (i) =>
      (label === "all" || i.label === label) &&
      matchesTerm(term, [i.title, i.category, i.label, i.notes, i.video_title]),
  );
  const groups = groupByCategory(shown);
  const searching = term.trim() !== "";

  if (libraryQ.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <QueryErrorState
          what="the technique library"
          onRetry={() => void libraryQ.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
          <Swords className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /> Technique Library
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jiu jitsu and wrestling techniques, grouped by position. Nothing loads from YouTube until
          you press play.
        </p>
      </header>

      {libraryQ.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading techniques…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          There are no techniques in your family's programme yet.
        </p>
      ) : (
        <>
          {/* Same rule the chips follow: don't render a control for nothing. */}
          <div className="mt-6 max-w-sm">
            <LibrarySearch
              id="technique-search"
              label="Search techniques"
              placeholder="Search techniques…"
              value={term}
              onChange={setTerm}
              status={count(shown.length, "technique")}
            />
          </div>

          {labels.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={label === "all" ? "default" : "outline"}
                size="sm"
                aria-pressed={label === "all"}
                onClick={() => setLabel("all")}
              >
                All
              </Button>
              {labels.map((l) => (
                <Button
                  key={l}
                  variant={label === l ? "default" : "outline"}
                  size="sm"
                  aria-pressed={label === l}
                  onClick={() => setLabel(l)}
                >
                  {l}
                </Button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              <p>
                No techniques match{searching ? ` “${term.trim()}”` : ""}
                {label !== "all" ? ` in ${label}` : ""}.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setTerm("");
                  setLabel("all");
                }}
              >
                Clear search and filters
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-10">
              {groups.map((g) => (
                <section key={g.category}>
                  <h2 className="font-display text-lg font-bold uppercase tracking-wide">
                    {g.category}
                  </h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((item) => (
                      <TechniqueCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}


function TechniqueCard({ item }: { item: TechniqueItem }) {
  return (
    <article className="min-w-0 rounded-xl border border-border bg-card p-3">
      {item.video_youtube_id ? (
        <VideoFacade
          videoId={item.video_youtube_id}
          technique={item.title}
          videoTitle={item.video_title}
          videoSeconds={item.video_seconds}
          orientation={item.video_orientation}
          variant="cover"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-xl bg-secondary text-xs text-muted-foreground">
          Video coming soon
        </div>
      )}
      <div className="mt-3">
        <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-border text-xs text-muted-foreground">
            {item.label}
          </Badge>
          {item.difficulty && (
            <Badge variant="outline" className="border-border text-xs text-muted-foreground">
              {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}
            </Badge>
          )}
          {!item.published && (
            <Badge variant="outline" className="border-primary/60 text-xs text-primary">
              Draft — staff only
            </Badge>
          )}
        </div>
        {item.notes && (
          <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{item.notes}</p>
        )}
      </div>
    </article>
  );
}
