import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Image as ImageIcon, BookOpen, Plus, Trash2, QrCode, Copy, Video, VideoOff } from "lucide-react";
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
import { BeltSwatch } from "@/components/belt-chip";
import {
  extractYouTubeId,
  formatRuntime,
  youTubeThumbnail,
  YOUTUBE_LINK_ERROR,
} from "@/lib/youtube";
import { BeltPicker } from "@/components/belt-picker";
import {
  CURRICULUM_TIERS,
  TIER_LABELS,
  useBeltRanks,
  useBeltSystems,
  type CurriculumTier,
} from "@/lib/belts";
import {
  coverSrc,
  deleteCoverObject,
  isExternalCover,
  uploadCover,
  useCoverUrls,
  validateCoverFile,
} from "@/lib/album-covers";

/* ------------------------------------------------------------------ */
/* Media Gallery albums                                                */
/* ------------------------------------------------------------------ */

type Album = {
  id: string;
  title: string;
  description: string | null;
  external_url: string;
  cover_image_url: string | null;
  event_date: string | null;
  sort_order: number;
  active: boolean;
};

export function GalleryAdminTab() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");

  const albumsQ = useQuery({
    queryKey: ["admin-gallery-albums"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_albums")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Album[];
    },
  });

  const albums = albumsQ.data ?? [];
  const coversQ = useCoverUrls(albums.map((a) => a.cover_image_url));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-gallery-albums"] });
    qc.invalidateQueries({ queryKey: ["gallery-albums"] });
  };

  const addAlbum = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Album title is required.");
      const { error } = await supabase.from("gallery_albums").insert({
        title: title.trim(),
        // external_url is NOT NULL — a link-less album stores an empty string,
        // which renders the "Photos coming soon" state on /gallery.
        external_url: url.trim(),
        cover_image_url: null,
        event_date: eventDate || null,
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Album published. Add a cover photo from the list on the right.");
      setTitle(""); setUrl(""); setEventDate(""); setDescription("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Save-on-blur: only writes when the value actually changed. */
  const patchAlbum = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Album> }) => {
      const { error } = await supabase.from("gallery_albums").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (a: Album) => {
      const { error } = await supabase.from("gallery_albums").update({ active: !a.active }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAlbum = useMutation({
    mutationFn: async (a: Album) => {
      const { error } = await supabase.from("gallery_albums").delete().eq("id", a.id);
      if (error) throw error;
      await deleteCoverObject(a.cover_image_url);
    },
    onSuccess: () => {
      toast.success("Album removed.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form
        className="rounded-2xl border border-border bg-card p-6"
        onSubmit={(e) => { e.preventDefault(); addAlbum.mutate(); }}
      >
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          <ImageIcon className="h-4 w-4 text-primary" aria-hidden="true" /> Add Album
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="album-title">Album title</Label>
            <Input id="album-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fall Belt Test 2026" />
          </div>
          <div>
            <Label htmlFor="album-url">Album link (optional)</Label>
            <Input id="album-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://photos.app.goo.gl/…" />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank for now — the album shows "Photos coming soon" until you add a link.
            </p>
          </div>
          <div>
            <Label htmlFor="album-date">Event date (optional)</Label>
            <Input id="album-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="album-desc">Description (optional)</Label>
            <Textarea id="album-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={addAlbum.isPending} className="w-full bg-gradient-red">
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> {addAlbum.isPending ? "Publishing…" : "Publish album"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Cover photos are uploaded from the album list once the album exists. Only families who opted
            in to photo sharing should appear in linked albums.
          </p>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Published Albums</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Edit any field below — changes save when you click away.
        </p>
        {albumsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading albums…</p>
        ) : albums.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No albums yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {albums.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {!a.active && <Badge variant="outline" className="text-muted-foreground">Hidden</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleActive.mutate(a)}>
                      {a.active ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete album ${a.title}`}
                      onClick={() => removeAlbum.mutate(a)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor={`t-${a.id}`}>Album title</Label>
                    <Input
                      id={`t-${a.id}`}
                      defaultValue={a.title}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) { e.target.value = a.title; return; }
                        if (v !== a.title) patchAlbum.mutate({ id: a.id, patch: { title: v } });
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`d-${a.id}`}>Event date</Label>
                    <Input
                      id={`d-${a.id}`}
                      type="date"
                      defaultValue={a.event_date ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value || null;
                        if (v !== (a.event_date ?? null)) patchAlbum.mutate({ id: a.id, patch: { event_date: v } });
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`o-${a.id}`}>Display order</Label>
                    <Input
                      id={`o-${a.id}`}
                      type="number"
                      defaultValue={a.sort_order}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v !== a.sort_order) {
                          patchAlbum.mutate({ id: a.id, patch: { sort_order: v } });
                        }
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`u-${a.id}`}>Album link</Label>
                    <Input
                      id={`u-${a.id}`}
                      defaultValue={a.external_url}
                      placeholder="https://photos.app.goo.gl/…"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== a.external_url) patchAlbum.mutate({ id: a.id, patch: { external_url: v } });
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`desc-${a.id}`}>Description</Label>
                    <Textarea
                      id={`desc-${a.id}`}
                      rows={2}
                      defaultValue={a.description ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (a.description ?? null)) patchAlbum.mutate({ id: a.id, patch: { description: v } });
                      }}
                    />
                  </div>
                </div>

                <AlbumCoverEditor album={a} signed={coversQ.data} onSaved={invalidate} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Upload / replace / remove one album's cover photo. */
function AlbumCoverEditor({
  album,
  signed,
  onSaved,
}: {
  album: Album;
  signed: Record<string, string> | undefined;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const src = coverSrc(album.cover_image_url, signed);

  const save = async (value: string | null, previous: string | null) => {
    const { error } = await supabase
      .from("gallery_albums")
      .update({ cover_image_url: value })
      .eq("id", album.id);
    if (error) throw error;
    // Cleanup is best-effort and never blocks the save.
    if (previous && previous !== value) await deleteCoverObject(previous);
    onSaved();
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateCoverFile(file);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const key = await uploadCover(album.id, file);
      await save(key, album.cover_image_url);
      toast.success("Cover photo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      await save(null, album.cover_image_url);
      toast.success("Cover photo removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that cover.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
          {src ? (
            <img src={src} alt={album.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`cover-${album.id}`}>Cover photo</Label>
          <Input
            id={`cover-${album.id}`}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = ""; }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {busy ? "Uploading…" : "JPG, PNG or WebP up to 5 MB. Large photos are resized automatically."}
          </p>
        </div>
        {album.cover_image_url && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void onRemove()}>
            Remove cover
          </Button>
        )}
      </div>

      <button
        type="button"
        className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
        onClick={() => setShowLink((v) => !v)}
      >
        {showLink ? "Hide link option" : "or paste a link to an already-hosted image"}
      </button>
      {showLink && (
        <Input
          className="mt-2"
          defaultValue={isExternalCover(album.cover_image_url) ? album.cover_image_url ?? "" : ""}
          placeholder="https://…/cover.jpg"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            const current = isExternalCover(album.cover_image_url) ? album.cover_image_url : null;
            if (v === current) return;
            void save(v, album.cover_image_url).then(
              () => toast.success("Cover photo updated."),
              (err: Error) => toast.error(err.message),
            );
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Belt curriculum items                                               */
/* ------------------------------------------------------------------ */

type CurriculumItem = {
  id: string;
  belt: string | null;
  belt_rank_id: string | null;
  curriculum_tier: CurriculumTier | null;
  technique: string;
  category: string | null;
  notes: string | null;
  sort_order: number;
  active: boolean;
  video_youtube_id: string | null;
  video_title: string | null;
  video_seconds: number | null;
};

type Target = "rank" | "tier";

export function CurriculumAdminTab() {
  const qc = useQueryClient();
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();
  // Rank-pinned is the primary mechanism now that a rank's material stays in the
  // student's library as they advance; tier-wide is the exception. The system and
  // rank pickers deliberately survive a submit so adding a run of requirements
  // for one rank is not five clicks each.
  const [target, setTarget] = useState<Target>("rank");

  const [tier, setTier] = useState<CurriculumTier>("beginner");
  const [systemId, setSystemId] = useState<string | null>(null);
  const [rankId, setRankId] = useState<string | null>(null);
  const [technique, setTechnique] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoMinutes, setVideoMinutes] = useState("");

  const itemsQ = useQuery({
    queryKey: ["admin-curriculum-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curriculum_items")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CurriculumItem[];
    },
  });

  const ranks = ranksQ.data ?? [];
  const systems = systemsQ.data ?? [];
  const items = itemsQ.data ?? [];

  const byTier = useMemo(
    () =>
      CURRICULUM_TIERS.map((t) => ({
        tier: t,
        items: items.filter((i) => i.curriculum_tier === t),
      })),
    [items],
  );

  const byRank = useMemo(
    () =>
      ranks
        .map((r) => ({ rank: r, items: items.filter((i) => i.belt_rank_id === r.id) }))
        .filter((g) => g.items.length > 0),
    [ranks, items],
  );

  const addItem = useMutation({
    mutationFn: async () => {
      if (!technique.trim()) throw new Error("Technique name is required.");
      // Exactly one of the two targets is set — the database enforces this too.
      if (target === "rank" && !rankId) throw new Error("Choose the specific rank this belongs to.");
      // A pasted link is validated here, before it can ever be saved: a bad ID
      // would render as a dead player for every family at that rank.
      let videoId: string | null = null;
      if (videoLink.trim()) {
        videoId = extractYouTubeId(videoLink);
        if (!videoId) throw new Error(YOUTUBE_LINK_ERROR);
      }
      const seconds = videoMinutes.trim() ? Math.round(Number(videoMinutes) * 60) : null;
      if (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0)) {
        throw new Error("Video length must be a number of minutes, e.g. 1.5");
      }
      const { error } = await supabase.from("curriculum_items").insert({
        technique: technique.trim(),
        category: category.trim() || null,
        notes: notes.trim() || null,
        video_youtube_id: videoId,
        video_title: videoId ? videoTitle.trim() || null : null,
        video_seconds: videoId ? seconds : null,
        belt_rank_id: target === "rank" ? rankId : null,
        curriculum_tier: target === "tier" ? tier : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Requirement added.");
      setTechnique(""); setCategory(""); setNotes("");
      setVideoLink(""); setVideoTitle(""); setVideoMinutes("");
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("curriculum_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const legacy = items.filter((i) => !i.belt_rank_id && !i.curriculum_tier);

  const ItemRow = ({ it }: { it: CurriculumItem }) => (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
      <div className="min-w-0">
        <span className="text-sm font-medium">{it.technique}</span>
        {it.category && <span className="ml-2 text-xs text-muted-foreground">{it.category}</span>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete requirement ${it.technique}`}
        onClick={() => removeItem.mutate(it.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
      </Button>
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form
        className="rounded-2xl border border-border bg-card p-6"
        onSubmit={(e) => { e.preventDefault(); addItem.mutate(); }}
      >
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" /> Add Requirement
        </h2>
        <div className="mt-4 space-y-3">
          <fieldset className="rounded-xl border border-border p-3">
            <legend className="px-1 text-xs uppercase tracking-widest text-muted-foreground">
              Who sees this
            </legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cur-target"
                  className="accent-primary"
                  checked={target === "rank"}
                  onChange={() => setTarget("rank")}
                />
                One specific rank
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cur-target"
                  className="accent-primary"
                  checked={target === "tier"}
                  onChange={() => setTarget("tier")}
                />
                A whole curriculum tier
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pinned to a rank: shows to that rank and stays in their library as they advance.
              Tier-wide: shows to every rank in that tier at once (Green, Purple and Blue are all
              Intermediate).
            </p>

          </fieldset>

          {target === "tier" ? (
            <div>
              <Label htmlFor="cur-tier">Curriculum tier</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as CurriculumTier)}>
                <SelectTrigger id="cur-tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRICULUM_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <BeltPicker
              idPrefix="cur"
              systemId={systemId}
              rankId={rankId}
              onChange={(next) => { setSystemId(next.systemId); setRankId(next.rankId); }}
            />
          )}

          <div>
            <Label htmlFor="cur-tech">Technique</Label>
            <Input id="cur-tech" required value={technique} onChange={(e) => setTechnique(e.target.value)} placeholder="Front kick (Ap Chagi)" />
          </div>
          <div>
            <Label htmlFor="cur-cat">Category (optional)</Label>
            <Input id="cur-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kicks / Forms / Self-defense" />
          </div>
          <div>
            <Label htmlFor="cur-notes">Notes (optional)</Label>
            <Textarea id="cur-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <fieldset className="rounded-xl border border-border p-3">
            <legend className="px-1 text-xs uppercase tracking-widest text-muted-foreground">
              Video (optional)
            </legend>
            <Label htmlFor="cur-video">YouTube link</Label>
            <Input
              id="cur-video"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Paste the address straight from your browser. Playlist and timestamp bits are stripped
              automatically.
            </p>
            <VideoIdPreview link={videoLink} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cur-video-title">Video title (optional)</Label>
                <Input
                  id="cur-video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cur-video-min">Length in minutes (optional)</Label>
                <Input
                  id="cur-video-min"
                  inputMode="decimal"
                  value={videoMinutes}
                  onChange={(e) => setVideoMinutes(e.target.value)}
                  placeholder="1.5"
                />
              </div>
            </div>
          </fieldset>
          <Button type="submit" disabled={addItem.isPending} className="w-full bg-gradient-red">
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> {addItem.isPending ? "Saving…" : "Add requirement"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {byTier.map(({ tier: t, items: list }) => (
          <div key={t} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide">
                {TIER_LABELS[t]} tier
              </h3>
              <span className="text-xs text-muted-foreground">{list.length} requirements</span>
            </div>
            {list.length > 0 && <ul className="mt-3 space-y-2">{list.map((it) => <ItemRow key={it.id} it={it} />)}</ul>}
          </div>
        ))}

        {byRank.map(({ rank, items: list }) => {
          const system = systems.find((s) => s.id === rank.system_id);
          return (
            <div key={rank.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <BeltSwatch
                  name={rank.name}
                  pattern={rank.pattern}
                  colorPrimary={rank.color_primary}
                  colorAccent={rank.color_accent}
                  systemName={system?.name ?? null}
                  size="sm"
                />
                <h3 className="font-display text-lg font-bold uppercase tracking-wide">
                  {rank.name}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {system?.name} · {list.length} requirements
                </span>
              </div>
              <ul className="mt-3 space-y-2">{list.map((it) => <ItemRow key={it.id} it={it} />)}</ul>
            </div>
          );
        })}

        {legacy.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide">Untargeted (legacy)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              These rows predate the three belt systems and are not shown to any family. Delete and
              re-add them against a tier or a rank.
            </p>
            <ul className="mt-3 space-y-2">{legacy.map((it) => <ItemRow key={it.id} it={it} />)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Belt systems & ranks editor                                         */
/* ------------------------------------------------------------------ */

export function BeltSystemsAdminTab() {
  const qc = useQueryClient();
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();

  const saveRank = useMutation({
    mutationFn: async (patch: {
      id: string;
      color_primary?: string;
      color_accent?: string | null;
      curriculum_tier?: CurriculumTier;
    }) => {
      const { id, ...fields } = patch;
      const { error } = await supabase.from("belt_ranks").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Belt updated.");
      qc.invalidateQueries({ queryKey: ["belt-ranks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const systems = systemsQ.data ?? [];
  const ranks = ranksQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/40 bg-card p-5">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Belt Systems &amp; Colors</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Colors and curriculum tiers are editable here — no code change needed. Camo colors were
          seeded as a best guess; correct them to match your actual belts.
        </p>
      </div>

      {systems.map((sys) => (
        <section key={sys.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide">{sys.name}</h3>
            {sys.age_guidance && (
              <span className="text-xs text-muted-foreground">{sys.age_guidance} (guidance only)</span>
            )}
          </div>
          <ul className="mt-4 space-y-3">
            {ranks
              .filter((r) => r.system_id === sys.id)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-background/50 p-3"
                >
                  <div className="flex min-w-[180px] items-center gap-2">
                    <BeltSwatch
                      name={r.name}
                      pattern={r.pattern}
                      colorPrimary={r.color_primary}
                      colorAccent={r.color_accent}
                      systemName={sys.name}
                      size="sm"
                    />
                    <span className="text-sm font-semibold">{r.name}</span>
                  </div>

                  <div>
                    <Label htmlFor={`primary-${r.id}`} className="text-xs">
                      {r.pattern === "camo" ? "Camo base" : "Belt color"}
                    </Label>
                    <Input
                      id={`primary-${r.id}`}
                      type="color"
                      className="mt-1 h-9 w-20 p-1"
                      defaultValue={r.color_primary}
                      onBlur={(e) =>
                        e.target.value !== r.color_primary &&
                        saveRank.mutate({ id: r.id, color_primary: e.target.value })
                      }
                    />
                  </div>

                  {/* Solid ranks have no second colour — the field is unused there. */}
                  {r.pattern !== "solid" && (
                    <div>
                      <Label htmlFor={`accent-${r.id}`} className="text-xs">Stripe color</Label>
                      <Input
                        id={`accent-${r.id}`}
                        type="color"
                        className="mt-1 h-9 w-20 p-1"
                        defaultValue={r.color_accent ?? r.color_primary}
                        onBlur={(e) =>
                          e.target.value !== (r.color_accent ?? r.color_primary) &&
                          saveRank.mutate({ id: r.id, color_accent: e.target.value })
                        }
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor={`tier-${r.id}`} className="text-xs">Curriculum tier</Label>
                    <Select
                      value={r.curriculum_tier}
                      onValueChange={(v) => saveRank.mutate({ id: r.id, curriculum_tier: v as CurriculumTier })}
                    >
                      <SelectTrigger id={`tier-${r.id}`} className="mt-1 w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRICULUM_TIERS.map((t) => (
                          <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Invite QR generator                                                 */
/* ------------------------------------------------------------------ */

type InviteCode = { code: string; label: string | null; active: boolean; used_count: number; max_uses: number };

export function InviteQrTab() {
  const [selected, setSelected] = useState<string>("");

  const codesQ = useQuery({
    queryKey: ["admin-invite-codes-qr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("code, label, active, used_count, max_uses")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteCode[];
    },
  });

  const codes = codesQ.data ?? [];
  const code = selected || codes[0]?.code || "";
  const signupUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/auth?invite=${encodeURIComponent(code)}`
      : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
          <QrCode className="h-4 w-4 text-primary" aria-hidden="true" /> Signup QR Code
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick an invite code and print or text the QR. Scanning opens the signup page with the code
          already filled in.
        </p>
        <div className="mt-4">
          <Label htmlFor="qr-code">Invite code</Label>
          <Select value={code} onValueChange={setSelected}>
            <SelectTrigger id="qr-code"><SelectValue placeholder="Select an invite code" /></SelectTrigger>
            <SelectContent>
              {codes.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code}{c.label ? ` — ${c.label}` : ""} ({c.used_count}/{c.max_uses})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {signupUrl && (
          <div className="mt-4 flex items-center gap-2">
            <Input readOnly value={signupUrl} aria-label="Signup link with invite code" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy signup link"
              onClick={() => {
                navigator.clipboard.writeText(signupUrl);
                toast.success("Signup link copied.");
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid place-items-center rounded-2xl border border-border bg-card p-6">
        {signupUrl ? (
          <div className="rounded-xl bg-white p-5">
            <QRCodeSVG value={signupUrl} size={220} includeMargin={false} title={`Signup QR for invite code ${code}`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Create an invite code first, then select it here.</p>
        )}
        {code && <p className="mt-4 font-display text-lg font-bold uppercase tracking-[0.3em]">{code}</p>}
      </div>
    </div>
  );
}
