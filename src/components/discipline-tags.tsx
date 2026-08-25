import {
  CHIP_BASE,
  DISCIPLINES,
  DISCIPLINE_META,
  disciplineBadge,
  isKnownDiscipline,
} from "@/lib/calendar-data";

/**
 * Read-only discipline chips. Every chip carries its text label, so colour is
 * never the only signal. A value outside DISCIPLINES still renders, in a
 * neutral chip, rather than vanishing — a typo should be visible.
 */
export function DisciplineTags({ disciplines, className }: { disciplines: string[]; className?: string }) {
  if (disciplines.length === 0) return null;
  return (
    <>
      {disciplines.map((d) => (
        <span key={d} className={`${CHIP_BASE} ${disciplineBadge(d)} ${className ?? ""}`}>
          {isKnownDiscipline(d) ? DISCIPLINE_META[d].label : d}
        </span>
      ))}
    </>
  );
}

/**
 * The one discipline multi-select, shared by the events form and both tournament
 * forms, so those three editors can never disagree about the same row.
 *
 * No selection is a valid, normal state — school closures and "After School
 * Program Starts" are not discipline-specific. Any stored value outside the four
 * is shown as an extra, already-selected chip and is preserved on save.
 */
export function DisciplinePicker({
  value,
  onChange,
  idPrefix,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const unknown = value.filter((v) => !isKnownDiscipline(v));
  const toggle = (d: string) =>
    onChange(value.includes(d) ? value.filter((v) => v !== d) : [...value, d]);

  return (
    <div>
      <span className="text-sm font-medium">Disciplines</span>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Optional. Leave all off for anything that isn&apos;t discipline-specific.
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Disciplines">
        {DISCIPLINES.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              id={`${idPrefix}-discipline-${d.replace(/\s+/g, "-").toLowerCase()}`}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(d)}
              className={`min-h-11 rounded-md border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                on
                  ? DISCIPLINE_META[d].badge
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {on ? "✓ " : ""}
              {DISCIPLINE_META[d].label}
            </button>
          );
        })}
        {unknown.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed
            onClick={() => toggle(d)}
            className={`min-h-11 rounded-md border border-ev-other-line bg-ev-other px-3 text-sm font-semibold text-ev-other-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            ✓ {d}
          </button>
        ))}
      </div>
    </div>
  );
}
