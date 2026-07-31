import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content: "Choose a new password for your Tiger's Den Martial Arts & Fitness Parent Portal account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase delivers the recovery session either via the URL hash or via the
    // PASSWORD_RECOVERY auth event once the client has parsed that hash.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const looksLikeRecovery = /type=recovery/.test(hash);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (looksLikeRecovery && session)) {
        setHasRecovery(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && looksLikeRecovery) setHasRecovery(true);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    if (password !== confirm) return toast.error("Those passwords don't match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-red shadow-red-glow">
            <Flame className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <div className="font-display text-lg font-bold uppercase leading-none tracking-wider">
              Tiger's Den
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Martial Arts &amp; Fitness
            </div>
          </div>
        </div>

        <h1 className="mt-6 flex items-center gap-2 font-display text-2xl font-bold uppercase">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> New password
        </h1>

        {!ready && <p className="mt-3 text-sm text-muted-foreground">Checking your reset link…</p>}

        {ready && !hasRecovery && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This page needs a valid password-reset link. Request a fresh one from the sign-in page —
              reset links expire after a short while and can only be used once.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        )}

        {ready && hasRecovery && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a new password for your Parent Portal account.
            </p>
            <div>
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full bg-gradient-red">
              {saving ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
