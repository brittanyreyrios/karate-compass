import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Image as ImageIcon, Trophy } from "lucide-react";
import { GALLERY } from "@/lib/mock-data";

const FILTERS = ["All", "Tournaments", "Belt Ceremonies", "Events"] as const;

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({
    meta: [
      { title: "Media Gallery — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Tournament photos, belt ceremonies and school event galleries." },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-primary">Captured moments</div>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Media <span className="text-gradient-red">Gallery</span>
          </h1>
        </div>
        <div className="hidden gap-4 sm:flex">
          <Stat icon={<Camera />} label="Photos" value="248" />
          <Stat icon={<Trophy />} label="Events" value="17" />
        </div>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all ${filter === f ? "border-primary bg-primary text-primary-foreground shadow-red-glow" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {GALLERY.map((g, i) => (
          <figure key={g.id} className={`group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card ${i % 5 === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}>
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110" style={{ background: `linear-gradient(${(i * 37) % 360}deg, oklch(0.62 0.24 25 / 0.4), oklch(0.18 0.006 260) 60%, oklch(0.1 0 0))` }} />
            <div className="absolute inset-0 grid place-items-center opacity-40"><ImageIcon className="h-10 w-10 text-white/60" strokeWidth={1} /></div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
              <div className="text-xs font-bold uppercase tracking-widest">{g.title}</div>
              <div className="mt-0.5 text-xs text-white/60">{g.date}</div>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div>
        <div className="font-display text-lg font-bold leading-none">{value}</div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
