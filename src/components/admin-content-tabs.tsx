import { useEffect, useMemo, useState } from "react";
import {
  PUBLIC_SITE_URL_KEY,
  isUsableUrl,
  publicSiteUrl,
  useAppSetting,
} from "@/lib/app-settings";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Image as ImageIcon, BookOpen, Plus, Trash2, QrCode, Copy, Video, VideoOff, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { VideoShapePicker } from "@/components/video-shape-picker";
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
import { usePrograms } from "@/lib/enrollment";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /**
   * Round 17 — the programme (instructor's syllabus) this item belongs to.
   * NULL means "every programme": deliberately shared material.
   */
  program_id: string | null;
  curriculum_tier: CurriculumTier | null;
  technique: string;
  category: string | null;
  notes: string | null;
  sort_order: number;
  active: boolean;
  video_youtube_id: string | null;
  video_title: string | null;
  video_seconds: number | null;
  video_orientation: "landscape" | "portrait" | null;
};

type Target = "rank" | "tier";

/**
 * Round 17 — the programme choice, as three distinct states. "unset" exists so a
 * requirement can never be saved with an audience nobody chose: the belt system
 * does NOT imply a programme (Teen and Adult Karate share the Solid Belt system
 * with children's karate but are taught by a different instructor), so a default
 * would silently publish one instructor's material to another's students.
 */
const EVERY_PROGRAM = "__every__";
type ProgramChoice = string | null;

/**
 * The parent-facing consequence, in words a person who has never heard "tier" or
 * "programme" can check. Rendered live under the picker and in every edit row.
 */
function audienceSentence(opts: {
  target: Target;
  tier: CurriculumTier;
  rankName: string | null;
  systemName: string | null;
  usesBelts: boolean;
  programChoice: ProgramChoice;
  programName: string | null;
}) {
  const where =
    opts.programChoice === null
      ? null
      : opts.programChoice === EVERY_PROGRAM
        ? "in every class we teach"
        : `in ${opts.programName ?? "that"} classes`;
  if (!where) return null;

  if (opts.target === "tier") {
    return `Every ${TIER_LABELS[opts.tier].toLowerCase()}-level student ${where} will see this.`;
  }
  if (!opts.rankName) return null;
  const rankWord = opts.usesBelts ? "belt" : "level";
  return `Every student at ${opts.rankName} and above on the ${opts.systemName ?? ""} ${rankWord} ladder, ${where}, will see this.`;
}

export function CurriculumAdminTab() {
  const qc = useQueryClient();
  const systemsQ = useBeltSystems();
  const ranksQ = useBeltRanks();
  // Rank-pinned is the primary mechanism now that a rank's material stays in the
  // student's library as they advance; tier-wide is the exception. The system and
  // rank pickers deliberately survive a submit so adding a run of requirements
  // for one rank is not five clicks each.
  const [target, setTarget] = useState<Target>("rank");
  // Starts empty on purpose — see EVERY_PROGRAM above.
  const [programChoice, setProgramChoice] = useState<ProgramChoice>(null);
  const programsQ = usePrograms();

  const [tier, setTier] = useState<CurriculumTier>("beginner");
  const [systemId, setSystemId] = useState<string | null>(null);
  const [rankId, setRankId] = useState<string | null>(null);
  const [technique, setTechnique] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoMinutes, setVideoMinutes] = useState("");
  const [videoShape, setVideoShape] = useState<"landscape" | "portrait" | null>("landscape");

  const itemsQ = useQuery({
    queryKey: ["admin-curriculum-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curriculum_items")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CurriculumItem[];
    },
  });

  const ranks = ranksQ.data ?? [];
  const systems = systemsQ.data ?? [];
  const items = itemsQ.data ?? [];
  const programs = programsQ.data ?? [];
  const programName = (id: string | null) =>
    id ? (programs.find((p) => p.id === id)?.name ?? null) : null;

  const formSystem = systems.find((s) => s.id === systemId);
  const formRank = ranks.find((r) => r.id === rankId);
  const audience = audienceSentence({
    target,
    tier,
    rankName: formRank?.name ?? null,
    systemName: formSystem?.name ?? null,
    usesBelts: formSystem ? formSystem.uses_belts !== false : true,
    programChoice,
    programName: programChoice && programChoice !== EVERY_PROGRAM ? programName(programChoice) : null,
  });

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
      // Round 17: an unchosen programme is an ambiguous audience, never a default.
      if (!programChoice) throw new Error("Choose which classes this is for.");
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
      // A new requirement belongs at the END of its own group, not at position 0.
      // The next value is computed server-side under a per-group advisory lock so
      // two admins adding at the same moment cannot both claim the same slot.
      const { data: nextOrder, error: orderErr } = await supabase.rpc(
        "next_curriculum_sort_order",
        // The generated types type both args as non-null; the SQL function takes
        // NULL for whichever target is not in play.
        {
          _belt_rank_id: (target === "rank" ? rankId : null) as string,
          _curriculum_tier: (target === "tier" ? tier : null) as string,
        },
      );
      if (orderErr) throw orderErr;
      const { error } = await supabase.from("curriculum_items").insert({
        sort_order: nextOrder ?? 0,
        technique: technique.trim(),
        category: category.trim() || null,
        notes: notes.trim() || null,
        video_youtube_id: videoId,
        video_title: videoId ? videoTitle.trim() || null : null,
        video_seconds: videoId ? seconds : null,
        video_orientation: videoId ? videoShape : null,
        belt_rank_id: target === "rank" ? rankId : null,
        program_id: programChoice === EVERY_PROGRAM ? null : programChoice,
        curriculum_tier: target === "tier" ? tier : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Requirement added.");
      setTechnique(""); setCategory(""); setNotes("");
      setVideoLink(""); setVideoTitle(""); setVideoMinutes(""); setVideoShape("landscape");
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveVideo = useMutation({
    mutationFn: async (patch: {
      id: string;
      video_youtube_id: string | null;
      video_title: string | null;
      video_seconds: number | null;
      video_orientation: "landscape" | "portrait" | null;
    }) => {
      const { id, ...fields } = patch;
      const { error } = await supabase.from("curriculum_items").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Video updated.");
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Round 17 — editing an existing item's audience. Same three states as the add
   * form; NULL in the database means "every programme".
   */
  const saveProgram = useMutation({
    mutationFn: async ({ id, program_id }: { id: string; program_id: string | null }) => {
      const { error } = await supabase
        .from("curriculum_items")
        .update({ program_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Audience updated.");
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-for-children"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Round 19 E — the wording of a posted requirement. The Add form collected
   * technique, category and notes and then froze them; this saves an edit on
   * blur, exactly like the technique library's Category field. An empty name is
   * refused by the caller, which reverts the input.
   */
  const saveText = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<Pick<CurriculumItem, "technique" | "category" | "notes">>;
    }) => {
      const { error } = await supabase.from("curriculum_items").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-for-children"] });
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

  /**
   * AO2 — moving an item to a different group MUST renumber it.
   *
   * sort_order is only meaningful within one group, so carrying the old number
   * across drops the item into an arbitrary position in its new list — commonly
   * position 0, i.e. ahead of material that is genuinely taught first. Worse, it
   * collides with whatever already holds that number, and the tie is then broken
   * alphabetically, which looks like the reorder arrows are broken.
   *
   * So a retarget claims a fresh end-of-list position from the same advisory-locked
   * function a brand-new requirement uses, in the same update as the new target.
   */
  const retargetItem = useMutation({
    mutationFn: async (next: {
      id: string;
      belt_rank_id: string | null;
      curriculum_tier: CurriculumTier | null;
    }) => {
      const { data: nextOrder, error: orderErr } = await supabase.rpc(
        "next_curriculum_sort_order",
        {
          _belt_rank_id: next.belt_rank_id as string,
          _curriculum_tier: next.curriculum_tier as string,
        },
      );
      if (orderErr) throw orderErr;
      const { error } = await supabase
        .from("curriculum_items")
        .update({
          belt_rank_id: next.belt_rank_id,
          curriculum_tier: next.curriculum_tier,
          sort_order: nextOrder ?? 0,
        })
        .eq("id", next.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Moved to the end of its new group.");
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-for-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  /**
   * Reordering is GROUP-SCOPED: the caller only ever hands us two adjacent rows
   * from the same rendered group (one rank, or one tier), so an item can never
   * drift into another rank's list. Both rows' sort_order values are swapped and
   * written in ONE round trip; on failure we refetch so the screen can never show
   * an order the database does not have.
   */
  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: CurriculumItem; b: CurriculumItem }) => {
      const { error } = await supabase.from("curriculum_items").upsert([
        { ...a, sort_order: b.sort_order },
        { ...b, sort_order: a.sort_order },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
      qc.invalidateQueries({ queryKey: ["curriculum-for-children"] });
    },
    onError: (e: Error) => {
      toast.error(`Could not save the new order: ${e.message}`);
      qc.invalidateQueries({ queryKey: ["admin-curriculum-items"] });
    },
  });

  const legacy = items.filter((i) => !i.belt_rank_id && !i.curriculum_tier);

  /** The same plain-English sentence as the add form, for a saved item. */
  const rowAudience = (it: CurriculumItem) => {
    const rank = ranks.find((r) => r.id === it.belt_rank_id);
    const system = systems.find((s) => s.id === rank?.system_id);
    if (!rank && !it.curriculum_tier) return "Not shown to anyone yet.";
    return (
      audienceSentence({
        target: rank ? "rank" : "tier",
        tier: (it.curriculum_tier ?? "beginner") as CurriculumTier,
        rankName: rank?.name ?? null,
        systemName: system?.name ?? null,
        usesBelts: system ? system.uses_belts !== false : true,
        programChoice: it.program_id ?? EVERY_PROGRAM,
        programName: programName(it.program_id),
      }) ?? ""
    );
  };



  /**
   * `group` is the ordered list this row lives in. Up/Down are plain buttons with
   * real labels and 44px targets — the whole reorder is keyboard- and screen
   * reader-operable without any drag interaction.
   */
  const ItemRow = ({ it, group }: { it: CurriculumItem; group: CurriculumItem[] }) => {
    const index = group.findIndex((g) => g.id === it.id);
    const prev = index > 0 ? group[index - 1] : undefined;
    const next = index >= 0 && index < group.length - 1 ? group[index + 1] : undefined;
    return (
    <li className="rounded-lg border border-border bg-background/50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="mr-2 text-xs font-semibold tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium">{it.technique}</span>
          {it.category && <span className="ml-2 text-xs text-muted-foreground">{it.category}</span>}
          <Badge variant="outline" className="ml-2 border-border text-xs">
            {programName(it.program_id) ?? "Every programme"}
          </Badge>
          {it.video_youtube_id && (
            <Badge variant="outline" className="ml-2 gap-1 border-border text-xs">
              <Video className="h-3 w-3" aria-hidden="true" />
              Video
              {formatRuntime(it.video_seconds) ? ` · ${formatRuntime(it.video_seconds)}` : ""}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label={`Move ${it.technique} up`}
            disabled={!prev || reorder.isPending}
            onClick={() => prev && reorder.mutate({ a: it, b: prev })}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label={`Move ${it.technique} down`}
            disabled={!next || reorder.isPending}
            onClick={() => next && reorder.mutate({ a: it, b: next })}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label={`Delete requirement ${it.technique}`}
            onClick={() => removeItem.mutate(it.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Label className="text-xs" htmlFor={`prog-${it.id}`}>
          Who sees this
        </Label>
        <Select
          value={it.program_id ?? EVERY_PROGRAM}
          disabled={saveProgram.isPending}
          onValueChange={(v) =>
            saveProgram.mutate({ id: it.id, program_id: v === EVERY_PROGRAM ? null : v })
          }
        >
          <SelectTrigger id={`prog-${it.id}`} className="h-9 w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EVERY_PROGRAM}>Every programme (shared)</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} classes only
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{rowAudience(it)}</span>
      </div>

      {/* Round 19 E — retargeting, on EVERY row rather than only orphans. The
          value is bound so a row already pinned to a rank or tier reads as such
          instead of showing a placeholder, and the options are still only ranks
          and tiers, so rank/tier stay mutually exclusive and neither can be
          cleared to nothing. It calls the existing advisory-locked retargetItem
          mutation unchanged — the renumbering logic is not duplicated here. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Label className="text-xs" htmlFor={`retarget-${it.id}`}>
          Move to
        </Label>
        <Select
          value={
            it.belt_rank_id
              ? `rank:${it.belt_rank_id}`
              : it.curriculum_tier
                ? `tier:${it.curriculum_tier}`
                : undefined
          }
          disabled={retargetItem.isPending}
          onValueChange={(v) =>
            retargetItem.mutate(
              v.startsWith("tier:")
                ? {
                    id: it.id,
                    belt_rank_id: null,
                    curriculum_tier: v.slice(5) as CurriculumTier,
                  }
                : { id: it.id, belt_rank_id: v.slice(5), curriculum_tier: null },
            )
          }
        >
          <SelectTrigger id={`retarget-${it.id}`} className="h-11 w-64">
            <SelectValue placeholder="Choose a rank or tier" />
          </SelectTrigger>
          <SelectContent>
            {CURRICULUM_TIERS.map((t) => (
              <SelectItem key={t} value={`tier:${t}`}>
                All {TIER_LABELS[t]} students
              </SelectItem>
            ))}
            {ranks.map((r) => (
              <SelectItem key={r.id} value={`rank:${r.id}`}>
                {r.name}
                {systems.find((s) => s.id === r.system_id)
                  ? ` · ${systems.find((s) => s.id === r.system_id)!.name}`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs" htmlFor={`ci-t-${it.id}`}>
            Requirement
          </Label>
          <Input
            id={`ci-t-${it.id}`}
            className="h-11"
            defaultValue={it.technique}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) {
                e.target.value = it.technique;
                toast.error("A requirement needs a name.");
                return;
              }
              if (v !== it.technique) saveText.mutate({ id: it.id, values: { technique: v } });
            }}
          />
        </div>
        <div>
          <Label className="text-xs" htmlFor={`ci-c-${it.id}`}>
            Category
          </Label>
          <Input
            id={`ci-c-${it.id}`}
            className="h-11"
            defaultValue={it.category ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (it.category ?? "")) {
                saveText.mutate({ id: it.id, values: { category: v || null } });
              }
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs" htmlFor={`ci-n-${it.id}`}>
            Notes
          </Label>
          <Textarea
            id={`ci-n-${it.id}`}
            rows={2}
            defaultValue={it.notes ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (it.notes ?? "")) {
                saveText.mutate({ id: it.id, values: { notes: v || null } });
              }
            }}
          />
        </div>
      </div>

      <ItemVideoEditor
        item={it}
        pending={saveVideo.isPending}
        onSave={(patch) => saveVideo.mutate({ id: it.id, ...patch })}
      />
    </li>
    );
  };


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

            {/* Round 17 — which instructor's students. Deliberately no default:
                Teen and Adult Karate share the Solid Belt ladder with the
                children's classes but are taught separately, so the belt does
                not tell us which classes the material is for. */}
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="cur-program">Which classes</Label>
              <Select
                value={programChoice ?? ""}
                onValueChange={(v) => setProgramChoice(v)}
              >
                <SelectTrigger id="cur-program">
                  <SelectValue placeholder="Choose the classes this is for" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVERY_PROGRAM}>Every programme (shared material)</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} classes only
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p
              aria-live="polite"
              className={`mt-3 rounded-lg border p-2 text-xs ${
                audience
                  ? "border-border bg-background text-foreground"
                  : "border-dashed border-border text-muted-foreground"
              }`}
            >
              {audience ??
                "Pick a rank (or tier) and the classes above, and this will tell you exactly who sees it."}
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
            <div className="mt-3">
              <VideoShapePicker id="cur-video-shape" value={videoShape} onChange={setVideoShape} />
            </div>
          </fieldset>
          <Button
            type="submit"
            disabled={addItem.isPending || !audience}
            className="w-full bg-gradient-red"
          >
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
            {list.length > 0 && <ul className="mt-3 space-y-2">{list.map((it) => <ItemRow key={it.id} it={it} group={list} />)}</ul>}
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
              <ul className="mt-3 space-y-2">{list.map((it) => <ItemRow key={it.id} it={it} group={list} />)}</ul>
            </div>
          );
        })}

        {legacy.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide">Untargeted (legacy)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              These rows are not shown to any family because they are not attached to a rank or a
              tier. Point each one at a group below — it is renumbered to the end of that group, so
              it never lands ahead of material taught earlier.
            </p>
            {/* Round 19 E — the "Move to" control now lives inside ItemRow for
                every requirement, so this block must NOT render a second copy of
                it. Orphans get it from the row itself, with no bound value. */}
            <ul className="mt-3 space-y-2">
              {legacy.map((it) => (
                <li key={it.id} className="rounded-xl border border-border bg-background p-2">
                  <ItemRow it={it} group={legacy} />
                </li>
              ))}
            </ul>

          </div>

        )}
      </div>
    </div>
  );
}


/**
 * Confirmation before saving: staff see the exact video they pasted, so a wrong
 * copy/paste is caught here rather than by a parent finding the wrong technique.
 * YouTube titles cannot be read without an API key, so the title stays manual.
 */
function VideoIdPreview({ link }: { link: string }) {
  const trimmed = link.trim();
  if (!trimmed) return null;
  const id = extractYouTubeId(trimmed);
  if (!id) {
    return (
      <p className="mt-2 flex items-start gap-2 text-xs text-destructive">
        <VideoOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {YOUTUBE_LINK_ERROR}
      </p>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-3">
      <img
        src={youTubeThumbnail(id)}
        alt={`Thumbnail for video ${id}`}
        className="h-14 w-24 shrink-0 rounded border border-border object-cover"
      />
      <span className="text-xs text-muted-foreground">
        Video ID <code className="font-mono text-foreground">{id}</code>
      </span>
    </div>
  );
}

function ItemVideoEditor({
  item,
  pending,
  onSave,
}: {
  item: CurriculumItem;
  pending: boolean;
  onSave: (patch: {
    video_youtube_id: string | null;
    video_title: string | null;
    video_seconds: number | null;
    video_orientation: "landscape" | "portrait" | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(item.video_youtube_id ?? "");
  const [title, setTitle] = useState(item.video_title ?? "");
  const [minutes, setMinutes] = useState(
    item.video_seconds ? String(Math.round((item.video_seconds / 60) * 10) / 10) : "",
  );
  const [shape, setShape] = useState<"landscape" | "portrait" | null>(
    item.video_orientation ?? "landscape",
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs font-semibold text-primary underline underline-offset-4"
      >
        {item.video_youtube_id ? "Edit video" : "Add video"}
      </button>
    );
  }

  const submit = () => {
    if (!link.trim()) {
      onSave({ video_youtube_id: null, video_title: null, video_seconds: null, video_orientation: null });
      setOpen(false);
      return;
    }
    const id = extractYouTubeId(link);
    if (!id) {
      toast.error(YOUTUBE_LINK_ERROR);
      return;
    }
    const seconds = minutes.trim() ? Math.round(Number(minutes) * 60) : null;
    if (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0)) {
      toast.error("Video length must be a number of minutes, e.g. 1.5");
      return;
    }
    onSave({
      video_youtube_id: id,
      video_title: title.trim() || null,
      video_seconds: seconds,
      video_orientation: shape,
    });
    setOpen(false);
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-card p-3">
      <Label htmlFor={`vid-${item.id}`} className="text-xs">
        YouTube link for “{item.technique}”
      </Label>
      <Input
        id={`vid-${item.id}`}
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=…"
      />
      <VideoIdPreview link={link} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title (optional)"
          aria-label={`Video title for ${item.technique}`}
        />
        <Input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          inputMode="decimal"
          placeholder="Length in minutes (optional)"
          aria-label={`Video length in minutes for ${item.technique}`}
        />
      </div>
      <VideoShapePicker id={`shape-${item.id}`} value={shape} onChange={setShape} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submit} disabled={pending} className="bg-gradient-red">
          Save video
        </Button>
        {item.video_youtube_id && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setLink(""); setTitle(""); setMinutes("");
              onSave({ video_youtube_id: null, video_title: null, video_seconds: null, video_orientation: null });
              setOpen(false);
            }}
          >
            <VideoOff className="mr-1 h-4 w-4" aria-hidden="true" /> Remove video
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
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

  /**
   * BA3: the QR and the copyable link are built from the one configured public
   * address, never from `window.location.origin`. The old code baked whatever
   * host the admin's browser was on into a permanent printed artifact — an
   * editor-internal address that only worked for the person who made it.
   */
  const siteQ = useAppSetting(PUBLIC_SITE_URL_KEY);
  const configured = siteQ.data;
  const siteConfigured = isUsableUrl(configured);

  const codes = codesQ.data ?? [];
  const code = selected || codes[0]?.code || "";
  const signupUrl =
    siteConfigured && code
      ? publicSiteUrl(configured, `/auth?invite=${encodeURIComponent(code)}`)
      : "";

  /**
   * BA6: an admin generating a production QR from a preview session is doing the
   * right thing, so a mismatch is surfaced rather than blocked. Read after mount
   * only — the origin does not exist during SSR.
   */
  const [currentOrigin, setCurrentOrigin] = useState<string | null>(null);
  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);
  const configuredOrigin = (() => {
    if (!siteConfigured) return null;
    try {
      return new URL(configured!.trim()).origin;
    } catch {
      return null;
    }
  })();
  const originMismatch =
    !!signupUrl && !!currentOrigin && !!configuredOrigin && configuredOrigin !== currentOrigin;

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

        {/* BA4: no address means no link to copy either — the copy button carried
            the identical defect and texted the wrong host to individual families. */}
        {!siteConfigured ? (
          <p className="mt-4 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            Set the portal's public address in Settings before generating a QR code. A printed QR
            cannot be corrected afterwards.
          </p>
        ) : (
          signupUrl && (
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
          )
        )}
      </div>

      <div className="grid place-items-center rounded-2xl border border-border bg-card p-6">
        {!siteConfigured ? (
          <p className="text-sm text-muted-foreground">
            Set the portal's public address in Settings before generating a QR code. A printed QR
            cannot be corrected afterwards.
          </p>
        ) : signupUrl ? (
          <>
            {/* BA5: whoever prints the poster must be able to read the address
                without scanning it — full string, wrapping, no truncation. */}
            <p className="mb-4 max-w-full break-all text-center text-xs text-muted-foreground">
              This QR encodes: <span className="font-medium text-foreground">{signupUrl}</span>
            </p>
            <div className="rounded-xl bg-white p-5">
              <QRCodeSVG value={signupUrl} size={220} includeMargin={false} title={`Signup QR for invite code ${code}`} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Create an invite code first, then select it here.</p>
        )}
        {siteConfigured && code && (
          <p className="mt-4 font-display text-lg font-bold uppercase tracking-[0.3em]">{code}</p>
        )}
        {originMismatch && (
          <p className="mt-4 max-w-full break-all text-center text-xs text-muted-foreground">
            This QR points at {configured!.trim()}. You are currently viewing {currentOrigin}.
          </p>
        )}
      </div>
    </div>
  );
}

