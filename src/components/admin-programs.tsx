/**
 * Round 12 AT1 — programmes.
 *
 * A programme is NOT a belt system: karate spans three belt systems (youth
 * stripe, camo, solid) but is one programme, and wrestling trains with jiu jitsu
 * so they are deliberately one programme for access purposes.
 *
 * A student's programmes are derived from the classes they are enrolled in, so
 * there is nothing to tick per student and nothing to keep in sync by hand.
 * Nothing consumes programmes yet — the technique library comes later.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Layers, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrograms, type Program } from "@/lib/enrollment";

export function ProgramsCard() {
  const qc = useQueryClient();
  const programsQ = usePrograms();
  const programs = programsQ.data ?? [];
  const [newName, setNewName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["programs"] });
    qc.invalidateQueries({ queryKey: ["class-schedules"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Enter a programme name.");
      const nextOrder = programs.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;
      const { error } = await supabase
        .from("programs")
        .insert({ name, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      invalidate();
      toast.success("Programme added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-bold uppercase">Programmes</h2>
        <Badge variant="outline" className="border-primary/40 text-primary">
          {programs.length}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Each class below belongs to one programme. A student's programmes come from the classes they
        are in, so a child in Kid's Jiu Jitsu and Intermediate Karate is in both automatically.
      </p>

      <div className="mt-5 space-y-2">
        {programs.map((p) => (
          <ProgramRow key={p.id} program={p} onSaved={invalidate} />
        ))}
        {!programsQ.isLoading && programs.length === 0 && (
          <p className="text-sm text-muted-foreground">No programmes yet — add the first below.</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
        className="mt-5 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[220px] flex-1">
          <Label>New programme</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Karate, Jiu Jitsu & Wrestling, Tai Chi"
            className="mt-1"
          />
        </div>
        <Button type="submit" className="bg-gradient-red" disabled={add.isPending}>
          <Plus className="mr-1 h-4 w-4" /> Add programme
        </Button>
      </form>
    </div>
  );
}

function ProgramRow({ program, onSaved }: { program: Program; onSaved: () => void }) {
  const [name, setName] = useState(program.name);

  const save = useMutation({
    mutationFn: async () => {
      const next = name.trim();
      if (!next) throw new Error("A programme needs a name.");
      const { error } = await supabase.from("programs").update({ name: next }).eq("id", program.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onSaved();
      toast.success("Programme renamed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = name.trim() !== program.name;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 min-w-[200px] flex-1"
        aria-label={`Programme name for ${program.name}`}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-9"
        disabled={!dirty || save.isPending}
        onClick={() => save.mutate()}
      >
        <Save className="mr-1 h-3.5 w-3.5" /> Save
      </Button>
    </div>
  );
}
