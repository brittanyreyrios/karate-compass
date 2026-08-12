/**
 * Round 12 AS6 — enrolment management for one student.
 *
 * Membership lives in `student_classes`; `students.class_name` is a derived
 * display label maintained by a database trigger and is never written here.
 * Adding a second class is deliberately the most obvious control in the row —
 * recording a child in karate *and* jiu jitsu is the whole point of the round.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useClasses,
  useEnrollments,
  indexEnrollments,
  ENROLLMENT_KEYS,
} from "@/lib/enrollment";

export function EnrollmentEditor({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const classesQ = useClasses();
  const enrollQ = useEnrollments();
  const classes = classesQ.data ?? [];
  const { byStudent } = indexEnrollments(enrollQ.data);
  const rows = byStudent.get(studentId) ?? [];
  const enrolledIds = new Set(rows.map((r) => r.class_id));
  const available = classes.filter((c) => !enrolledIds.has(c.id));
  const [adding, setAdding] = useState<string>("");

  const invalidate = () => {
    for (const key of ENROLLMENT_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const add = useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.from("student_classes").insert({
        student_id: studentId,
        class_id: classId,
        // First class in becomes the primary one; the database keeps exactly one.
        is_primary: rows.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAdding("");
      invalidate();
      toast.success("Class added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Class removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makePrimary = useMutation({
    mutationFn: async (id: string) => {
      // A unique partial index allows exactly one primary row per student, so the
      // old one has to be cleared before the new one is set.
      const { error: clearErr } = await supabase
        .from("student_classes")
        .update({ is_primary: false })
        .eq("student_id", studentId)
        .eq("is_primary", true);
      if (clearErr) throw clearErr;
      const { error } = await supabase
        .from("student_classes")
        .update({ is_primary: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Primary class updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (classId: string) =>
    classes.find((c) => c.id === classId)?.class_name ?? "Unknown class";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {rows.length === 0 && (
        <Badge variant="outline" className="border-yellow-400/60 text-yellow-100">
          In no class
        </Badge>
      )}
      {rows.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-0.5 pl-2 pr-1 text-xs"
        >
          <span className="font-medium">{nameOf(r.class_id)}</span>
          {r.is_primary ? (
            <span className="rounded bg-primary/20 px-1 text-[10px] uppercase tracking-wider text-primary">
              Primary
            </span>
          ) : (
            <button
              type="button"
              className="rounded px-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              onClick={() => makePrimary.mutate(r.id)}
              disabled={makePrimary.isPending}
            >
              Make primary
            </button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            aria-label={`Remove ${nameOf(r.class_id)}`}
            onClick={() => remove.mutate(r.id)}
            disabled={remove.isPending}
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      ))}

      {available.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="h-8 w-[190px] text-xs">
              <SelectValue placeholder="Add another class…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.class_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!adding || add.isPending}
            onClick={() => add.mutate(adding)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </span>
      )}
    </div>
  );
}
