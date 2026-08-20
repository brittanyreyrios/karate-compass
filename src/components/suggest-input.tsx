/**
 * Round 19 B — a free-text field with suggestions, built out of real controls.
 *
 * Deliberately NOT a <datalist>: a suggestion list that renders on one device
 * and silently shows nothing on another is worse than no suggestion list at all,
 * and this project's admin work happens on an iPad. Real <button> chips behave
 * visibly and identically everywhere, are keyboard operable, and — because the
 * field itself is just an <input> — typing a brand-new value is always allowed.
 *
 * Growth: the chip row wraps, and once there are more than SHOWN suggestions it
 * collapses to the first SHOWN with a "Show all (n)" toggle, so twenty-plus
 * values cannot push the rest of the form off a phone screen. The value the user
 * has already typed is always kept visible in the collapsed set, so a chip never
 * hides the current selection.
 */
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SHOWN = 6;

export function SuggestInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const current = value.trim().toLowerCase();

  const visible = useMemo(() => {
    if (expanded || suggestions.length <= SHOWN) return suggestions;
    const head = suggestions.slice(0, SHOWN);
    const selected = suggestions.find((s) => s.toLowerCase() === current);
    if (selected && !head.some((s) => s.toLowerCase() === current)) {
      return [...head.slice(0, SHOWN - 1), selected];
    }
    return head;
  }, [expanded, suggestions, current]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-11"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`${label} suggestions`}>
          {visible.map((s) => {
            const selected = s.toLowerCase() === current;
            return (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                className="h-11 px-3 text-xs"
                onClick={() => onChange(s)}
              >
                {s}
              </Button>
            );
          })}
          {suggestions.length > SHOWN && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 px-3 text-xs"
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show fewer" : `Show all (${suggestions.length})`}
            </Button>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {hint ?? "Tap a suggestion or type a new one."}
      </p>
    </div>
  );
}

/** Merge built-ins with saved values, de-duplicated case-insensitively (first casing wins). */
export function mergeSuggestions(builtIns: readonly string[], saved: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [...builtIns, ...saved]) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
