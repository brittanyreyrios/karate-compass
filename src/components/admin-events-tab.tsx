import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Trash2, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CHIP_BASE, EVENT_TYPES, EVENT_TYPE_META, cleanDisciplines, type DojoEvent, type EventType } from "@/lib/calendar-data";
import { DisciplinePicker, DisciplineTags } from "@/components/discipline-tags";

type FormState = {
  title: string;
  description: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string;
  audience_label: string;
  published: boolean;
  postToAnnouncements: boolean;
  disciplines: string[];
};

const EMPTY: FormState = {
  title: "",
  description: "",
  event_type: "special_class",
  starts_at: "",
  ends_at: "",
  all_day: false,
  location: "",
  audience_label: "",
  published: true,
  postToAnnouncements: false,
  disciplines: [],
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function announcementPayload(form: FormState) {
  return {
    category: form.event_type === "tournament" ? "tournament" : "school_news",
    title: form.title.trim(),
    body: form.description.trim() || "Details coming soon.",
    location: form.location.trim() || null,
    event_date: form.starts_at ? form.starts_at.slice(0, 10) : null,
  };
}

export function EventsAdminTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DojoEvent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const eventsQ = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, description, event_type, starts_at, ends_at, all_day, location, audience_label, published, announcement_id, disciplines",
        )
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DojoEvent[];
    },
  });

  useEffect(() => {
    if (!editing) return;
    setForm({
      title: editing.title,
      description: editing.description ?? "",
      event_type: editing.event_type,
      starts_at: toLocalInput(editing.starts_at),
      ends_at: toLocalInput(editing.ends_at),
      all_day: editing.all_day,
      location: editing.location ?? "",
      audience_label: editing.audience_label ?? "",
      published: editing.published,
      postToAnnouncements: !!editing.announcement_id,
      disciplines: cleanDisciplines(editing.disciplines),
    });
  }, [editing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-events"] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["dashboard-events"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.starts_at) throw new Error("Title and start date/time are required.");

      const row = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        all_day: form.all_day,
        location: form.location.trim() || null,
        audience_label: form.audience_label.trim() || null,
        published: form.published,
        // No disciplines is a normal, valid state — a closure is not
        // discipline-specific — so it stores null rather than an empty array.
        disciplines: form.disciplines.length > 0 ? form.disciplines : null,
      };

      let eventId = editing?.id ?? null;
      let announcementId = editing?.announcement_id ?? null;

      if (eventId) {
        const { error } = await supabase.from("events").update(row).eq("id", eventId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert(row).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }

      // Linked-announcement lifecycle.
      if (form.postToAnnouncements) {
        if (announcementId) {
          const { error } = await supabase
            .from("announcements")
            .update(announcementPayload(form))
            .eq("id", announcementId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("announcements")
            .insert(announcementPayload(form))
            .select("id")
            .single();
          if (error) throw error;
          announcementId = data.id;
          const { error: linkError } = await supabase
            .from("events")
            .update({ announcement_id: announcementId })
            .eq("id", eventId);
          if (linkError) throw linkError;
        }
      } else if (announcementId) {
        const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
        if (error) throw error;
        const { error: unlinkError } = await supabase
          .from("events")
          .update({ announcement_id: null })
          .eq("id", eventId);
        if (unlinkError) throw unlinkError;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Event updated." : "Event created.");
      setEditing(null);
      setForm(EMPTY);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ event, alsoAnnouncement }: { event: DojoEvent; alsoAnnouncement: boolean }) => {
      if (event.announcement_id && alsoAnnouncement) {
        const { error } = await supabase.from("announcements").delete().eq("id", event.announcement_id);
        if (error) throw error;
      }
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = (event: DojoEvent) => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    let alsoAnnouncement = false;
    if (event.announcement_id) {
      alsoAnnouncement = window.confirm(
        "This event has a linked announcement.\n\nOK = delete the announcement too.\nCancel = keep the announcement.",
      );
    }
    remove.mutate({ event, alsoAnnouncement });
  };

  const events = eventsQ.data ?? [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <CalendarPlus className="h-4 w-4 text-primary" aria-hidden="true" />
          {editing ? "Edit event" : "New event"}
        </h2>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="event-type">Event type</Label>
            <select
              id="event-type"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value as EventType })}
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_META[type].label}
                </option>
              ))}
            </select>
          </div>

          <DisciplinePicker
            idPrefix="event"
            value={form.disciplines}
            onChange={(disciplines) => setForm({ ...form, disciplines })}
          />

          <div>
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-starts">Starts</Label>
              <Input
                id="event-starts"
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="event-ends">Ends (optional)</Label>
              <Input
                id="event-ends"
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="event-audience">Audience label (display only)</Label>
              <Input
                id="event-audience"
                placeholder="All families"
                value={form.audience_label}
                onChange={(e) => setForm({ ...form, audience_label: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.all_day}
                onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
              />
              All-day event
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Visible to families
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.postToAnnouncements}
                onChange={(e) => setForm({ ...form, postToAnnouncements: e.target.checked })}
              />
              Also post this to Announcements
            </label>
            <p className="text-xs text-muted-foreground">
              Unchecking this on a saved event deletes its linked announcement.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {editing ? "Save changes" : "Create event"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">Scheduled events</h2>
        {events.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No events yet.</p>}
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${CHIP_BASE} ${EVENT_TYPE_META[event.event_type].badge}`}>
                    {EVENT_TYPE_META[event.event_type].label}
                  </span>
                  <DisciplineTags disciplines={cleanDisciplines(event.disciplines)} />
                  {!event.published && (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      Hidden
                    </Badge>
                  )}
                  {event.announcement_id && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Link2 className="h-3 w-3" aria-hidden="true" /> Announced
                    </span>
                  )}
                </div>
                <div className="mt-2 font-display text-base font-bold uppercase tracking-wide">{event.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(event.starts_at).toLocaleString()}
                  {event.location ? ` · ${event.location}` : ""}
                  {event.audience_label ? ` · ${event.audience_label}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(event)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(event)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
