import { useState } from "react";
import { Play } from "lucide-react";
import {
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
  formatRuntime,
  youTubeEmbedSrc,
  youTubeThumbnail,
  youTubeThumbnailSrcSet,
} from "@/lib/youtube";

/**
 * Click-to-load facade. Until a family actually presses play, the only thing
 * requested from Google is the thumbnail image — no player script, no iframe,
 * no cookies. On press we swap in a single autoplaying no-cookie embed.
 *
 * It is a real <button>, so keyboard, Enter/Space and focus rings come for free.
 */
export function VideoFacade({
  videoId,
  technique,
  videoTitle,
  videoSeconds,
  variant = "inset",
}: {
  videoId: string;
  technique: string;
  videoTitle?: string | null;
  videoSeconds?: number | null;
  /**
   * "cover" is the library layout: the thumbnail IS the top of the card, full
   * width, with no border or margin of its own — the single biggest reduction in
   * nested outlines on the curriculum page.
   */
  variant?: "inset" | "cover";
}) {
  const [playing, setPlaying] = useState(false);
  const runtime = formatRuntime(videoSeconds);
  const frame =
    variant === "cover"
      ? "block aspect-video w-full overflow-hidden rounded-xl bg-black"
      : "block aspect-video w-full overflow-hidden rounded-lg border border-border bg-black mt-3";

  if (playing) {
    return (
      <div className={frame}>
        <iframe
          src={youTubeEmbedSrc(videoId)}
          title={videoTitle?.trim() || technique}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${technique}`}
      className={`group relative ${frame} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      <img
        src={youTubeThumbnail(videoId)}
        srcSet={youTubeThumbnailSrcSet(videoId)}
        sizes="(max-width: 640px) 100vw, 480px"
        width={THUMBNAIL_WIDTH}
        height={THUMBNAIL_HEIGHT}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
      />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/90 shadow-red-glow transition-transform group-hover:scale-110">
          <Play className="h-5 w-5 translate-x-[1px] text-primary-foreground" aria-hidden="true" />
        </span>
      </span>
      {runtime && (
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white">
          {runtime}
        </span>
      )}
      {videoTitle?.trim() && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pb-6 pt-6 text-left text-xs font-semibold text-white">
          {videoTitle}
        </span>
      )}
    </button>
  );
}
