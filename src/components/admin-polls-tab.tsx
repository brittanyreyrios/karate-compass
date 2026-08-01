import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Plus, Trash2, Lock, Copy, Users, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  POLL_SELECT,
  isPollClosed,
  resultsVisibleLabel,
  fetchPollResults,
  type Poll,
  type PollOption,
} from "@/lib/polls";

type Breakdown = {
  family_name: string | null;
  email: string;
  student_name: string | null;
  option_label: string;
  voted_at: string;
};

export function PollsAdminTab() {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [respondPer, setRespondPer] = useState("family");
  const [multiSelect, setMultiSelect] = useState(false);
  const [resultsVisible, setResultsVisible] = useState("after_close");
  const [closesAt, setClosesAt] = useState("");

  const pollsQ = useQuery({
    queryKey: ["admin-polls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select(POLL_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Poll[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const q = question.trim();
      const labels = optionsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!q) throw new Error("Enter the poll question.");
      if (labels.length < 2) throw new Error("Add at least two answer options, one per line.");

      const { data: u } = await supabase.auth.getUser();
      const { data: poll, error } = await supabase
        .from("polls")
        .insert({
          question: q,
          description: description.trim() || null,
          anonymous,
          respond_per: respondPer,
          multi_select: multiSelect,
          results_visible: resultsVisible,
          closes_at: closesAt ? new Date(closesAt).toISOString() : null,
          created_by: u.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: optErr } = await supabase.from("poll_options").insert(
        labels.map((label, i) => ({ poll_id: poll.id, label, sort_order: i })),
      );
      if (optErr) throw optErr;
    },
    onSuccess: () => {
      toast.success("Poll published");
      setQuestion("");
      setDescription("");
      setOptionsText("");
      setClosesAt("");
      qc.invalidateQueries({ queryKey: ["admin-polls"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold uppercase">Create a poll</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Options are staff-written. Parents choose from them — they cannot add free text or comments.
        </p>

        <div className="mt-5 grid gap-4">
          <div>
            <Label htmlFor="poll-q">Question</Label>
            <Input
              id="poll-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Can your child attend SWAT team on the 14th?"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="poll-desc">Detail (optional)</Label>
            <Textarea
              id="poll-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="poll-options">Answer options — one per line</Label>
            <Textarea
              id="poll-options"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={4}
              placeholder={"Yes, attending\nNo, can't make it\nNot sure yet"}
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="poll-per">Answered by</Label>
              <Select value={respondPer} onValueChange={setRespondPer}>
                <SelectTrigger id="poll-per" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="family">Once per family</SelectItem>
                  <SelectItem value="student">Once per student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="poll-results">Results visibility</Label>
              <Select value={resultsVisible} onValueChange={setResultsVisible}>
                <SelectTrigger id="poll-results" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_close">After voting closes</SelectItem>
                  <SelectItem value="after_vote">After the family votes</SelectItem>
                  <SelectItem value="always">Always visible</SelectItem>
                  <SelectItem value="admins_only">Staff only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="poll-closes">Closes at (optional)</Label>
              <Input
                id="poll-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="poll-anon" className="text-sm">
                  Anonymous responses
                </Label>
                <Switch id="poll-anon" checked={anonymous} onCheckedChange={setAnonymous} />
              </div>
              <p className="text-xs text-muted-foreground">
                {anonymous
                  ? "Only totals are stored for staff to read — use for opinion polls."
                  : "Staff can see which family answered — use for RSVPs and availability."}
              </p>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="poll-multi" className="text-sm">
                  Allow multiple choices
                </Label>
                <Switch id="poll-multi" checked={multiSelect} onCheckedChange={setMultiSelect} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="bg-gradient-red" disabled={create.isPending} onClick={() => create.mutate()}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              {create.isPending ? "Publishing…" : "Publish poll"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {pollsQ.isLoading && <p className="text-sm text-muted-foreground">Loading polls…</p>}
        {!pollsQ.isLoading && (pollsQ.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No polls yet.</p>
        )}
        {(pollsQ.data ?? []).map((poll) => (
          <AdminPollCard key={poll.id} poll={poll} />
        ))}
      </section>
    </div>
  );
}

function AdminPollCard({ poll }: { poll: Poll }) {
  const qc = useQueryClient();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const closed = isPollClosed(poll);

  const optionsQ = useQuery({
    queryKey: ["admin-poll-options", poll.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("poll_options")
        .select("id, poll_id, label, sort_order")
        .eq("poll_id", poll.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PollOption[];
    },
  });

  const resultsQ = useQuery({
    queryKey: ["admin-poll-results", poll.id],
    queryFn: () => fetchPollResults(poll.id),
  });

  const breakdownQ = useQuery({
    queryKey: ["admin-poll-breakdown", poll.id],
    enabled: showBreakdown && !poll.anonymous,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_poll_breakdown", { _poll_id: poll.id });
      if (error) throw error;
      return (data ?? []) as Breakdown[];
    },
  });

  const closeNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("polls")
        .update({ closes_at: new Date().toISOString() })
        .eq("id", poll.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Poll closed");
      qc.invalidateQueries({ queryKey: ["admin-polls"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublished = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("polls")
        .update({ published: !poll.published })
        .eq("id", poll.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-polls"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("polls").delete().eq("id", poll.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Poll deleted");
      qc.invalidateQueries({ queryKey: ["admin-polls"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyBreakdown = () => {
    const rows = breakdownQ.data ?? [];
    const csv = [
      "family,email,student,answer,voted_at",
      ...rows.map((r) =>
        [r.family_name ?? "", r.email, r.student_name ?? "", r.option_label, r.voted_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    navigator.clipboard.writeText(csv).then(
      () => toast.success("Breakdown copied as CSV"),
      () => toast.error("Could not copy to clipboard"),
    );
  };

  const total = (resultsQ.data ?? []).reduce((sum, r) => sum + r.vote_count, 0);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold uppercase tracking-wide">{poll.question}</h3>
          {poll.description && <p className="mt-1 text-sm text-muted-foreground">{poll.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className={poll.anonymous ? "border-border" : "border-primary/40 text-primary"}>
              {poll.anonymous ? (
                <><EyeOff className="mr-1 h-3 w-3" aria-hidden="true" /> Anonymous</>
              ) : (
                <><Users className="mr-1 h-3 w-3" aria-hidden="true" /> Named</>
              )}
            </Badge>
            <Badge variant="outline">
              {poll.respond_per === "student" ? "Per student" : "Per family"}
            </Badge>
            <Badge variant="outline">{poll.multi_select ? "Multiple choice" : "Single choice"}</Badge>
            <Badge variant="outline">{resultsVisibleLabel(poll.results_visible)}</Badge>
            {closed && <Badge variant="outline" className="border-border text-muted-foreground">Closed</Badge>}
            {!poll.published && <Badge variant="outline">Unpublished</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!closed && (
            <Button size="sm" variant="outline" disabled={closeNow.isPending} onClick={() => closeNow.mutate()}>
              <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Close now
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={togglePublished.isPending} onClick={() => togglePublished.mutate()}>
            {poll.published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-200"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm("Delete this poll and all its responses?")) remove.mutate();
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Delete
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {(resultsQ.data ?? []).map((r) => {
          const pct = total > 0 ? Math.round((r.vote_count / total) * 100) : 0;
          return (
            <div key={r.option_id}>
              <div className="flex items-center justify-between text-sm">
                <span>{r.label}</span>
                <span className="text-muted-foreground">
                  {r.vote_count} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-red" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {(resultsQ.data ?? []).length === 0 && !resultsQ.isLoading && (
          <p className="text-sm text-muted-foreground">
            {(optionsQ.data ?? []).length} options · no responses yet.
          </p>
        )}
      </div>

      {!poll.anonymous && (
        <div className="mt-5 rounded-xl border border-border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Per-family breakdown</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowBreakdown((v) => !v)}>
                {showBreakdown ? "Hide" : "Show"}
              </Button>
              {showBreakdown && (breakdownQ.data ?? []).length > 0 && (
                <Button size="sm" variant="outline" onClick={copyBreakdown}>
                  <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Copy CSV
                </Button>
              )}
            </div>
          </div>
          {showBreakdown && (
            <div className="mt-3 space-y-1 text-sm">
              {breakdownQ.isLoading && <p className="text-muted-foreground">Loading…</p>}
              {!breakdownQ.isLoading && (breakdownQ.data ?? []).length === 0 && (
                <p className="text-muted-foreground">No responses yet.</p>
              )}
              {(breakdownQ.data ?? []).map((r, i) => (
                <div key={`${r.email}-${r.student_name ?? ""}-${r.option_label}-${i}`} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-1">
                  <span>
                    {r.family_name ?? r.email}
                    {r.student_name ? ` · ${r.student_name}` : ""}
                  </span>
                  <span className="text-muted-foreground">{r.option_label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
