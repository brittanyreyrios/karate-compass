import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { downscaleImage, isExternalCover, validateCoverFile } from "@/lib/album-covers";

/**
 * Round 59 — images on announcements and polls, in the PRIVATE `post-images`
 * bucket. A sibling of album-covers.ts, deliberately not a refactor of it: the
 * gallery's upload/sign/delete code keeps operating on its own bucket untouched.
 * Only the bucket-independent pure helpers are reused from that file.
 *
 * `announcements.image_url` / `polls.image_url` follow the
 * gallery_albums.cover_image_url convention exactly:
 *   - a bare storage object key ("<row-uuid>-<timestamp>.jpg") — uploaded image
 *   - an absolute http(s) URL — "already hosted elsewhere" fallback
 * Keys keep the row UUID prefix so they stay unguessable. That matters: the
 * bucket read policy lets ANY signed-in user sign any object in it, so for a
 * scheduled announcement the unguessable name is the only thing hiding its image
 * (RLS hides the row, not the file).
 *
 * The bucket has a 5 MB limit. Allowed MIME types are enforced here
 * (validatePostImageFile → jpeg/png/webp) and every upload is re-encoded to JPEG.
 */
export const POST_IMAGE_BUCKET = "post-images";

export const isExternalPostImage = isExternalCover;

export function isStoredPostImage(value: string | null | undefined): boolean {
  return !!value && !isExternalPostImage(value);
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Plain-English rejection message, or null when the file is fine. */
export function validatePostImageFile(file: File): string | null {
  if (file.type.startsWith("image/") && !ALLOWED.includes(file.type)) {
    return "Please choose a JPG, PNG or WebP photo.";
  }
  return validateCoverFile(file);
}

export async function signPostImages(values: (string | null | undefined)[]) {
  const keys = Array.from(new Set(values.filter(isStoredPostImage) as string[]));
  const map: Record<string, string> = {};
  if (keys.length > 0) {
    const { data, error } = await supabase.storage
      .from(POST_IMAGE_BUCKET)
      .createSignedUrls(keys, 60 * 60);
    if (error) throw error;
    (data ?? []).forEach((row) => {
      if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
    });
  }
  return map;
}

export function usePostImageUrls(values: (string | null | undefined)[]) {
  const keys = Array.from(new Set(values.filter(isStoredPostImage) as string[])).sort();
  return useQuery({
    queryKey: ["post-image-urls", keys],
    enabled: keys.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: () => signPostImages(keys),
  });
}

export function postImageSrc(
  value: string | null | undefined,
  signed: Record<string, string> | undefined,
): string | null {
  if (!value) return null;
  if (isExternalPostImage(value)) return value;
  return signed?.[value] ?? null;
}

/** Uploads and returns the storage key. Caller saves it and removes the previous one. */
export async function uploadPostImage(rowId: string, file: File): Promise<string> {
  const body = await downscaleImage(file);
  const key = `${rowId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(POST_IMAGE_BUCKET)
    .upload(key, body, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return key;
}

/** Best-effort cleanup of a replaced/removed image. Never throws. */
export async function deletePostImageObject(value: string | null | undefined) {
  if (!isStoredPostImage(value)) return;
  try {
    const { error } = await supabase.storage.from(POST_IMAGE_BUCKET).remove([value as string]);
    if (error) console.warn("[post-images] could not delete image", value, error.message);
  } catch (e) {
    console.warn("[post-images] could not delete image", value, e);
  }
}
