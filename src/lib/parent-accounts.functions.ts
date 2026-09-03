import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Parent-account lifecycle: archive → restore → delete. Admin-only, server-side.
 *
 * Why these live in a server function rather than a client write:
 *  - `profiles` has no admin UPDATE policy (only "Users update own profile"), so
 *    archiving cannot be done from the browser without adding an RLS policy.
 *    This round deliberately changes no policy and no grant.
 *  - Deleting an `auth.users` row needs the service role. We use GoTrue's own
 *    Admin API (`auth.admin.deleteUser`) rather than `DELETE FROM auth.users`,
 *    so GoTrue's internal state (sessions, identities, refresh tokens, MFA)
 *    stays consistent and we never touch the `auth` schema in SQL.
 *
 * The caller's admin role is verified server-side, through the caller's OWN
 * RLS-scoped client, before any privileged client is loaded. A disabled button
 * is not a guard.
 */

async function assertAdmin(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown; error: unknown }> };
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Admins only");
}

export const setParentAccountArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string; archived: boolean }) => {
    if (!input?.profileId) throw new Error("profileId is required");
    return { profileId: input.profileId, archived: !!input.archived };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, family_name")
      .eq("id", data.profileId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!profile) throw new Error("Account not found");

    // Archiving is state only: it never touches auth settings, so the parent can
    // still sign in. It just hides the family from the admin's default view and
    // takes their students out of circulation the same way student archiving does.
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.profileId);
    if (profileErr) throw new Error(profileErr.message);

    const { data: touched, error: studentErr } = await supabaseAdmin
      .from("students")
      .update({ active: !data.archived })
      .eq("parent_id", data.profileId)
      .select("id");
    if (studentErr) throw new Error(studentErr.message);

    return {
      profileId: data.profileId,
      email: profile.email,
      archived: data.archived,
      studentsChanged: (touched ?? []).length,
    };
  });

export const deleteParentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string }) => {
    if (!input?.profileId) throw new Error("profileId is required");
    return { profileId: input.profileId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.profileId === context.userId) {
      throw new Error("You cannot delete your own account");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, family_name, archived_at")
      .eq("id", data.profileId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!profile) throw new Error("Account not found");
    if (!profile.archived_at) {
      throw new Error("Archive this account first — deletion is only possible from the archived state");
    }

    // THE refusal. Every row in `students` with this parent_id, regardless of
    // `active`: archiving an account sets its students inactive, so an
    // active-only count would wave an archived family straight through and
    // cascade-delete their entire history.
    const { data: kids, error: kidsErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, active")
      .eq("parent_id", data.profileId);
    if (kidsErr) throw new Error(kidsErr.message);

    if ((kids ?? []).length > 0) {
      const names = (kids ?? [])
        .map((k) => `${k.first_name} ${k.last_name}`.trim() + (k.active ? "" : " (archived)"))
        .join(", ");
      throw new Error(
        `Cannot delete this account: ${kids!.length} student record${kids!.length === 1 ? "" : "s"} still attached — ${names}. ` +
          `Move each student to another family first (Students → the student's card → “Move to another family”), or delete the student records themselves. ` +
          `Deleting this account would permanently destroy their attendance, Dojo Points, tournament results and consent history.`,
      );
    }

    // ORDER MATTERS. Nothing is transactional across Postgres and GoTrue, so we
    // remove the LOGIN first. If a later step then failed we are left with inert
    // orphan rows and nobody able to sign in — untidy, but safe. The reverse
    // order risks a working login whose profile and roles are gone, which is the
    // exact broken state this feature exists to prevent.
    //
    // Note: profiles.id and user_roles.user_id both reference auth.users with ON
    // DELETE CASCADE, so in the normal case step 1 already removes steps 2 and 3.
    // We still issue them explicitly and verify, so a missing cascade cannot
    // leave an orphan silently.
    const steps: { step: string; ok: boolean; detail?: string }[] = [];

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(data.profileId);
    steps.push({ step: "auth.users", ok: !authErr, detail: authErr?.message });
    if (authErr) {
      throw new Error(
        `Nothing was deleted: removing the login failed (${authErr.message}). The account is unchanged.`,
      );
    }

    const { error: profileDelErr } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", data.profileId);
    steps.push({ step: "profiles", ok: !profileDelErr, detail: profileDelErr?.message });

    const { error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.profileId);
    steps.push({ step: "user_roles", ok: !rolesErr, detail: rolesErr?.message });

    // Verify all three are actually gone and report honestly if not.
    const [{ data: profileLeft }, { data: rolesLeft }, { data: authLeft }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").eq("id", data.profileId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("id").eq("user_id", data.profileId),
      supabaseAdmin.auth.admin.getUserById(data.profileId).then(
        (r) => ({ data: r.error ? null : (r.data?.user ?? null) }),
        () => ({ data: null }),
      ),
    ]);

    const leftovers = [
      authLeft ? "the login" : null,
      profileLeft ? "the profile row" : null,
      (rolesLeft ?? []).length > 0 ? "role rows" : null,
    ].filter(Boolean) as string[];

    if (leftovers.length > 0) {
      throw new Error(
        `Partly deleted: the login was removed, but ${leftovers.join(" and ")} could not be. ` +
          `Nobody can sign in to this account, but leftover rows remain — tell an engineer. ` +
          steps
            .filter((s) => !s.ok)
            .map((s) => `${s.step}: ${s.detail}`)
            .join("; "),
      );
    }

    return {
      profileId: data.profileId,
      email: profile.email,
      familyName: profile.family_name,
      deleted: { authUser: true, profile: true, userRoles: true },
    };
  });
