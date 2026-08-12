/**
 * Round 13 AU3 — admin side of the technique library.
 *
 * Kept in its own file and its own table: nothing here touches the karate
 * curriculum admin or `curriculum_items`. Reordering reuses the curriculum
 * pattern — two real buttons, group-scoped, one round trip — so it is fully
 * keyboard operable and there is no drag interaction to fail on a phone.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Swords, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractYouTubeId, formatRuntime, YOUTUBE_LINK_ERROR } from "@/lib/youtube";
import { usePrograms } from "@/lib/enrollment";
import {
  DIFFICULTY_LABELS,
  TECHNIQUE_CATEGORIES,
  TECHNIQUE_DIFFICULTIES,
  TECHNIQUE_LABELS,
} from "@/lib/technique-library";

type LibraryRow = {
  id: string;
  program_id: string;
  label: string;
  title: string;
  category: string;
  difficulty: string | null;
  notes: string | null;
  published: boolean;
  sort_order: number;
  video_youtube_id: string | null;
  video_title: string | null;
  video_seconds: number | null;
};

export function TechniqueLibraryAdminTab() {
  const qc = useQueryClient();
  const programsQ = usePrograms();
  const programs = (programsQ.data ?? []).filter((p) => p.active);

  const [programId, setProgramId] = useState<string>("");
  const [label, setLabel] = useState<string>("Jiu Jitsu");
  const [category, setCategory] = useState<string>("Guard");
  const [difficulty, setDifficulty] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoMinutes, setVideoMinutes] = useState("");

  const itemsQ = useQuery({
    queryKey: ["admin-technique-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technique_library")
        .select(
          "id, program_id, label, title, category, difficulty, notes, published, sort_order, video_youtube_id, video_title, video_seconds",
        )
        .order("category")
        .order("sort_order")
        .order("title");
      if (error) throw error;
      return (data ?? []) as LibraryRow[];
    },
  });

  const items = itemsQ.data ?? [];
  const defaultProgram = programId || programs.find((p) => /jiu/i.test(p.name))?.id || programs[0]?.id || "";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-technique-library"] });
    qc.invalidateQueries({ queryKey: ["technique-library"] });
  };

  /** Groups are (programme, category) — sort_order is only meaningful inside one. */
  const groups = useMemo(() => {
    const map = new Map<string, LibraryRow[]>();
    for (const it of items) {
      const key = `${it.program_id}||${it.category}`;
      const list = map.get(key);
      if (list) list.push(it);
      else map.set(key, [it]);
    }
    return Array.from(map.entries()).map(([key, rows]) => ({
      key,
      programName: programs.find((p) => p.id === rows[0].program_id)?.name ?? "Unassigned programme",
      category: rows[0].category,
      rows,
    }));
  }, [items, programs]);

  const addItem = useMutation({
    mutationFn: async () => {
      if (!defaultProgram) throw new Error("Create a programme first.");
      if (!title.trim()) throw new Error("A technique title is required.");
      let videoId: string | null = null;
      if (videoLink.trim()) {
        videoId = extractYouTubeId(videoLink);
        if (!videoId) throw new Error(YOUTUBE_LINK_ERROR);
      }
      const minutes = Number(videoMinutes);
      const seconds =
        videoMinutes.trim() && Number.isFinite(minutes) && minutes > 0
          ? Math.round(minutes * 60)
          : null;

      const peers = items.filter(
        (i) => i.program_id === defaultProgram && i.category === category,
      );
      const nextOrder = peers.length ? Math.max(...peers.map((p) => p.sort_order)) + 1 : 0;

      const { error } = await supabase.from("technique_library").insert({
        program_id: defaultProgram,
        label,
        title: title.trim(),
        category,
        difficulty: difficulty === "none" ? null : difficulty,
        notes: notes.trim() || null,
        video_youtube_id: videoId,
        video_title: videoTitle.trim() || null,
        video_seconds: seconds,
        sort_order: nextOrder,
        published: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Technique saved as a draft. Publish it when you're ready.");
      setTitle(""); setNotes(""); setVideoLink(""); setVideoTitle(""); setVideoMinutes("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LibraryRow> }) => {
      const { error } = await supabase.from("technique_library").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("technique_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Technique removed."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Group-scoped swap, both rows in one round trip. */
  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: LibraryRow; b: LibraryRow }) => {
      const { error } = await supabase.from("technique_library").upsert([
        { ...a, sort_order: b.sort_order },
        { ...b, sort_order: a.sort_order },
      ]);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast.error(`Could not save the new order: ${e.message}`);
      invalidate();
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form
        className="rounded-2xl border border-border bg-card p-4 sm:p-6"
        onSubmit={(e) => { e.preventDefault(); addItem.mutate(); }}
      >
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          <Swords className="h-4 w-4 text-primary" aria-hidden="true" /> Add Technique
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Families see a technique only when one of their children is in a class belonging to the
          programme you pick here. New techniques start as drafts.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="tl-program">Programme</Label>
            <Select value={defaultProgram} onValueChange={setProgramId}>
              <SelectTrigger id="tl-program" className="h-11"><SelectValue placeholder="Choose a programme" /></SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tl-label">Group</Label>
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger id="tl-label" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TECHNIQUE_LABELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tl-title">Technique</Label>
            <Input id="tl-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Armbar from guard" />
          </div>
          <div>
            <Label htmlFor="tl-category">Position / category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="tl-category" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TECHNIQUE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tl-difficulty">Difficulty (optional)</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger id="tl-difficulty" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No difficulty tag</SelectItem>
                {TECHNIQUE_DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>{DIFFICULTY_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">A label only — it never hides anything.</p>
          </div>
          <div>
            <Label htmlFor="tl-video">YouTube link (optional)</Label>
            <Input id="tl-video" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tl-video-title">Video title</Label>
              <Input id="tl-video-title" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tl-video-mins">Length (minutes)</Label>
              <Input id="tl-video-mins" inputMode="decimal" value={videoMinutes} onChange={(e) => setVideoMinutes(e.target.value)} placeholder="2.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="tl-notes">Coaching cues (optional)</Label>
            <Textarea id="tl-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" disabled={addItem.isPending} className="w-full bg-gradient-red">
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> {addItem.isPending ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Library</h2>
        {itemsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading library…</p>
        ) : groups.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No techniques yet.</p>
        ) : (
          <div className="mt-4 space-y-8">
            {groups.map((g) => (
              <section key={g.key}>
                <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {g.programName} · {g.category}
                </h3>
                <ul className="mt-2 space-y-2">
                  {g.rows.map((it, index) => {
                    const prev = index > 0 ? g.rows[index - 1] : undefined;
                    const next = index < g.rows.length - 1 ? g.rows[index + 1] : undefined;
                    return (
                      <li key={it.id} className="rounded-lg border border-border bg-background/50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="mr-2 text-xs font-semibold tabular-nums text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="text-sm font-medium">{it.title}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{it.label}</span>
                            {it.difficulty && (
                              <Badge variant="outline" className="ml-2 border-border text-xs text-muted-foreground">
                                {DIFFICULTY_LABELS[it.difficulty] ?? it.difficulty}
                              </Badge>
                            )}
                            {it.video_youtube_id && (
                              <Badge variant="outline" className="ml-2 gap-1 border-border text-xs">
                                <Video className="h-3 w-3" aria-hidden="true" /> Video
                                {formatRuntime(it.video_seconds) ? ` · ${formatRuntime(it.video_seconds)}` : ""}
                              </Badge>
                            )}
                            {!it.published && (
                              <Badge variant="outline" className="ml-2 border-primary/60 text-xs text-primary">
                                Draft
                              </Badge>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center">
                            <Button
                              variant="ghost" size="icon" className="h-11 w-11"
                              aria-label={`Move ${it.title} up`}
                              disabled={!prev || reorder.isPending}
                              onClick={() => prev && reorder.mutate({ a: it, b: prev })}
                            >
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-11 w-11"
                              aria-label={`Move ${it.title} down`}
                              disabled={!next || reorder.isPending}
                              onClick={() => next && reorder.mutate({ a: it, b: next })}
                            >
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => patch.mutate({ id: it.id, values: { published: !it.published } })}
                            >
                              {it.published ? "Unpublish" : "Publish"}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-11 w-11"
                              aria-label={`Delete technique ${it.title}`}
                              onClick={() => remove.mutate(it.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`tl-t-${it.id}`}>Technique</Label>
                            <Input
                              id={`tl-t-${it.id}`}
                              defaultValue={it.title}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (!v) { e.target.value = it.title; return; }
                                if (v !== it.title) patch.mutate({ id: it.id, values: { title: v } });
                              }}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`tl-c-${it.id}`}>Category</Label>
                            <Input
                              id={`tl-c-${it.id}`}
                              defaultValue={it.category}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (!v) { e.target.value = it.category; return; }
                                if (v !== it.category) patch.mutate({ id: it.id, values: { category: v } });
                              }}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor={`tl-n-${it.id}`}>Coaching cues</Label>
                            <Textarea
                              id={`tl-n-${it.id}`}
                              rows={2}
                              defaultValue={it.notes ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null;
                                if (v !== (it.notes ?? null)) patch.mutate({ id: it.id, values: { notes: v } });
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
