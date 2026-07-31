import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

/** Shared chrome for the public legal pages (privacy, terms, media release). */
export function LegalHeader() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-red shadow-red-glow">
        <Flame className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span>
        <span className="block font-display text-lg font-bold uppercase leading-none tracking-wider">
          Tiger's Den
        </span>
        <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Martial Arts &amp; Fitness
        </span>
      </span>
    </Link>
  );
}

export function LegalSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide sm:text-2xl">
        <span className="text-primary">{n}.</span> {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalBullets({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function LegalFooterNav() {
  return (
    <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-6">
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Back to the Portal
      </Link>
      <Link
        to="/privacy-policy"
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Privacy Policy
      </Link>
      <Link
        to="/terms"
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Terms of Service
      </Link>
      <Link
        to="/media-release"
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Media Release
      </Link>
    </div>
  );
}

/** Contact block reused verbatim across all three legal documents. */
export const TIGERS_DEN_CONTACT = {
  name: "Tiger's Den Martial Arts & Fitness",
  address: "3383 Deke Slayton Hwy, League City, TX 77573",
  phone: "(281) 535-9500",
  email: "info@tigersdenmartialarts.com",
} as const;
