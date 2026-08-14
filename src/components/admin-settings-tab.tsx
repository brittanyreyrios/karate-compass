import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GOOGLE_REVIEW_URL_KEY,
  PUBLIC_SITE_URL_KEY,
  isUsableUrl,
  useAppSetting,
  useSetAppSetting,
} from "@/lib/app-settings";

/**
 * School settings that must be real data rather than a hardcoded constant. The
 * review card on the parent dashboard stays hidden until a valid link is saved
 * here, so a blank setting can never ship a dead button to families.
 */
export function SchoolSettingsTab() {
  const urlQ = useAppSetting(GOOGLE_REVIEW_URL_KEY);
  const save = useSetAppSetting(GOOGLE_REVIEW_URL_KEY);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (urlQ.data !== undefined) setValue(urlQ.data ?? "");
  }, [urlQ.data]);

  const trimmed = value.trim();
  const valid = trimmed === "" || isUsableUrl(trimmed);


  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">
          Google Review Link
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Paste the school's Google review link. Parents see a dismissible card on their dashboard
          pointing at it. Leave it empty to hide that card for everyone.
        </p>

        <form
          className="mt-5 max-w-2xl space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            save.mutate(trimmed, {
              onSuccess: () =>
                toast.success(trimmed ? "Review link saved." : "Review card hidden."),
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save."),
            });
          }}
        >
          <Label htmlFor="google-review-url">Review URL</Label>
          <Input
            id="google-review-url"
            inputMode="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!valid}
            aria-describedby="google-review-url-help"
          />
          <p id="google-review-url-help" className="text-xs text-muted-foreground">
            {valid
              ? "Must start with https:// — the card is hidden while this is empty."
              : "That is not a valid link."}
          </p>
          <Button type="submit" disabled={!valid || save.isPending}>
            {save.isPending ? "Saving…" : "Save link"}
          </Button>
        </form>

        {isUsableUrl(urlQ.data) && (
          <p className="mt-4 text-xs text-muted-foreground">
            Currently live:{" "}
            <a
              href={urlQ.data!}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium text-primary hover:underline"
            >
              {urlQ.data}
            </a>
          </p>
        )}

        <p className="mt-6 rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
          The parent card asks for an honest review and never offers points, discounts or free
          classes for one — Google forbids incentivized and gated reviews, and schools have lost
          their entire review history over it.
        </p>
      </div>

      <PublicSiteUrlCard />
    </div>

  );
}
