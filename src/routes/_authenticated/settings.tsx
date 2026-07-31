import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, Save, Settings as SettingsIcon, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content: "Manage your family name, photo and video consent, and password for the Tiger's Den Parent Portal.",
      },
    ],
  }),
  component: SettingsPage,
});

type ProfileRow = {
  id: string;
  email: string;
  family_name: string;
  photo_consent: boolean;
  photo_consent_updated_at: string | null;
  media_release_version: string | null;
  media_release_accepted_at: string | null;
  subscription_status: string;
};

function SettingsPage() {
  const qc = useQueryClient();
  const { user, isLoading } = useSession();
  const [familyName, setFamilyName] = useState("");

  const profileQ = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, family_name, photo_consent, photo_consent_updated_at, media_release_version, media_release_accepted_at, subscription_status",
        )
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  useEffect(() => {
    if (profileQ.data) setFamilyName(profileQ.data.family_name ?? "");
  }, [profileQ.data]);

  const saveName = useMutation({
    mutationFn: async () => {
      const clean = familyName.trim();
      if (!clean) throw new Error("Family name cannot be empty.");
      if (clean.length > 80) throw new Error("Family name must be 80 characters or fewer.");
      const { error } = await supabase.from("profiles").update({ family_name: clean }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family name saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setConsent = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("profiles")
        .update({ photo_consent: next, photo_consent_updated_at: new Date().toISOString() })
        .eq("id", user!.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(next ? "Photo & video consent turned on" : "Photo & video consent turned off");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReset = useMutation({
    mutationFn: async () => {
      const email = profileQ.data?.email;
      if (!email) throw new Error("No email on file.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Password reset email sent. Check your inbox."),
    onError: (e: Error) => toast.error(e.message),
  });

  const p = profileQ.data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <SettingsIcon className="h-3 w-3" aria-hidden="true" /> Your account
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Account <span className="text-gradient-red">Settings</span>
        </h1>
      </header>

      {(isLoading || profileQ.isLoading) && (
        <p className="mt-8 text-sm text-muted-foreground">Loading your account…</p>
      )}

      {p && (
        <div className="mt-8 space-y-6">
          {/* Family */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold uppercase">Family details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your family name is what we greet you with on the dashboard.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="family-name">Family name</Label>
                <Input
                  id="family-name"
                  value={familyName}
                  maxLength={80}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="account-email">Email (sign-in)</Label>
                <Input id="account-email" value={p.email} readOnly disabled className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact the front desk to change the email on your account.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                className="bg-gradient-red"
                disabled={saveName.isPending || familyName.trim() === (p.family_name ?? "")}
                onClick={() => saveName.mutate()}
              >
                <Save className="mr-1 h-4 w-4" aria-hidden="true" />
                {saveName.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </section>

          {/* Photo consent */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold uppercase">Photo &amp; video consent</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Opt in to let us feature your student in the Media Gallery, announcements, our social
              accounts and printed school materials. You can switch this off at any time — see the{" "}
              <Link to="/media-release" className="font-semibold text-primary underline underline-offset-2">
                Media Release
              </Link>{" "}
              for exactly what changes when you do.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
              <div className="min-w-0">
                <Label htmlFor="photo-consent" className="text-base">
                  Share photos and video of my student
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.photo_consent ? "Currently ON" : "Currently OFF"}
                  {p.photo_consent_updated_at
                    ? ` · updated ${new Date(p.photo_consent_updated_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <Switch
                id="photo-consent"
                checked={p.photo_consent}
                disabled={setConsent.isPending}
                onCheckedChange={(v) => setConsent.mutate(v)}
                aria-label="Share photos and video of my student"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>Media release on file:</span>
              {p.media_release_version ? (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  v{p.media_release_version}
                  {p.media_release_accepted_at
                    ? ` · accepted ${new Date(p.media_release_accepted_at).toLocaleDateString()}`
                    : ""}
                </Badge>
              ) : (
                <Badge variant="outline">Not recorded</Badge>
              )}
            </div>
          </section>

          {/* Password */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold uppercase">Password</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email a secure reset link to {p.email}. The link expires shortly after it's sent.
            </p>
            <div className="mt-5">
              <Button variant="outline" disabled={sendReset.isPending} onClick={() => sendReset.mutate()}>
                {sendReset.isPending ? "Sending…" : "Email me a reset link"}
              </Button>
            </div>
          </section>

          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-widest text-muted-foreground">
            <Link to="/privacy-policy" className="underline-offset-4 hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
              Terms of Service
            </Link>
            <Link to="/media-release" className="underline-offset-4 hover:text-foreground hover:underline">
              Media Release
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
