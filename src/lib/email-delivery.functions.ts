import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Round 64 — staff-only "Email bounced / Marked as spam" marker.
 *
 * Order matters, exactly like parent-accounts.functions.ts: the caller's admin
 * role is verified through their OWN RLS-scoped client before the email SDK is
 * loaded or LOVABLE_API_KEY is read. The key is read inside the handler only and
 * never returned.
 *
 * Only matches against profiles the admin can already see are returned — never
 * the raw log, so no address outside this portal leaves the server.
 */

export type EmailDeliveryFlag = {
  profileId: string;
  kind: "bounced" | "complained";
  at: string;
};

export const getParentEmailDeliveryFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ flags: EmailDeliveryFlag[] }> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) throw new Error("Admins only");

    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("LOVABLE_API_KEY not set");
      const { listEmailLogs } = await import("@lovable.dev/email-js");
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      // The API filters on one event_type per request, so this is one batched
      // request per type (two in total) — never one per parent.
      const [bounced, complained] = await Promise.all(
        (["bounced", "complained"] as const).map((event_type) =>
          listEmailLogs({ event_type, since, limit: 100 }, { apiKey }),
        ),
      );

      const { data: profiles, error: profErr } = await context.supabase
        .from("profiles")
        .select("id, email");
      if (profErr) throw new Error(profErr.message);
      const byEmail = new Map<string, string>();
      for (const p of profiles ?? []) if (p.email) byEmail.set(p.email.toLowerCase(), p.id);

      // Newest event per profile wins (log is newest-first).
      const flags = new Map<string, EmailDeliveryFlag>();
      const events = [
        ...bounced.data.map((e) => ({ ...e, kind: "bounced" as const })),
        ...complained.data.map((e) => ({ ...e, kind: "complained" as const })),
      ];
      for (const e of events) {
        const id = byEmail.get((e.recipient ?? "").toLowerCase());
        if (!id) continue;
        const prev = flags.get(id);
        if (!prev || e.timestamp > prev.at) flags.set(id, { profileId: id, kind: e.kind, at: e.timestamp });
      }
      return { flags: [...flags.values()] };
    } catch (err) {
      // Never break the tab: log server-side and show no markers.
      console.error("[email-delivery] log lookup failed", err instanceof Error ? err.message : err);
      return { flags: [] };
    }
  });
