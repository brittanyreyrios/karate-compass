import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldMinus, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Staff role management.
 *
 * The database is the authority here, not this component: a trigger refuses to
 * delete your own admin row and refuses to delete the last remaining admin, and
 * every grant/revoke is written to `role_change_events` by another trigger. So
 * the UI only has to disable the obvious cases and surface the error text when
 * the guard fires anyway.
 */

export function useAdminUserIds() {
  return useQuery({
    queryKey: ["admin-user-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id as string));
    },
  });
}

export function AdminRoleButton({
  profileId,
  email,
  familyName,
  isAdmin,
  adminCount,
}: {
  profileId: string;
  email: string;
  familyName: string | null;
  isAdmin: boolean;
  adminCount: number;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const isSelf = user?.id === profileId;
  const lastAdmin = isAdmin && adminCount <= 1;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-user-ids"] });
    qc.invalidateQueries({ queryKey: ["role-change-events"] });
    qc.invalidateQueries({ queryKey: ["is-admin"] });
  };

  const grant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profileId, role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${familyName ?? email} can now reach the Admin Console`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", profileId)
        .eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Staff access removed for ${familyName ?? email}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = grant.isPending || revoke.isPending;

  if (!isAdmin) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={busy} className="h-11 w-full sm:w-auto">
            <ShieldCheck className="mr-1 h-4 w-4" /> Make staff admin
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Give {familyName ?? email} full staff access?</AlertDialogTitle>
            <AlertDialogDescription>
              Admins can see and edit every family, every student, attendance, Dojo Points,
              announcements and invite codes — and can promote other admins. Only do this for
              staff members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-gradient-red" onClick={() => grant.mutate()}>
              Grant admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          disabled={busy || isSelf || lastAdmin}
          className="h-11 w-full sm:w-auto"
          title={
            isSelf
              ? "You cannot remove your own admin access"
              : lastAdmin
                ? "At least one admin must remain"
                : undefined
          }
        >
          <ShieldMinus className="mr-1 h-4 w-4" /> Remove admin
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove staff access from {familyName ?? email}?</AlertDialogTitle>
          <AlertDialogDescription>
            They keep their parent account and their own children, but lose the Admin Console
            and every staff tool. This is recorded in the role change history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep admin</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            onClick={() => revoke.mutate()}
          >
            Remove admin
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type RoleChangeEvent = {
  id: string;
  target_user_id: string;
  role: string;
  action: string;
  changed_by: string | null;
  changed_at: string;
};

export function RoleChangeHistory() {
  const eventsQ = useQuery({
    queryKey: ["role-change-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_change_events")
        .select("id, target_user_id, role, action, changed_by, changed_at")
        .order("changed_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as RoleChangeEvent[];
    },
  });

  const namesQ = useQuery({
    queryKey: ["admin-profile-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, family_name");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        map.set(row.id as string, (row.family_name as string | null) ?? (row.email as string));
      }
      return map;
    },
  });

  const label = (id: string | null) =>
    (id && namesQ.data?.get(id)) || (id ? "Unknown account" : "System");

  const rows = eventsQ.data ?? [];

  return (
    <div className="mt-6 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em]">
          Role change history
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every staff-access grant and removal, newest first. This log cannot be edited.
      </p>

      <ul className="mt-3 space-y-2">
        {eventsQ.isLoading && (
          <li className="text-sm text-muted-foreground" aria-busy="true">
            Loading history…
          </li>
        )}
        {!eventsQ.isLoading && rows.length === 0 && (
          <li className="text-sm text-muted-foreground">No role changes recorded yet.</li>
        )}
        {rows.map((e) => (
          <li
            key={e.id}
            className="rounded-lg border border-border bg-card p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  e.action === "granted"
                    ? "border-primary/50 text-primary"
                    : "border-amber-400/60 text-amber-200"
                }
              >
                {e.action === "granted" ? "Granted" : "Removed"} {e.role}
              </Badge>
              <span className="min-w-0 break-words font-semibold">{label(e.target_user_id)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              by {label(e.changed_by)} · {new Date(e.changed_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
