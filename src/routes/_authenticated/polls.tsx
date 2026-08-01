import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, EyeOff, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-auth";
import {
  POLL_SELECT,
  isPollClosed,
  privacyNotice,
  fetchPollResults,
  type Poll,
  type PollOption,
  type PollVote,
} from "@/lib/polls";

export const Route = createFileRoute("/_authenticated/polls")({
  head: () => ({
    meta: [
      { title: "Polls & RSVPs — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "Answer quick questions from the Tiger's Den instructors — event RSVPs, availability checks and dojo polls.",
      },
      { property: "og:title", content: "Polls & RSVPs — Tiger's Den Martial Arts & Fitness" },
      {
        property: "og:description",
        content: "Answer quick questions and RSVPs from the Tiger's Den instructors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PollsPage,
});

function PollsPage() {
  const pollsQ = useQuery({
    queryKey: ["polls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select(POLL_SELECT)
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Poll[];
    },
  });

  const polls = pollsQ.data ?? [];
  const open = polls.filter((p) => !isPollClosed(p));
  const closed = polls.filter(isPollClosed);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="text-xs uppercase tracking-[0.3em] text-primary">Your voice</div>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
          Polls &amp; <span className="text-gradient-red">RSVPs</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Quick questions from your instructors. Choose from the options provided — there is no comment box,
          so anything longer belongs in an email or a chat at the front desk.
        </p>
      </header>

      {pollsQ.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading polls…</p>}
      {!pollsQ.isLoading && polls.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Nothing to answer right now.</p>
      )}

      <div className="mt-8 space-y-4">
        {open.map((poll) => (
          <PollCard key={poll.id} poll={poll} />
        ))}
      </div>

      {closed.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Closed
          </h2>
          <div className="mt-4 space-y-4">
            {closed.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PollCard({ poll }: { poll: Poll }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const closed = isPollClosed(poll);
  const [studentId, setStudentId] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);

  const optionsQ = useQuery({
    queryKey: ["poll-options", poll.id],
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

  const studentsQ = useQuery({
    queryKey: ["my-students-poll", user?.id],
    enabled: poll.respond_per === "student" && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const myVotesQ = useQuery({
    queryKey: ["poll-my-votes", poll.id, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("poll_votes")
        .select("id, poll_id, option_id, profile_id, student_id")
        .eq("poll_id", poll.id);
      if (error) throw error;
      return (data ?? []) as PollVote[];
    },
  });

  const currentStudent = poll.respond_per === "student" ? studentId : "";
  const myVotes = (myVotesQ.data ?? []).filter((v) =>
    poll.respond_per === "student" ? v.student_id === (currentStudent || null) : true,
  );
  const hasVoted = myVotes.length > 0;

  const canSeeResults =
    poll.results_visible === "always" ||
    (poll.results_visible === "after_vote" && hasVoted) ||
    (poll.results_visible === "after_close" && closed);

  const resultsQ = useQuery({
    queryKey: ["poll-results", poll.id],
    enabled: canSeeResults,
    queryFn: () => fetchPollResults(poll.id),
  });

  const vote = useMutation({
    mutationFn: async () => {
      if (poll.respond_per === "student" && !studentId) {
        throw new Error("Choose which student this answer is for.");
      }
      if (picked.length === 0) throw new Error("Pick an option first.");
      if (!user?.id) throw new Error("You need to be signed in.");

      // Replace any previous answer for this family/student, then insert the new one.
      let del = supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("profile_id", user.id);
      del = poll.respond_per === "student" ? del.eq("student_id", studentId) : del.is("student_id", null);
      const { error: delErr } = await del;
      if (delErr) throw delErr;

      const { error } = await supabase.from("poll_votes").insert(
        picked.map((option_id) => ({
          poll_id: poll.id,
          option_id,
          profile_id: user.id,
          student_id: poll.respond_per === "student" ? studentId : null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Answer recorded");
      qc.invalidateQueries({ queryKey: ["poll-my-votes", poll.id] });
      qc.invalidateQueries({ queryKey: ["poll-results", poll.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options = optionsQ.data ?? [];
  const total = (resultsQ.data ?? []).reduce((sum, r) => sum + r.vote_count, 0);
  const votedLabels = options.filter((o) => myVotes.some((v) => v.option_id === o.id)).map((o) => o.label);

  const toggle = (id: string) =>
    setPicked((prev) =>
      poll.multi_select
        ? prev.includes(id)
          ? prev.filter((p) => p !== id)
          : [...prev, id]
        : [id],
    );

  return (
    <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide sm:text-xl">{poll.question}</h2>
          {poll.description && <p className="mt-1 text-sm text-muted-foreground">{poll.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-border text-muted-foreground">
            {poll.anonymous ? (
              <><EyeOff className="mr-1 h-3 w-3" aria-hidden="true" /> Anonymous</>
            ) : (
              <><Users className="mr-1 h-3 w-3" aria-hidden="true" /> Seen by staff</>
            )}
          </Badge>
          {closed && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              <Lock className="mr-1 h-3 w-3" aria-hidden="true" /> Closed
            </Badge>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{privacyNotice(poll)}</p>

      {poll.respond_per === "student" && !closed && (
        <div className="mt-4 max-w-xs">
          <Label htmlFor={`student-${poll.id}`}>Answering for</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger id={`student-${poll.id}`} className="mt-1">
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {(studentsQ.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasVoted && (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
          <Check className="h-4 w-4" aria-hidden="true" /> Your answer: {votedLabels.join(", ")}
        </p>
      )}

      {!closed && (
        <div className="mt-4">
          {poll.multi_select ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">{poll.question}</legend>
              {options.map((o) => (
                <label key={o.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm">
                  <Checkbox checked={picked.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
                  {o.label}
                </label>
              ))}
            </fieldset>
          ) : (
            <RadioGroup value={picked[0] ?? ""} onValueChange={(v) => setPicked([v])} className="space-y-2">
              {options.map((o) => (
                <label key={o.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm">
                  <RadioGroupItem value={o.id} />
                  {o.label}
                </label>
              ))}
            </RadioGroup>
          )}

          <Button
            className="mt-4 bg-gradient-red"
            disabled={vote.isPending}
            onClick={() => vote.mutate()}
          >
            {hasVoted ? "Change my answer" : "Submit answer"}
          </Button>
        </div>
      )}

      {canSeeResults && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Results · {total} response
            {total === 1 ? "" : "s"}
          </div>
          {(resultsQ.data ?? []).map((r) => {
            const pct = total > 0 ? Math.round((r.vote_count / total) * 100) : 0;
            return (
              <div key={r.option_id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-red" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canSeeResults && (
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          {poll.results_visible === "admins_only"
            ? "Results are shared with Tiger's Den staff only."
            : poll.results_visible === "after_close"
              ? "Results are published once voting closes."
              : "Results appear once you submit your answer."}
        </p>
      )}
    </article>
  );
}
