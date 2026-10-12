import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { changeParentEmail, type ChangeEmailResult } from "@/lib/parent-accounts.functions";
import { isEmailWithTld, EMAIL_TLD_MESSAGE } from "@/lib/email-check";

/** Round 60 — staff change a parent's login email (login + display copy together). */
export function ChangeParentEmailButton({
  profileId,
  email,
  familyName,
}: {
  profileId: string;
  email: string;
  familyName: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ChangeEmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fn = useServerFn(changeParentEmail);

  const history = useQuery({
    queryKey: ["admin-email-change-events", profileId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_change_events")
        .select("id, old_email, new_email, changed_at")
        .eq("target_user_id", profileId)
        .order("changed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const change = useMutation({
    mutationFn: async () => await fn({ data: { profileId, newEmail: value } }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      setConfirming(false);
      if (r.outOfStep) toast.error(r.outOfStep, { duration: 30000 });
      else toast.success(`Login email changed to ${r.newEmail}`);
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-email-delivery-flags"] });
      qc.invalidateQueries({ queryKey: ["admin-email-change-events", profileId] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setConfirming(false);
    },
  });

  const trimmed = value.trim();
  const localError = trimmed && !isEmailWithTld(trimmed) ? EMAIL_TLD_MESSAGE : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setValue("");
          setConfirming(false);
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 w-full sm:w-auto">
          <Mail className="mr-1 h-4 w-4" aria-hidden="true" /> Change email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change login email — {familyName || email}</DialogTitle>
          <DialogDescription>
            This changes the address the parent signs in with and where password resets go. Their password stays
            the same. The new address is marked as confirmed, and a notice is sent to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Current: </span>
            <span className="break-all font-medium">{email}</span>
          </div>
          {!result && (
            <div className="space-y-1.5">
              <Label htmlFor={`new-email-${profileId}`}>New email</Label>
              <Input
                id={`new-email-${profileId}`}
                type="email"
                autoComplete="off"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setConfirming(false);
                  setError(null);
                }}
                aria-invalid={!!localError}
              />
              {localError && <p className="text-xs text-destructive">{localError}</p>}
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-md border border-destructive/50 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {result && <ResultPanel r={result} />}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email history</div>
            {(history.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No changes recorded.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs">
                {history.data!.map((h) => (
                  <li key={h.id} className="break-all">
                    {new Date(h.changed_at).toLocaleString()}: {h.old_email} → {h.new_email}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button className="bg-gradient-red" disabled={change.isPending} onClick={() => change.mutate()}>
                {change.isPending ? "Changing…" : `Yes, change login to ${trimmed}`}
              </Button>
            </>
          ) : (
            <Button
              className="bg-gradient-red"
              disabled={!trimmed || !!localError}
              onClick={() => setConfirming(true)}
            >
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultPanel({ r }: { r: ChangeEmailResult }) {
  return (
    <div className="space-y-2 text-sm">
      {r.outOfStep ? (
        <p role="alert" className="rounded-md border border-destructive p-2 font-semibold text-destructive">
          {r.outOfStep}
        </p>
      ) : (
        <p className="rounded-md border border-border p-2">
          Login changed: {r.oldEmail} → <strong>{r.newEmail}</strong>
        </p>
      )}
      {r.auditError && <p className="text-destructive">History entry could not be saved: {r.auditError}</p>}
      <p className={r.notification.sent ? "text-muted-foreground" : "text-destructive"}>
        {r.notification.sent
          ? "Notice sent to the new address."
          : `Notice to the new address was NOT sent (${r.notification.detail}). The change still stands.`}
      </p>
      {(r.pendingImports.length > 0 || r.pendingGuardianLinks.length > 0) && (
        <div className="rounded-md border border-amber-400/60 p-2 text-amber-200">
          <p className="font-semibold">Waiting rows match the new address — not applied. Please decide:</p>
          <ul className="ml-4 list-disc">
            {r.pendingImports.map((p, i) => (
              <li key={`i${i}`}>Parked roster student: {p.first_name} {p.last_name}</li>
            ))}
            {r.pendingGuardianLinks.map((p, i) => (
              <li key={`g${i}`}>Pending second-guardian link for {p.student_name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
