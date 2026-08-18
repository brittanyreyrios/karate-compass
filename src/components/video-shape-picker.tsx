import { Label } from "@/components/ui/label";
import type { VideoOrientation } from "@/lib/youtube";

/**
 * Staff tell us the shape; we never guess it. YouTube's API is not called from
 * the browser here, and a wrong guess letterboxes or crops a video for every
 * family, so this is an explicit two-option choice with a safe default.
 */
export function VideoShapePicker({
  id,
  value,
  onChange,
  label = "Video shape",
}: {
  id: string;
  value: VideoOrientation | null;
  onChange: (value: VideoOrientation | null) => void;
  label?: string;
}) {
  const options: { key: VideoOrientation; text: string }[] = [
    { key: "landscape", text: "Landscape (wide)" },
    { key: "portrait", text: "Portrait (tall, filmed on a phone)" },
  ];

  return (
    <div>
      <Label htmlFor={`${id}-landscape`} className="text-xs">
        {label}
      </Label>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.key || (value === null && o.key === "landscape");
          return (
            <button
              key={o.key}
              id={`${id}-${o.key}`}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
