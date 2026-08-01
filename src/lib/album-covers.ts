import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Album cover photos live in the private `album-covers` bucket.
 *
 * The bucket is PRIVATE because this workspace blocks public buckets, so covers
 * are read through short-lived signed URLs by signed-in families only. Admins are
 * the only role that can upload, replace or delete an object.
 *
 * `gallery_albums.cover_image_url` therefore holds one of two things:
 *   - a bare storage object key ("<album-uuid>-<timestamp>.jpg") — uploaded cover
 *   - an absolute http(s) URL — the rare "already hosted elsewhere" fallback
 * Keys keep the album UUID prefix so they stay unguessable; never switch to a
 * slug or a sequential name.
 */
export const COVER_BUCKET = "album-covers";

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1200;

export function isExternalCover(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

export function isStoredCover(value: string | null | undefined): boolean {
  return !!value && !isExternalCover(value);
}

/** Signs every stored cover key in one round trip. External URLs pass through. */
export async function signCovers(values: (string | null | undefined)[]) {
  const keys = Array.from(new Set(values.filter(isStoredCover) as string[]));
  const map: Record<string, string> = {};
  if (keys.length > 0) {
    const { data, error } = await supabase.storage
      .from(COVER_BUCKET)
      .createSignedUrls(keys, 60 * 60);
    if (error) throw error;
    (data ?? []).forEach((row) => {
      if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
    });
  }
  return map;
}

export function useCoverUrls(values: (string | null | undefined)[]) {
  const keys = Array.from(new Set(values.filter(isStoredCover) as string[])).sort();
  return useQuery({
    queryKey: ["album-cover-urls", keys],
    enabled: keys.length > 0,
    // Signed URLs last an hour; refresh well before that.
    staleTime: 30 * 60 * 1000,
    queryFn: () => signCovers(keys),
  });
}

/** Resolves whatever is stored into something an <img src> can use. */
export function coverSrc(
  value: string | null | undefined,
  signed: Record<string, string> | undefined,
): string | null {
  if (!value) return null;
  if (isExternalCover(value)) return value;
  return signed?.[value] ?? null;
}

/** Plain-English rejection message, or null when the file is fine. */
export function validateCoverFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "That file isn't an image. Please choose a photo (JPG, PNG or WebP).";
  }
  if (file.size > MAX_COVER_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That photo is ${mb} MB — too large. Please choose one under 5 MB.`;
  }
  return null;
}

/** Canvas downscale to ~1200px on the long edge, re-encoded as JPEG. */
export async function downscaleImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  return blob ?? file;
}

/**
 * Uploads a new cover and returns its storage key. The caller is responsible for
 * saving the key on the album row and for removing the previous object.
 */
export async function uploadCover(albumId: string, file: File): Promise<string> {
  const body = await downscaleImage(file);
  const key = `${albumId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(key, body, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return key;
}

/**
 * Best-effort cleanup of a replaced/removed cover. Never throws: an orphaned file
 * is a smaller problem than a cover update that refuses to save.
 */
export async function deleteCoverObject(value: string | null | undefined) {
  if (!isStoredCover(value)) return;
  try {
    const { error } = await supabase.storage.from(COVER_BUCKET).remove([value as string]);
    if (error) console.warn("[album-covers] could not delete previous cover", value, error.message);
  } catch (e) {
    console.warn("[album-covers] could not delete previous cover", value, e);
  }
}
