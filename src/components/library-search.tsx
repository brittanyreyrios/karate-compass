/**
 * Round 19 C/D — one search field, shared by /techniques and /curriculum.
 *
 * It only ever filters rows the browser already holds. Entitlement is decided in
 * SQL before anything reaches here, and search must never become a second place
 * where visibility is decided, so there is no query, no RPC and no argument that
 * could widen what a family can see.
 *
 * Accessibility: a real associated label (visually hidden), type="search", a
 * 44px target, the theme's focus ring, and a polite live region for the count so
 * a screen reader hears the result total change as the term is typed.
 */
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LibrarySearch({
  id,
  label,
  placeholder,
  value,
  onChange,
  status,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  status: string;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          inputMode="search"
          autoComplete="off"
          className="h-11 pl-9 pr-11"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value !== "" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-11 w-11"
            aria-label="Clear search"
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <p aria-live="polite" className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {status}
      </p>
    </div>
  );
}

/** Case-insensitive, whitespace-tolerant match across the given fields. */
export function matchesTerm(term: string, fields: (string | null | undefined)[]) {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}
