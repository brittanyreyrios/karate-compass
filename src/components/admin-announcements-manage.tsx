import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Megaphone, Pencil, Pin, PinOff, Save, Send, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { count } from "@/lib/plural";
import { formatDateOnly } from "@/lib/date-only";
import {
  chicagoToInstant,
  formatChicagoDateTime,
  instantToChicago,
  isScheduled,
} from "@/lib/schedule-time";

/**
 * Posting an announcement was one-way: there was no way to fix a typo and no way
 * to delete anything, so the feed only ever grew. This tab is the missing other
 * half — list, filter, edit in place, and delete (single or bulk).
 *
 * Deletes are permanent. There is deliberately no archive flag: a soft-deleted
 * announcement that still exists in the table is exactly the kind of thing that
 * reappears in a feed six months later.
 */

type AnnouncementRow = {
  id: string;
  category: "school_news" | "tournament";
  title: string;
  body: string;
  event_date: string | null;
  pinned: boolean;
  publish_at: string | null;
  created_at: string;
};

/**
 * Two tables point at announcements. Both FKs are ON DELETE SET NULL, so a
 * delete cannot break anything — but the staff member deserves to be told that
 * the Events tab or a class's testing date will show as "no longer posted".
 */
type Reference = { kind: "event" | "test"; label: string };

/** AB2: the admin archive is paginated too — it grows forever. */
const ADMIN_PAGE_SIZE = 25;

function useAnnouncements(category: string, before: string, limit: number) {
  return useQuery({
    queryKey: ["admin-announcements", category, before, limit],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .from("announcements")
        .select("id, category, title, body, event_date, pinned, publish_at, created_at")
        .order("created_at", { ascending: false });
      if (category !== "all") q = q.eq("category", category);
      if (before) q = q.lt("created_at", `${before}T00:00:00`);
      q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AnnouncementRow[];
    },
  });
}

/** One round trip for the whole page rather than one per row. */
function useReferences(ids: string[]) {
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["announcement-refs", key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [events, tests] = await Promise.all([
        supabase.from("events").select("id, title, announcement_id").in("announcement_id", ids),
        supabase
          .from("class_schedules")
          .select("id, class_name, test_announcement_id")
          .in("test_announcement_id", ids),
      ]);
      const map = new Map<string, Reference[]>();
      const push = (id: string, ref: Reference) => {
        const list = map.get(id);
        if (list) list.push(ref);
        else map.set(id, [ref]);
      };
      for (const e of events.data ?? []) {
        if (e.announcement_id) push(e.announcement_id, { kind: "event", label: e.title });
      }
      for (const s of tests.data ?? []) {
        if (s.test_announcement_id) {
          push(s.test_announcement_id, { kind: "test", label: s.class_name });
        }
      }
      return map;
    },
  });
}

function warningsFor(rows: AnnouncementRow[], refs: Map<string, Reference[]> | undefined): string[] {
  const out: string[] = [];
  if (rows.some((r) => r.category === "tournament")) {
    out.push(
      "One or more of these is a tournament — deleting it also removes it from the calendar and from the dashboard tournament timeline.",
    );
  }
  const eventRefs = rows.flatMap((r) => (refs?.get(r.id) ?? []).filter((x) => x.kind === "event"));
  if (eventRefs.length > 0) {
    out.push(
      `Linked to ${count(eventRefs.length, "calendar event")} (${eventRefs.map((r) => r.label).join(", ")}). The event itself stays on the calendar, but the Events tab will show it as no longer posted to announcements.`,
    );
  }
  const testRefs = rows.flatMap((r) => (refs?.get(r.id) ?? []).filter((x) => x.kind === "test"));
  if (testRefs.length > 0) {
    out.push(
      `Posted for the belt test of ${testRefs.map((r) => r.label).join(", ")}. The testing date and its calendar entry stay; the class will simply have no announcement, and staff can tick "Also post an announcement" again to re-post one.`,
    );
  }
  return out;
}

export function AnnouncementsManageTab() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("all");
  const [before, setBefore] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<AnnouncementRow[] | null>(null);

  const [limit, setLimit] = useState(ADMIN_PAGE_SIZE);
  const listQ = useAnnouncements(category, before, limit);
  const rows = listQ.data ?? [];
  const hasMore = rows.length >= limit;
  const refsQ = useReferences(rows.map((r) => r.id));

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["calendar-tournaments"] });
    qc.invalidateQueries({ queryKey: ["class-schedules"] });
    qc.invalidateQueries({ queryKey: ["admin-events"] });
    qc.invalidateQueries({ queryKey: ["announcement-refs"] });
  };

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("announcements").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`Deleted ${count(n, "announcement")}`);
      setSelected(new Set());
      setConfirming(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const warnings = confirming ? warningsFor(confirming, refsQ.data) : [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xl font-bold uppercase">Manage Announcements</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit a title or body in place, or delete announcements that are done with. Deleting is
          permanent.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Label className="text-xs" htmlFor="ann-filter-category">
              Category
            </Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setSelected(new Set()); }}>
              <SelectTrigger id="ann-filter-category" className="mt-1 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="school_news">School News</SelectItem>
                <SelectItem value="tournament">Tournaments</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs" htmlFor="ann-filter-before">
              Posted before
            </Label>
            <Input
              id="ann-filter-before"
              type="date"
              value={before}
              onChange={(e) => { setBefore(e.target.value); setSelected(new Set()); }}
              className="mt-1 h-11"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank for everything. Useful for clearing out last season.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/40 text-primary">
            {count(rows.length, "announcement")}
          </Badge>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button
                variant="outline"
                className="h-11 text-destructive-foreground"
                onClick={() => setConfirming(selectedRows)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete selected
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </>
          )}
        </div>

        <div className="mt-5 grid gap-3">
          {listQ.isLoading && <p className="text-sm text-muted-foreground">Loading announcements…</p>}
          {!listQ.isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing matches those filters.
            </p>
          )}
          {rows.map((row) => (
            <ManageRow
              key={row.id}
              row={row}
              refs={refsQ.data?.get(row.id) ?? []}
              checked={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
              onDelete={() => setConfirming([row])}
              onSaved={invalidate}
            />
          ))}
          {hasMore && (
            <Button
              variant="outline"
              className="mt-2 justify-self-center"
              onClick={() => setLimit((n) => n + ADMIN_PAGE_SIZE)}
              disabled={listQ.isFetching}
            >
              {listQ.isFetching ? "Loading…" : "Load older announcements"}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming && confirming.length === 1
                ? `Delete “${confirming[0]!.title}”?`
                : `Delete ${count(confirming?.length ?? 0, "announcement")}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This cannot be undone — parents will no longer see it in the feed.</p>
                {confirming && confirming.length > 1 && (
                  <ul className="list-disc pl-5 text-sm">
                    {confirming.map((r) => (
                      <li key={r.id}>{r.title}</li>
                    ))}
                  </ul>
                )}
                {warnings.map((w) => (
                  <p key={w} className="text-sm font-semibold text-primary">
                    {w}
                  </p>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirming && remove.mutate(confirming.map((r) => r.id))}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ManageRow({
  row,
  refs,
  checked,
  onToggle,
  onDelete,
  onSaved,
}: {
  row: AnnouncementRow;
  refs: Reference[];
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);
  const [editPinned, setEditPinned] = useState(row.pinned);
  /**
   * publish_at is a timestamptz, so it is edited as a gym-time (America/Chicago)
   * date + time and converted explicitly — never through the date-only helpers.
   */
  const [editScheduled, setEditScheduled] = useState(!!row.publish_at);
  const initial = row.publish_at ? instantToChicago(row.publish_at) : null;
  const [editDate, setEditDate] = useState(initial?.date ?? "");
  const [editTime, setEditTime] = useState(initial?.time ?? "09:00");

  const scheduledNow = isScheduled(row.publish_at);

  /**
   * A linked event that was hidden until publish must move WITH the post. If the
   * post is pushed back and the event keeps the old instant, the date surfaces on
   * the calendar while the post is still hidden — the exact leak the
   * hide-until-publish checkbox exists to prevent. Only events that are actually
   * hidden (publish_at NOT NULL) are touched; an event deliberately left visible
   * stays visible.
   */
  const moveHiddenLinkedEvents = async (publishAt: string | null) => {
    const { error } = await supabase
      .from("events")
      .update({ publish_at: publishAt })
      .eq("announcement_id", row.id)
      .not("publish_at", "is", null);
    if (error) throw error;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("A title is required.");
      if (!body.trim()) throw new Error("A body is required.");
      if (editScheduled && !editDate) throw new Error("Pick the date this post should go live.");
      const publishAt = editScheduled ? chicagoToInstant(editDate, editTime) : null;
      const { error } = await supabase
        .from("announcements")
        .update({ title: title.trim(), body: body.trim(), pinned: editPinned, publish_at: publishAt })
        .eq("id", row.id);
      if (error) throw error;
      await moveHiddenLinkedEvents(publishAt);
    },
    onSuccess: () => {
      toast.success("Announcement updated");
      setEditing(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Round 34: staff pinning replaced the automatic "Latest" marker. */
  const togglePin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("announcements")
        .update({ pinned: !row.pinned })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(row.pinned ? "Unpinned" : "Pinned to the top of the feed");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Publish now = clear the schedule; RLS then shows it to parents immediately. */
  const publishNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("announcements")
        .update({ publish_at: null })
        .eq("id", row.id);
      if (error) throw error;
      await moveHiddenLinkedEvents(null);
    },
    onSuccess: () => {
      toast.success("Published — parents can see it now");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = () => {
    setTitle(row.title);
    setBody(row.body);
    setEditPinned(row.pinned);
    setEditScheduled(!!row.publish_at);
    setEditDate(initial?.date ?? "");
    setEditTime(initial?.time ?? "09:00");
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-1"
          aria-label={`Select ${row.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                row.category === "tournament"
                  ? "border-amber-400/50 text-amber-200"
                  : "border-border text-muted-foreground"
              }
            >
              {row.category === "tournament" ? (
                <>
                  <Trophy className="mr-1 h-3 w-3" aria-hidden="true" /> Tournament
                </>
              ) : (
                "School News"
              )}
            </Badge>
            {row.pinned && (
              <Badge variant="outline" className="border-primary/50 text-primary">
                <Pin className="mr-1 h-3 w-3" aria-hidden="true" /> Pinned
              </Badge>
            )}
            {scheduledNow ? (
              <Badge className="border-amber-400/60 bg-amber-500/15 text-amber-200" variant="outline">
                <CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" /> Scheduled ·{" "}
                {formatChicagoDateTime(row.publish_at!)}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-400/50 text-emerald-300">
                Live
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Posted {new Date(row.created_at).toLocaleDateString()}
              {row.event_date &&
                ` · event ${formatDateOnly(row.event_date)}`}
            </span>
          </div>

          {editing ? (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs" htmlFor={`ann-title-${row.id}`}>
                  Title
                </Label>
                <Input
                  id={`ann-title-${row.id}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor={`ann-body-${row.id}`}>
                  Body
                </Label>
                <Textarea
                  id={`ann-body-${row.id}`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={editPinned}
                  onChange={(e) => setEditPinned(e.target.checked)}
                />
                Pin to the top of the feed
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={editScheduled}
                  onChange={(e) => setEditScheduled(e.target.checked)}
                />
                Schedule for later (gym time, Central)
              </label>
              {editScheduled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs" htmlFor={`ann-sched-date-${row.id}`}>
                      Go live on
                    </Label>
                    <Input
                      id={`ann-sched-date-${row.id}`}
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="mt-1 h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`ann-sched-time-${row.id}`}>
                      At (gym time)
                    </Label>
                    <Input
                      id={`ann-sched-time-${row.id}`}
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="mt-1 h-11"
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">

                <Button
                  className="h-11 bg-gradient-red"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="outline" className="h-11" onClick={cancel}>
                  <X className="mr-1 h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="mt-2 font-display text-base font-bold uppercase break-words">
                {row.title}
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{row.body}</p>
              {refs.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Linked to{" "}
                  {refs
                    .map((r) => (r.kind === "event" ? `calendar event “${r.label}”` : `${r.label} belt test`))
                    .join(", ")}
                  .
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => togglePin.mutate()}
                  disabled={togglePin.isPending}
                >
                  {row.pinned ? (
                    <>
                      <PinOff className="mr-1 h-4 w-4" /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="mr-1 h-4 w-4" /> Pin
                    </>
                  )}
                </Button>
                {scheduledNow && (
                  <Button
                    variant="outline"
                    className="h-11 border-amber-400/60 text-amber-200"
                    onClick={() => publishNow.mutate()}
                    disabled={publishNow.isPending}
                  >
                    <Send className="mr-1 h-4 w-4" />{" "}
                    {publishNow.isPending ? "Publishing…" : "Publish now"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-11 text-destructive-foreground"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
