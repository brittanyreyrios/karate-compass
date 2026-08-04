/**
 * Staff paste whatever the browser address bar gave them — that is usually a
 * `watch?v=` URL with `&list=…&index=…` still attached, sometimes a `youtu.be`
 * share link, sometimes a Short. All of those must resolve to the same 11-char
 * video ID, and anything else must fail loudly rather than save a broken embed.
 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeId(value: string): boolean {
  return ID_RE.test(value);
}

export function extractYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (isYouTubeId(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = parts[0] ?? null;
  } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
      candidate = parts[1] ?? null;
    } else {
      candidate = url.searchParams.get("v");
    }
  }

  return candidate && isYouTubeId(candidate) ? candidate : null;
}

export const YOUTUBE_LINK_ERROR =
  "That doesn't look like a YouTube link. Copy the address from your browser's address bar while the video is playing.";

/** Thumbnail served by YouTube's image CDN — the only request made before a click. */
export function youTubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youTubeEmbedSrc(id: string, autoplay = true): string {
  return `https://www.youtube-nocookie.com/embed/${id}${autoplay ? "?autoplay=1" : ""}`;
}

/** 95 → "1:35" */
export function formatRuntime(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
