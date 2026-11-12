import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLAIM_FAILURE, claimMyChild, refreshClaimViews } from "@/lib/student-claims";
import { useSession } from "@/hooks/use-auth";

export function PendingStudentClaim() {
  const qc = useQueryClient();
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["finish-signup-claim", user?.id], enabled: !!user, staleTime: Infinity, retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finish_pending_student_claim");
      if (error) throw new Error(CLAIM_FAILURE);
      return data as { attempted: boolean; success?: boolean };
    },
  });
  useEffect(() => {
    if (!q.data?.attempted) return;
    if (q.data.success) { toast.success("Welcome to the Tiger's Den Parent Portal!"); void refreshClaimViews(qc); }
    else toast.error(CLAIM_FAILURE);
  }, [q.data, qc]);
  // A transport failure leaves the saved intent intact for the next successful login.
  useEffect(() => { if (q.isError) toast.error(CLAIM_FAILURE); }, [q.isError]);
  return null;
}

export function AddMyChild() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <>
    <Button variant="outline" onClick={() => { setError(false); setOpen(true); }}><UserPlus className="h-4 w-4" />Add my child</Button>
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogContent aria-describedby={undefined} className="max-w-sm">
        <DialogHeader><DialogTitle>Add my child</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); if (busy) return; setBusy(true); setError(false);
          try {
            const child = await claimMyChild(code);
            toast.success(`Welcome! ${child.first_name} already has ${child.attendance_count} classes logged.`);
            setOpen(false); setCode(""); await refreshClaimViews(qc);
          } catch { setError(true); toast.error(CLAIM_FAILURE); }
          finally { setBusy(false); }
        }}>
          <div className="space-y-2"><Label htmlFor="parent-claim-code">Child's claim code</Label>
            <Input id="parent-claim-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" maxLength={64} required />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{CLAIM_FAILURE}</p>}
          <Button type="submit" disabled={busy || !code.trim()} className="w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Linking…" : "Link my child"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}