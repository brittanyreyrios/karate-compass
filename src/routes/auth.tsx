import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Tiger's Den Martial Arts & Fitness" },
      { name: "description", content: "Parent portal sign in for Tiger's Den Martial Arts & Fitness." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return toast.error("An invite code is required to create an account.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          family_name: familyName || email.split("@")[0],
          invite_code: inviteCode.trim(),
        },
      },
    });
    setLoading(false);
    if (error) {
      return toast.error(
        /invite code/i.test(error.message)
          ? "That invite code is invalid, expired, or already used. Ask a Tiger's Den staff member for a new one."
          : error.message,
      );
    }
    toast.success("Account created! Check your email if confirmation is required.");
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

        <h1 className="mt-6 font-display text-2xl font-bold uppercase">Parent Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to track your family's progress.</p>

        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={signIn} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="email-in">Email</Label>
                <Input id="email-in" name="email" autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw-in">Password</Label>
                <Input id="pw-in" name="current-password" autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-red">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signUp} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="invite">Invite code</Label>
                <Input
                  id="invite"
                  name="invite-code"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="TIGER123"
                  aria-describedby="invite-help"
                  className="uppercase tracking-widest"
                />
                <p id="invite-help" className="mt-1 text-xs text-muted-foreground">
                  Required. Tiger's Den staff issue an invite code to each enrolled family.
                </p>
              </div>
              <div>
                <Label htmlFor="family">Family name</Label>
                <Input id="family" name="family-name" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Rodriguez" />
              </div>
              <div>
                <Label htmlFor="email-up">Email</Label>
                <Input id="email-up" name="email" autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw-up">Password</Label>
                <Input id="pw-up" name="new-password" autoComplete="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-red">
                {loading ? "Creating…" : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By signing up, you agree to our{" "}
                <Link
                  to="/privacy-policy"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <Link
            to="/privacy-policy"
            className="text-xs uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
