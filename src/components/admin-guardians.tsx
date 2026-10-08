import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
              <li>No existing accounts match. The second guardian must sign up first.</li>
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
    </div>
  );
}
