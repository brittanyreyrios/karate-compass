import { createFileRoute } from "@tanstack/react-router";
// TEMPORARY Round 61 test-fixture setup. Deleted in the same round.
export const Route = createFileRoute("/api/public/zz-r61-setup")({
  server: { handlers: { POST: async ({ request }) => {
    const b = await request.json();
    if (b.token !== "8823b49861af91061b095867197fb21b") return new Response("no", { status: 401 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const neg = list.users.find((u) => u.email === "zz.test.negative@example.com");
    const r1 = neg ? await supabaseAdmin.auth.admin.updateUserById(neg.id, { password: b.p1 }) : { error: { message: "neg missing" } };
    const r2 = await supabaseAdmin.auth.admin.createUser({ email: "zz.test.secondary@example.com", password: b.p2, email_confirm: true,
      user_metadata: { family_name: "ZZ Test Secondary", invite_code: "ZZTEST54", photo_consent: false, media_release_version: "test" } });
    return Response.json({ neg: r1.error?.message ?? "ok", sec: r2.error?.message ?? r2.data.user?.id });
  } } },
});
