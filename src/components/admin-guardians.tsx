import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isEmailWithTld } from "@/lib/email-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Round 58 — guardian links. ADMIN-ONLY component. Guardian identities appear on
 * staff screens only; no parent-facing surface may name a co-guardian.
 */
export type GuardianLink = {
  id: string;
  student_id: string;
  profile_id: string;
  is_primary: boolean;
};

type Profile = {
  id: string;
  email: string;
  family_name: string | null;
  photo_consent?: boolean;
  archived_at?: string | null;
};

/** Round 63: role rows, read under the existing "Admins can view all roles" policy. */
function useRoleRows() {
  return useQuery({
    queryKey: ["admin-guardian-role-rows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGuardianLinks() {
  return useQuery({
    queryKey: ["admin-guardian-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_guardians")
        .select("id, student_id, profile_id, is_primary");
      if (error) throw error;
      return (data ?? []) as GuardianLink[];
    },
  });
}

/** Round 66: emails waiting to be linked at signup. Admin-only table. */
type PendingLink = { id: string; student_id: string; email: string };
export function usePendingGuardianLinks() {
  return useQuery({
    queryKey: ["admin-pending-guardian-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_guardian_links")
        .select("id, student_id, email");
      if (error) throw error;
      return (data ?? []) as PendingLink[];
    },
  });
}

export function GuardiansEditor({
  student,
  profiles,
}: {
  student: { id: string; first_name: string; last_name: string; parent_id: string };
  profiles: Profile[] | undefined;
}) {
  const qc = useQueryClient();
  const linksQ = useGuardianLinks();
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState("");
  const [chosen, setChosen] = useState<Profile | null>(null);
  const [removing, setRemoving] = useState<GuardianLink | null>(null);
  const rolesQ = useRoleRows();
  const pendingQ = usePendingGuardianLinks();
  const pending = (pendingQ.data ?? []).filter((p) => p.student_id === student.id);
  const [preLink, setPreLink] = useState<{ email: string; parked: string[] } | null>(null);
  const [cancelling, setCancelling] = useState<PendingLink | null>(null);
  const [checking, setChecking] = useState(false);
  const fullName = `${student.first_name} ${student.last_name}`;

  /** Refusals first; the parked-row warning never blocks. */
  const startPreLink = async () => {
    const email = term.trim().toLowerCase();
    setChecking(true);
    try {
      const { data: prof, error: pe } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", email);
      if (pe) throw pe;
      const match = (prof ?? []).find((p) => p.email.trim().toLowerCase() === email);
      if (match) {
        const isStaff = (rolesQ.data ?? []).some((r) => r.user_id === match.id && r.role === "admin");
        toast.error(
          isStaff
            ? `${email} is a staff account and can't be linked as a guardian.`
            : `${email} already has an account. Use Add guardian to link it directly.`,
        );
        return;
      }
      if (pending.some((p) => p.email === email)) {
        toast.error(`${email} is already waiting to be linked to ${fullName}.`);
        return;
      }
      const { data: parked, error: ke } = await supabase
        .from("pending_student_imports")
        .select("first_name, last_name, parent_email")
        .ilike("parent_email", email);
      if (ke) throw ke;
      const names = (parked ?? [])
        .filter((r) => r.parent_email.trim().toLowerCase() === email)
        .map((r) => `${r.first_name} ${r.last_name}`);
      setPreLink({ email, parked: names });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const savePreLink = useMutation({
    mutationFn: async (email: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pending_guardian_links")
        .insert({ student_id: student.id, email, created_by: u.user?.id ?? null });
      if (error) {
        if (error.code === "23505") throw new Error(`${email} is already waiting to be linked to ${fullName}.`);
        throw error;
      }
      return email;
    },
    onSuccess: (email) => {
      toast.success(`${email} will be linked to ${student.first_name} when they sign up`);
      qc.invalidateQueries({ queryKey: ["admin-pending-guardian-links"] });
      setPreLink(null);
      setTerm("");
      setAdding(false);
    },
    onError: (e: Error) => {
      setPreLink(null);
      toast.error(e.message);
    },
  });

  const cancelPending = useMutation({
    mutationFn: async (p: PendingLink) => {
      const { error } = await supabase.from("pending_guardian_links").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pending link cancelled");
      setCancelling(null);
      qc.invalidateQueries({ queryKey: ["admin-pending-guardian-links"] });
    },
    onError: (e: Error) => {
      setCancelling(null);
      toast.error(e.message);
    },
  });

  const links = useMemo(
    () =>
      (linksQ.data ?? [])
        .filter((l) => l.student_id === student.id)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    [linksQ.data, student.id],
  );
  const byId = (id: string) => profiles?.find((p) => p.id === id);
  const linkedIds = new Set(links.map((l) => l.profile_id));

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    // Only non-archived parent-role accounts; any admin-role account (staff, the
    // staff test fixture) is excluded even if it also holds the parent role.
    const parents = new Set<string>();
    const admins = new Set<string>();
    for (const r of rolesQ.data ?? []) (r.role === "admin" ? admins : parents).add(r.user_id);
    return (profiles ?? [])
      .filter((p) => parents.has(p.id) && !admins.has(p.id) && !p.archived_at)
      .filter((p) => !linkedIds.has(p.id))
      .filter((p) => `${p.email} ${p.family_name ?? ""}`.toLowerCase().includes(q))
      .slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, profiles, links, rolesQ.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-guardian-links"] });
    qc.invalidateQueries({ queryKey: ["admin-student-photo-consent"] });
  };

  const link = useMutation({
    mutationFn: async (p: Profile) => {
      const { error } = await supabase
        .from("student_guardians")
        .insert({ student_id: student.id, profile_id: p.id, is_primary: false });
      if (error) throw error;
      return p;
    },
    onSuccess: (p) => {
      toast.success(`${p.email} can now see ${student.first_name}`);
      refresh();
      setChosen(null);
      setTerm("");
      setAdding(false);
    },
    onError: (e: Error) => {
      setChosen(null);
      toast.error(e.message);
    },
  });

  const unlink = useMutation({
    mutationFn: async (l: GuardianLink) => {
      const { error } = await supabase.from("student_guardians").delete().eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guardian link removed");
      setRemoving(null);
      refresh();
    },
    // Verbatim server message, e.g. the last-guardian refusal.
    onError: (e: Error) => {
      setRemoving(null);
      toast.error(e.message);
    },
  });

  return (
    <div className="mt-1 min-w-0 text-xs text-muted-foreground">
      <ul className="space-y-0.5">
        {links.length === 0 && <li>No linked account</li>}
        {links.map((l) => {
          const p = byId(l.profile_id);
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-1.5">
              <span className="select-text break-all">
                <span className="sr-only">Guardian email: </span>
                {p?.email ?? "Unknown account"}
              </span>
              {l.is_primary ? (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Main family</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs"
                  disabled={unlink.isPending}
                  onClick={() => setRemoving(l)}
                  aria-label={`Remove ${p?.email ?? "guardian"} as a guardian of ${student.first_name}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" /> Remove
                </Button>
              )}
            </li>
          );
        })}
        {pending.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-1.5">
            <span className="select-text break-all">Pending: {p.email} — links at signup</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-xs"
              onClick={() => setCancelling(p)}
              aria-label={`Cancel pending link for ${p.email}`}
            >
              <X className="h-3 w-3" aria-hidden="true" /> Cancel
            </Button>
          </li>
        ))}
      </ul>
      {links.length === 1 && (
        <p className="mt-0.5 text-[11px]">
          The main family can't be removed — move the child to another family instead.
        </p>
      )}

      {!adding ? (
        <Button variant="outline" size="sm" className="mt-1 h-9 text-xs" onClick={() => setAdding(true)}>
          <UserPlus className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Add guardian
        </Button>
      ) : (
        <div className="mt-2 rounded-lg border border-border bg-card p-2">
          <Input
            type="search"
            autoComplete="off"
            className="h-10"
            aria-label={`Find an existing parent account to link to ${student.first_name}`}
            placeholder="Existing parent's email or family name"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <ul className="mt-1 space-y-1">
            {term.trim().length >= 2 && results.length === 0 && (
              <li>
                No existing accounts match.
                {isEmailWithTld(term) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 h-9 w-full text-xs"
                    disabled={checking}
                    onClick={() => void startPreLink()}
                  >
                    {checking ? "Checking…" : "Link this email when they sign up"}
                  </Button>
                ) : (
                  " Type their full email to link them when they sign up."
                )}
              </li>
            )}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="min-h-10 w-full break-all rounded-md border border-border px-2 py-1 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setChosen(p)}
                >
                  {p.email}
                  {p.family_name ? ` · ${p.family_name} family` : ""}
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-1 h-9 text-xs" onClick={() => { setAdding(false); setTerm(""); }}>
            Cancel
          </Button>
        </div>
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o && !unlink.isPending) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removing ? (byId(removing.profile_id)?.email ?? "this account") : ""} as a guardian of {student.first_name} {student.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This account will no longer see {student.first_name}'s belt, attendance, Dojo Points and tournament results.
              The main family stays linked and is not told.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlink.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={unlink.isPending}
              onClick={(e) => { e.preventDefault(); if (removing) unlink.mutate(removing); }}
            >
              {unlink.isPending ? "Removing…" : "Remove guardian"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!chosen} onOpenChange={(o) => { if (!o && !link.isPending) setChosen(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Link {chosen?.email} as a guardian of {student.first_name} {student.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This account will see {student.first_name}'s belt, attendance, Dojo Points and tournament results.
              The existing family stays linked and is not told. Only do this when the school has agreed it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={link.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={link.isPending}
              onClick={(e) => { e.preventDefault(); if (chosen) link.mutate(chosen); }}
            >
              {link.isPending ? "Linking…" : "Link guardian"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!preLink} onOpenChange={(o) => { if (!o && !savePreLink.isPending) setPreLink(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link {preLink?.email} when they sign up?</AlertDialogTitle>
            <AlertDialogDescription>
              When {preLink?.email} signs up, they'll be linked to {fullName} automatically and will see their belt,
              attendance, Dojo Points and tournament results. The main family stays linked and is not told.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preLink && preLink.parked.length > 0 && (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-foreground">
              This email also has parked roster rows ({preLink.parked.join(", ")}). When they sign up those will be
              created as NEW students. If one of them is this same child, delete that parked row first or you'll get
              a duplicate.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savePreLink.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={savePreLink.isPending}
              onClick={(e) => { e.preventDefault(); if (preLink) savePreLink.mutate(preLink.email); }}
            >
              {savePreLink.isPending ? "Saving…" : "Link at signup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o && !cancelPending.isPending) setCancelling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel the pending link for {cancelling?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              If they sign up later, they won't be linked to {fullName} automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPending.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelPending.isPending}
              onClick={(e) => { e.preventDefault(); if (cancelling) cancelPending.mutate(cancelling); }}
            >
              {cancelPending.isPending ? "Cancelling…" : "Cancel pending link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
