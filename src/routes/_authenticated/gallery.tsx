import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, ExternalLink, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { count } from "@/lib/plural";
import { coverSrc, useCoverUrls } from "@/lib/album-covers";
import { CardGridSkeleton } from "@/components/skeletons";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { QueryErrorState } from "@/components/query-error";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({
    meta: [
      { title: "Media Gallery — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content: "Tournament photos, belt ceremonies and school event albums from Tiger's Den Martial Arts & Fitness.",
      },
    ],
  }),
  component: Gallery,
});

type Album = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  external_url: string;
  cover_image_url: string | null;
  sort_order: number;
};

function Gallery() {
  const albumsQ = useQuery({
    queryKey: ["gallery-albums"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_albums")
        .select("id, title, description, event_date, external_url, cover_image_url, sort_order")
        .eq("active", true)
        .order("sort_order")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Album[];
    },
  });
  const albums = albumsQ.data ?? [];
  const showSkeleton = useDelayedLoading(albumsQ.isLoading);
  const coversQ = useCoverUrls(albums.map((a) => a.cover_image_url));


  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-primary">Captured moments</div>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Media <span className="text-gradient-red">Gallery</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Photo albums from tournaments, belt ceremonies and school events. Albums open in the hosted
            gallery where you can view and download full-resolution images.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Camera className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <div className="font-display text-lg font-bold leading-none">{albums.length}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              {albums.length === 1 ? "Album" : "Albums"}
            </div>
          </div>
        </div>
      </header>

      {showSkeleton && <CardGridSkeleton label="Loading albums" />}

      {albumsQ.isError && (
        <QueryErrorState className="mt-8" what="the photo albums" onRetry={() => albumsQ.refetch()} />
      )}

      {!showSkeleton && !albumsQ.isLoading && !albumsQ.isError && albums.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-bold uppercase">No albums published yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tiger's Den staff are still uploading photos from recent events. Check back after the next
            tournament or belt ceremony.
          </p>
        </div>
      )}

      {albums.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => {
            // A link-less album stores '' (the column is NOT NULL), so the
            // "coming soon" state must key off empty string as well as null.
            const hasLink = !!a.external_url?.trim();
            const cover = coverSrc(a.cover_image_url, coversQ.data);
            const body = (
              <>
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
                  {cover ? (
                    <img
                      src={cover}
                      alt={`Cover photo for the ${a.title} album`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 grid place-items-center"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.62 0.24 25 / 0.35), oklch(0.18 0.006 260) 60%, oklch(0.1 0 0))",
                      }}
                    >
                      <ImageIcon className="h-10 w-10 text-white/50" strokeWidth={1} aria-hidden="true" />
                      <span className="sr-only">No cover photo for the {a.title} album</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-base font-bold uppercase tracking-wide">{a.title}</h2>
                    {hasLink && <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                  </div>
                  {a.event_date && (
                    <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                      {new Date(`${a.event_date}T12:00:00`).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  )}
                  {a.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
                  )}
                  {!hasLink && (
                    <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                      Photos coming soon
                    </p>
                  )}
                </div>
              </>
            );

            return hasLink ? (
              <a
                key={a.id}
                href={a.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {body}
              </a>
            ) : (
              <div key={a.id} className="group overflow-hidden rounded-2xl border border-border bg-card">
                {body}
              </div>
            );
          })}
        </div>
      )}

      {albums.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          Showing {count(albums.length, "album")}. Photos of your student appear only if your family has
          opted in to photo and video sharing in Account Settings.
        </p>
      )}
    </div>
  );
}
