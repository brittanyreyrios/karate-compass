import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { MailCheck, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MEDIA_RELEASE_VERSION } from "@/routes/media-release";

const searchSchema = z.object({
  invite: z.string().trim().max(64).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content: "Parent portal sign in and account creation for Tiger's Den Martial Arts & Fitness.",
      },
      { property: "og:title", content: "Parent Portal Sign In — Tiger's Den Martial Arts & Fitness" },
      {
        property: "og:description",
        content: "Track belt progress, attendance and Dojo Points for your family.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type InviteState = "idle" | "checking" | "valid" | "invalid";

function AuthPage() {
  const navigate = useNavigate();
  const { invite: invitedCode } = Route.useSearch();

  const [tab, setTab] = useState<"signin" | "signup">(invitedCode ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState(invitedCode?.toUpperCase() ?? "");
  const [inviteState, setInviteState] = useState<InviteState>("idle");
  const [consent, setConsent] = useState(false);
  // Pre-selected ON, shown to the parent on the form (Section F2). Optional.
  const [photoConsent, setPhotoConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Debounced invite-code pre-check so families learn the code is wrong before
  // filling in the whole form.
  useEffect(() => {
    const clean = inviteCode.trim();
    if (clean.length < 4) {
      setInviteState("idle");
      return;
    }
    setInviteState("checking");
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("check_invite_code", { _code: clean });
      if (error) return setInviteState("idle");
      setInviteState(data ? "valid" : "invalid");
    }, 450);
    return () => clearTimeout(t);
  }, [inviteCode]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      return toast.error(
        /invalid login credentials/i.test(error.message)
          ? "That email and password don't match an account. Check your spelling or reset your password."
          : error.message,
      );
    }
    navigate({ to: "/" });
  };

  const forgotPassword = async () => {
    const target = email.trim();
    if (!target) return toast.error("Enter your email above first, then tap Forgot password.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setResetSentTo(target);
    toast.success("Reset link sent. Check your inbox.");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inviteCode.trim();
    if (!clean) return toast.error("An invite code is required to create an account.");
    if (inviteState === "invalid") {
      return toast.error("That invite code isn't valid. Ask a Tiger's Den staff member for a new one.");
    }
    if (!consent) {
      return toast.error(
        "Please accept the Terms of Service, Privacy Policy and Media Release to continue.",
      );
    }
    if (password.length < 8) return toast.error("Use a password of at least 8 characters.");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          family_name: familyName.trim() || email.split("@")[0],
          invite_code: clean,
          photo_consent: photoConsent,
          // The Media Release is now accepted by every new account (required checkbox),
          // independently of the display preference above.
          media_release_version: MEDIA_RELEASE_VERSION,
        },
      },
    });
    setLoading(false);

    if (error) {
      return toast.error(
        /invite code/i.test(error.message)
          ? "That invite code is invalid, expired, or already used. Ask a Tiger's Den staff member for a new one."
          : /already registered/i.test(error.message)
          ? "An account already exists for that email. Try signing in, or reset your password."
          : error.message,
      );
    }

    if (data.session) {
      toast.success("Welcome to the Tiger's Den Parent Portal!");
      return navigate({ to: "/" });
    }
    setAwaitingConfirm(email.trim());
  };

  const resendConfirmation = async () => {
    if (!awaitingConfirm) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: awaitingConfirm,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation email resent.");
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <div className="flex items-center gap-3">
          <img src="/tigers-den-logo.png" alt="" className="h-11 w-11 shrink-0 object-contain" />
          <div>
            <div className="font-display text-lg font-bold uppercase leading-none tracking-wider">
              Tiger's Den
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Martial Arts &amp; Fitness
            </div>
          </div>
        </div>

        {awaitingConfirm ? (
          <div className="mt-8">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <MailCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold uppercase">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-foreground">{awaitingConfirm}</span>. Click it to finish
              setting up your Parent Portal account — your students will be linked automatically.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Nothing after a few minutes? Check spam, or resend below.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" disabled={loading} onClick={resendConfirmation}>
                {loading ? "Sending…" : "Resend email"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAwaitingConfirm(null);
                  setTab("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold uppercase">Parent Portal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to track your family's progress.
            </p>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="email-in">Email</Label>
                    <Input
                      id="email-in"
                      name="email"
                      autoComplete="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pw-in">Password</Label>
                    <Input
                      id="pw-in"
                      name="current-password"
                      autoComplete="current-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-red">
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    onClick={forgotPassword}
                    disabled={loading}
                    className="w-full text-center text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Forgot password?
                  </button>
                  {resetSentTo && (
                    <p className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs text-muted-foreground">
                      A reset link is on its way to{" "}
                      <span className="font-semibold text-foreground">{resetSentTo}</span>. It expires
                      shortly, so use it soon.
                    </p>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="invite">Invite code</Label>
                    <div className="relative">
                      <Input
                        id="invite"
                        name="invite-code"
                        required
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="TIGER123"
                        aria-describedby="invite-help"
                        aria-invalid={inviteState === "invalid"}
                        className="pr-10 uppercase tracking-widest"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {inviteState === "checking" && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                        )}
                        {inviteState === "valid" && (
                          <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                        )}
                        {inviteState === "invalid" && <X className="h-4 w-4 text-red-400" aria-hidden="true" />}
                      </span>
                    </div>
                    <p
                      id="invite-help"
                      aria-live="polite"
                      className={`mt-1 text-xs ${
                        inviteState === "invalid"
                          ? "text-red-300"
                          : inviteState === "valid"
                          ? "text-emerald-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {inviteState === "valid"
                        ? "Code accepted — finish signing up below."
                        : inviteState === "invalid"
                        ? "That code is invalid, expired or fully used. Ask the front desk for a new one."
                        : invitedCode
                        ? "Code filled in from your invite link."
                        : "Required. Tiger's Den staff issue an invite code to each enrolled family."}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="family">Family name</Label>
                    <Input
                      id="family"
                      name="family-name"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="Rodriguez"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-up">Email</Label>
                    <Input
                      id="email-up"
                      name="email"
                      autoComplete="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use the email the school has on file so your students link automatically.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="pw-up">Password</Label>
                    <Input
                      id="pw-up"
                      name="new-password"
                      autoComplete="new-password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="tos"
                        checked={consent}
                        onCheckedChange={(v) => setConsent(v === true)}
                        aria-describedby="tos-desc"
                        className="mt-0.5"
                      />
                      <Label htmlFor="tos" id="tos-desc" className="text-xs font-normal leading-relaxed">
                        I am a parent or legal guardian and I agree to the{" "}
                        <Link to="/terms" className="font-semibold text-primary underline underline-offset-2">
                          Terms of Service
                        </Link>
                        ,{" "}
                        <Link
                          to="/privacy-policy"
                          className="font-semibold text-primary underline underline-offset-2"
                        >
                          Privacy Policy
                        </Link>{" "}
                        and{" "}
                        <Link
                          to="/media-release"
                          className="font-semibold text-primary underline underline-offset-2"
                        >
                          Photo &amp; Video Media Release
                        </Link>
                        . <span className="text-primary">Required</span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                      <Checkbox
                        id="photo"
                        checked={photoConsent}
                        onCheckedChange={(v) => setPhotoConsent(v === true)}
                        aria-describedby="photo-desc"
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="photo"
                        id="photo-desc"
                        className="text-sm font-normal leading-relaxed text-foreground"
                      >
                        <span className="font-semibold">
                          Yes — my student may appear in photos and videos in the Portal.
                        </span>{" "}
                        This includes group photos, class and sparring clips, and event albums shared with
                        enrolled Tiger&apos;s Den families. Uncheck this box if you&apos;d rather we
                        didn&apos;t. You can change it any time in Account Settings.
                      </Label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !consent || inviteState === "invalid"}
                    className="w-full bg-gradient-red"
                  >
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-4 border-t border-border pt-4">
          <Link
            to="/privacy-policy"
            className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Terms
          </Link>
          <Link
            to="/media-release"
            className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Media Release
          </Link>
        </div>
      </div>
    </div>
  );
}
