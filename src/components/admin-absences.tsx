import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { formatDateOnly } from "@/lib/date-only";
import { gymYear, removeAbsence } from "@/lib/absences";

type Row = { id: string; occurred_on: string; class_name: string | null; created_by: string | null };

/**
 * Staff-only absence history. "This year" is a filter on occurred_on in the
 * gym's calendar year — nothing is ever deleted at a year boundary.
 */
export function AbsenceHistory({ student }: { student: { id: string; first_name: string; last_name: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const year = gymYear();

  const q = useQuery({
    queryKey: ["absence-events", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absence_events")
        .select("id, occurred_on, class_name, created_by")
        .eq("student_id", student.id)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, email").in("id", ids);
        for (const p of profs ?? []) names[p.id] = p.email;
      }
      return { rows, names };
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeAbsence(id),
    onSuccess: () => {
      toast.success("Absence removed");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["absence-events", student.id] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data?.rows ?? [];
  const thisYear = rows.filter((r) => r.occurred_on >= `${year}-01-01` && r.occurred_on <= `${year}-12-31`).length;
  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <div className="mt-2 text-xs">
      <button type="button" className="font-semibold text-muted-foreground underline-offset-2 hover:underline" onClick={() => setOpen((v) => !v)}>
        Absences this year: {q.isLoading ? "…" : thisYear} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {q.isError && <p className="text-destructive">Could not load absences.</p>}
          {!q.isLoading && rows.length === 0 && <p className="text-muted-foreground">No absences recorded.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
              <span>
                {formatDateOnly(r.occurred_on)}
                {r.class_name ? ` · ${r.class_name}` : ""}
                <span className="text-muted-foreground"> · marked by {r.created_by ? q.data?.names[r.created_by] ?? "staff" : "unknown"}</span>
              </span>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setConfirm(r)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this absence?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the absence for {fullName} on {confirm ? formatDateOnly(confirm.occurred_on) : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} onClick={(e) => { e.preventDefault(); if (confirm) remove.mutate(confirm.id); }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
