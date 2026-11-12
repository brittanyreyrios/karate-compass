import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PUBLIC_SITE_URL_KEY, isUsableUrl, publicSiteUrl, useAppSetting } from "@/lib/app-settings";

/**
 * Unclaimed students (Phase 2, staff only). ADMIN-ONLY component: claim codes
 * must never render on a parent-facing surface.
 */
export const UNCLAIMED_LABEL = "Unclaimed — no family yet";

type Profile = { id: string; email: string; family_name: string | null; archived_at?: string | null };
type UnclaimedStudent = {
  id: string;
  first_name: string;
  last_name: string;
  active: boolean;
  class_name: string;
  claim_code: string | null;
};

/** Signup link carried by the printed card; signup reads ?claim= in a later phase. */
export function claimSignupPath(code: string) {
  return `/auth?claim=${encodeURIComponent(code)}`;
}

export function UnclaimedBadge() {
  return (
    <Badge variant="outline" className="border-primary/60 text-primary">Unclaimed</Badge>
  );
}

export function UnclaimedTools({ student, profiles }: { student: UnclaimedStudent; profiles: Profile[] | undefined }) {
  return (
    <div className="mt-1.5 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{UNCLAIMED_LABEL}</span>
        {student.claim_code && (
          <span className="select-text rounded border border-border bg-card px-1.5 py-0.5 font-mono font-bold tracking-[0.2em]">
            <span className="sr-only">Claim code: </span>{student.claim_code}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <PrintInviteCardButton student={student} />
        <LinkToFamily student={student} profiles={profiles} />
      </div>
    </div>
  );
}

function PrintInviteCardButton({ student }: { student: UnclaimedStudent }) {
  const siteQ = useAppSetting(PUBLIC_SITE_URL_KEY);
  const configured = siteQ.data;
  const ok = isUsableUrl(configured) && !!student.claim_code;
  const url = ok ? publicSiteUrl(configured, claimSignupPath(student.claim_code!)) : "";
  const qrRef = useRef<HTMLDivElement>(null);

  const print = () => {
    if (!ok) {
      toast.error("Set the portal's public address in Settings before printing an invite card.");
      return;
    }
    const code = student.claim_code!;
    const qr = qrRef.current?.innerHTML ?? "";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { toast.error("Allow pop-ups to print the invite card."); return; }
    // Same card as the Signup QR tab: full encoded address, white QR tile, spaced code.
    w.document.write(`<!doctype html><html><head><title>Invite card — ${esc(student.first_name)}</title>
<style>body{font-family:Arial,sans-serif;text-align:center;padding:24px;color:#111}
.card{border:2px solid #111;border-radius:16px;padding:24px;max-width:340px;margin:auto}
h1{font-size:20px;text-transform:uppercase;margin:0 0 4px}.qr{background:#fff;padding:16px;display:inline-block}
.code{font-size:22px;font-weight:bold;letter-spacing:.3em;margin-top:12px}.url{font-size:11px;word-break:break-all;color:#444}</style></head>
<body><div class="card"><h1>Tiger's Den Martial Arts</h1><p>Welcome, <strong>${esc(student.first_name)}</strong>! Scan to join the parent portal.</p>
<div class="qr">${qr}</div><div class="code">${esc(code)}</div><p class="url">${esc(url)}</p></div>
<script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={print} disabled={!student.claim_code}>
        <Printer className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Print invite card
      </Button>
      {/* Hidden source for the printed QR; same component as the Signup QR tab. */}
      {url && (
        <div ref={qrRef} hidden aria-hidden="true">
          <QRCodeSVG value={url} size={220} includeMargin={false} />
        </div>
      )}
    </>
  );
}

function LinkToFamily({ student, profiles }: { student: UnclaimedStudent; profiles: Profile[] | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [chosen, setChosen] = useState<Profile | null>(null);
  const rolesQ = useQuery({
    queryKey: ["admin-guardian-role-rows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    const parents = new Set<string>();
    const admins = new Set<string>();
    for (const r of rolesQ.data ?? []) (r.role === "admin" ? admins : parents).add(r.user_id);
    return (profiles ?? [])
      .filter((p) => parents.has(p.id) && !admins.has(p.id) && !p.archived_at)
      .filter((p) => `${p.email} ${p.family_name ?? ""}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [term, profiles, rolesQ.data]);

  // Same server step as every family move, so the guardian sync trigger runs and
  // belt, points and attendance stay on the student row.
  const link = useMutation({
    mutationFn: async (p: Profile) => {
      const { data, error } = await supabase.rpc("admin_reassign_student", {
        _student_id: student.id,
        _new_parent_email: p.email,
      });
      if (error) throw error;
      return data as unknown as { student_name: string; new_family_name: string };
    },
    onSuccess: (res) => {
      toast.success(`${res.student_name} linked to the ${res.new_family_name} family`);
      for (const k of ["admin-students", "admin-profiles", "admin-guardian-links", "admin-student-counts-by-parent", "admin-student-photo-consent"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      setChosen(null); setTerm(""); setOpen(false);
    },
    onError: (e: Error) => { setChosen(null); toast.error(e.message); },
  });

  return (
    <>
      {!open ? (
        <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={() => setOpen(true)}>
          <Users className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Link to existing family
        </Button>
      ) : (
        <div className="w-full rounded-lg border border-border bg-card p-3">
          <Label htmlFor={`claim-link-${student.id}`} className="text-xs">Find the family for {student.first_name}</Label>
          <Input id={`claim-link-${student.id}`} type="search" autoComplete="off" className="mt-1 h-11"
            placeholder="Family name or email" value={term} onChange={(e) => setTerm(e.target.value)} />
          <ul className="mt-2 space-y-1">
            {term.trim().length >= 2 && results.length === 0 && (
              <li className="text-muted-foreground">No family accounts match.</li>
            )}
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setChosen(p)}
                  className="min-h-11 w-full break-all rounded-md border border-border px-3 py-2 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="font-semibold">{p.family_name || "—"} family</span> · {p.email}
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2 h-11 sm:h-9" onClick={() => { setOpen(false); setTerm(""); }}>Cancel</Button>
        </div>
      )}
      <AlertDialog open={!!chosen} onOpenChange={(o) => { if (!o && !link.isPending) setChosen(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link {student.first_name} {student.last_name} to the {chosen?.family_name || chosen?.email} family?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{chosen?.email} will become {student.first_name}'s main family and see them in the parent portal. The claim code stops working.</p>
                <p>{student.first_name} keeps their belt, Dojo Points and full attendance history.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={link.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={link.isPending} onClick={(e) => { e.preventDefault(); if (chosen) link.mutate(chosen); }}>
              {link.isPending ? "Linking…" : "Link to family"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
