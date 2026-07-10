import { Lock, Sparkles, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import type { ReactNode } from "react";

export function PremiumGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { isPremium, loading } = useSubscription();

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (isPremium) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-gradient-hero p-10 text-center shadow-elevated">
        <div className="absolute -right-10 -top-10 opacity-10">
          <Flame className="h-48 w-48" strokeWidth={1.5} />
        </div>
        <div className="relative">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-red shadow-red-glow">
            <Lock className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-3 w-3" /> Premium Feature
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            {feature} is a <span className="text-gradient-red">Premium</span> perk
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Upgrade your Tiger's Den family account to unlock leaderboards, live news feeds and
            more community features.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Button className="bg-gradient-red px-8 shadow-red-glow" size="lg">
              Upgrade to Premium
            </Button>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Ask a Tiger's Den admin to enable premium on your account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
