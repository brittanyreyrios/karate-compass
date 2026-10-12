import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deletePostImageObject,
  postImageSrc,
  uploadPostImage,
  usePostImageUrls,
  validatePostImageFile,
} from "@/lib/post-images";

/**
 * Parent-facing image for an announcement / poll / tournament card. Renders
 * nothing at all when there is no image, so imageless cards are unchanged.
 * Height is capped (max-h-80 = 320px) with object-contain on a muted backdrop,
 * so a tall portrait photo is letterboxed instead of pushing the card down.
 */
export function PostImage({
  value,
  alt,
  fallbackAlt,
  className = "",
}: {
  value: string | null | undefined;
  alt: string | null | undefined;
  fallbackAlt: string;
  className?: string;
}) {
  const signed = usePostImageUrls([value]);
  const src = postImageSrc(value, signed.data);
  if (!value || !src) return null;
  const altText = (alt ?? "").trim() || fallbackAlt;
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-secondary ${className}`}>
      <img
        src={src}
        alt={altText}
        loading="lazy"
        className="mx-auto block max-h-80 w-full object-contain"
        data-testid="post-image"
      />
    </div>
  );
}

/**
 * Admin picker, matching the gallery cover control: upload, preview, replace,
 * remove, plus an optional alt-text field. `rowId` prefixes the object key so it
 * stays unguessable. The parent form owns saving; this reports the new key and
 * deletes a replaced object only after `onChange` resolves.
 */
export function PostImagePicker({
  rowId,
  value,
  alt,
  onChange,
  onAltChange,
  fallbackAlt,
  idPrefix,
}: {
  rowId: string;
  value: string | null;
  alt: string;
  onChange: (next: string | null) => Promise<void> | void;
  onAltChange: (v: string) => void;
  fallbackAlt: string;
  idPrefix: string;
}) {
  const [busy, setBusy] = useState(false);
  const signed = usePostImageUrls([value]);
  const src = postImageSrc(value, signed.data);

  const replace = async (next: string | null) => {
    const previous = value;
    await onChange(next);
    if (previous && previous !== next) await deletePostImageObject(previous);
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validatePostImageFile(file);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const key = await uploadPostImage(rowId, file);
      await replace(key);
      toast.success("Image added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
          {src ? (
            <img src={src} alt={alt.trim() || fallbackAlt} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${idPrefix}-image`}>Image (optional)</Label>
          <Input
            id={`${idPrefix}-image`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = ""; }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {busy ? "Uploading…" : "JPG, PNG or WebP up to 5 MB. Large photos are resized automatically."}
          </p>
        </div>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void replace(null)
                .then(() => toast.success("Image removed."), (e: Error) => toast.error(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Remove image
          </Button>
        )}
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-alt`}>Image description (alt text)</Label>
        <Input
          id={`${idPrefix}-alt`}
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
          placeholder={`Leave blank to use "${fallbackAlt}"`}
          maxLength={300}
        />
      </div>
    </div>
  );
}

/**
 * Round 65 — backstop for create forms. The admin tabs unmount an inactive tab
 * (no forceMount), so leaving the tab or page really does lose the draft; only
 * then is its unsaved picture deleted. Callers clear `value` after a successful
 * save, so a saved picture is never touched. Tab close is best effort only.
 */
export function useDraftImageCleanup(value: string | null) {
  const ref = useRef<string | null>(value);
  ref.current = value;
  useEffect(() => {
    const onHide = () => { if (ref.current) void deletePostImageObject(ref.current); };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (ref.current) void deletePostImageObject(ref.current);
    };
  }, []);
}
