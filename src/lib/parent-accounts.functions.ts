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

    // Round 63: only children this family archive actually deactivated are ever
    // reactivated by a family restore (deactivated_by_family_archive_at marks them).
    if (!data.archived) {
      // parent_id check: a child moved to another family meanwhile is never touched.
      const { data: touched, error: restoreErr } = await supabaseAdmin
        .from("students")
        .update({ active: true, deactivated_by_family_archive_at: null })
        .eq("parent_id", data.profileId)
        .not("deactivated_by_family_archive_at", "is", null)
        .select("id");
      if (restoreErr) throw new Error(restoreErr.message);
      return {
        profileId: data.profileId,
        email: profile.email,
        archived: false,
        studentsChanged: (touched ?? []).length,
        keptActive: [] as string[],
      };
    }

    const { data: kids, error: kidsErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name")
      .eq("parent_id", data.profileId)
      .eq("active", true);
    if (kidsErr) throw new Error(kidsErr.message);

    const kidIds = (kids ?? []).map((k) => k.id);
    const keepIds = new Set<string>();
    if (kidIds.length > 0) {
      // Another linked guardian, explicitly excluding the profile being archived,
      // whose own account is not archived.
      const { data: others, error: othersErr } = await supabaseAdmin
        .from("student_guardians")
        .select("student_id, profiles!inner(archived_at)")
        .in("student_id", kidIds)
        .neq("profile_id", data.profileId)
        .is("profiles.archived_at", null);
      if (othersErr) throw new Error(othersErr.message);
      for (const o of others ?? []) keepIds.add(o.student_id);
    }

    const toDeactivate = kidIds.filter((id) => !keepIds.has(id));
    let changed = 0;
    if (toDeactivate.length > 0) {
      // .eq("active", true) in the write itself: a child archived individually a
      // moment earlier is never stamped as deactivated by this family archive.
      const { data: touched, error: studentErr } = await supabaseAdmin
        .from("students")
        .update({ active: false, deactivated_by_family_archive_at: new Date().toISOString() })
        .in("id", toDeactivate)
        .eq("parent_id", data.profileId)
        .eq("active", true)
        .select("id");
      if (studentErr) throw new Error(studentErr.message);
      changed = (touched ?? []).length;
    }

    return {
      profileId: data.profileId,
      email: profile.email,
      archived: true,
      studentsChanged: changed,
      keptActive: (kids ?? []).filter((k) => keepIds.has(k.id)).map((k) => k.first_name),
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
          `Move each student to another family first (Manage Students → the student's card → “Move to another family”), or delete the student records themselves. ` +
          `Deleting this account would permanently destroy their attendance, Dojo Points, tournament results and consent history.`,
      );
    }

    // Round 58: a second-guardian link also counts. Deleting would cascade it
    // away silently, so name those children and ask for the link to go first.
    const { data: links, error: linksErr } = await supabaseAdmin
      .from("student_guardians")
      .select("student_id, students(first_name, last_name)")
      .eq("profile_id", data.profileId);
    if (linksErr) throw new Error(linksErr.message);
    if ((links ?? []).length > 0) {
      const names = (links ?? [])
        .map((l) => {
          const s = l.students as { first_name: string; last_name: string } | null;
          return s ? `${s.first_name} ${s.last_name}`.trim() : "a student";
        })
        .join(", ");
      throw new Error(
        `Cannot delete this account: it is still linked as a guardian of ${names}. ` +
          `Remove the guardian link first (Manage Students → the student's card → Guardians → Remove).`,
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

/**
 * Round 60 — change a parent's LOGIN email.
 *
 * Two emails exist: auth.users.email (the credential) and profiles.email (a
 * display copy). Changing only the copy hides the problem, so the auth record
 * goes first; the profile follows only once auth has succeeded. Nothing is
 * transactional across GoTrue and Postgres, so an auth-OK / profile-failed
 * result is reported loudly as OUT OF STEP and can be repaired by re-running
 * the same change (the duplicate check excludes the target account itself).
 */
export type ChangeEmailResult = {
  profileId: string;
  oldEmail: string;
  newEmail: string;
  outOfStep: string | null;
  auditError: string | null;
  notification: { sent: boolean; detail: string };
  pendingImports: { first_name: string; last_name: string }[];
  pendingGuardianLinks: { student_name: string }[];
};

export const changeParentEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string; newEmail: string }) => {
    if (!input?.profileId) throw new Error("profileId is required");
    return { profileId: input.profileId, newEmail: String(input.newEmail ?? "") };
  })
  .handler(async ({ data, context }): Promise<ChangeEmailResult> => {
    await assertAdmin(context);
    const { isEmailWithTld, EMAIL_TLD_MESSAGE } = await import("@/lib/email-check");
    const newEmail = data.newEmail.trim().toLowerCase();
    if (!isEmailWithTld(newEmail)) throw new Error(EMAIL_TLD_MESSAGE);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, family_name")
      .eq("id", data.profileId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!profile) throw new Error("Account not found");

    const { data: staffRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.profileId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (staffRow) throw new Error("Staff accounts can't be changed here.");

    const { data: authUser, error: authReadErr } = await supabaseAdmin.auth.admin.getUserById(data.profileId);
    if (authReadErr || !authUser?.user) throw new Error(`Could not read the login record: ${authReadErr?.message ?? "not found"}`);
    const authEmail = (authUser.user.email ?? "").toLowerCase();
    const profileEmail = (profile.email ?? "").toLowerCase();

    if (authEmail === newEmail && profileEmail === newEmail) {
      throw new Error("That is already this account's email address — nothing to change.");
    }

    // Duplicate: any OTHER profile with this address (target excluded so an
    // out-of-step change can be re-run to completion).
    const { data: dupProfiles, error: dupErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, family_name")
      .ilike("email", newEmail)
      .neq("id", data.profileId);
    if (dupErr) throw new Error(dupErr.message);
    const dup = (dupProfiles ?? []).find((p) => (p.email ?? "").trim().toLowerCase() === newEmail);
    if (dup) {
      throw new Error(
        `${newEmail} already belongs to another account — the ${dup.family_name || "unnamed"} family (${dup.email}). ` +
          `This is a duplicate, not a fault: two accounts cannot share a login email.`,
      );
    }

    const oldEmail = authEmail || profileEmail;

    // Step 1 — the login. Skipped only when auth already holds the new address
    // (repairing an out-of-step change).
    if (authEmail !== newEmail) {
      const { data: upd, error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
        email: newEmail,
        email_confirm: true,
      });
      console.log("[r60] updateUserById", JSON.stringify({
        error: authErr ? { message: authErr.message, status: authErr.status, code: (authErr as { code?: string }).code } : null,
        user: upd?.user ? { id: upd.user.id, email: upd.user.email, email_confirmed_at: upd.user.email_confirmed_at, new_email: (upd.user as { new_email?: string }).new_email ?? null } : null,
      }));
      if (authErr) {
        const dupAuth = /already|registered|exists/i.test(authErr.message);
        throw new Error(
          dupAuth
            ? `Nothing was changed: ${newEmail} is already used as a login by another account.`
            : `Nothing was changed: the login update failed (${authErr.message}).`,
        );
      }
    }

    // Step 2 — the display copy.
    let outOfStep: string | null = null;
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", data.profileId);
    if (profErr) {
      outOfStep =
        `OUT OF STEP: the login is now ${newEmail}, but the admin panel still shows ${profile.email} (${profErr.message}). ` +
        `Run the same change again to finish it.`;
      console.error("[r60]", outOfStep);
    }

    // Step 3 — audit (change stands even if this fails; reported).
    let auditError: string | null = null;
    if (oldEmail !== newEmail) {
      const { error: aErr } = await supabaseAdmin.from("email_change_events").insert({
        target_user_id: data.profileId,
        old_email: oldEmail,
        new_email: newEmail,
        changed_by: context.userId,
      });
      if (aErr) auditError = aErr.message;
    }

    // Step 4 — collisions surfaced, never applied.
    const [{ data: imports }, { data: links }] = await Promise.all([
      supabaseAdmin.from("pending_student_imports").select("first_name, last_name, parent_email").ilike("parent_email", newEmail),
      supabaseAdmin.from("pending_guardian_links").select("email, students(first_name, last_name)").eq("email", newEmail),
    ]);

    // Step 5 — tell the parent. Failure is reported, never rolled back.
    let notification = { sent: false, detail: "" };
    try {
      const { sendLovableEmail } = await import("@lovable.dev/email-js");
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("email key not configured");
      const text =
        `Hello${profile.family_name ? ` ${profile.family_name} family` : ""},\n\n` +
        `Your Tiger's Den parent portal login email was updated by Tiger's Den staff. ` +
        `From now on, sign in with ${newEmail}. Your password has not changed.\n\n` +
        `If you didn't expect this change, please contact the Tiger's Den front desk.\n\n` +
        `https://portal.tigersdenmartialarts.com`;
      const html = `<div style="font-family:Arial,sans-serif;color:#111;font-size:15px;line-height:1.5">` +
        text.split("\n\n").map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("") + `</div>`;
      const res = await sendLovableEmail(
        {
          to: newEmail,
          from: "Tiger's Den Martial Arts & Fitness <noreply@notify.tigersdenmartialarts.com>",
          sender_domain: "notify.tigersdenmartialarts.com",
          subject: "Your Tiger's Den portal login email was updated",
          html,
          text,
          purpose: "transactional",
          label: "parent_email_changed",
          idempotency_key: `r60-${data.profileId}-${newEmail}-${Date.now()}`,
        },
        { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
      console.log("[r60] notification", JSON.stringify(res));
      notification = { sent: !!res?.success, detail: res?.message_id ?? res?.status ?? "" };
    } catch (e) {
      notification = { sent: false, detail: e instanceof Error ? e.message : String(e) };
      console.error("[r60] notification failed", notification.detail);
    }

    return {
      profileId: data.profileId,
      oldEmail,
      newEmail,
      outOfStep,
      auditError,
      notification,
      pendingImports: (imports ?? [])
        .filter((r) => r.parent_email.trim().toLowerCase() === newEmail)
        .map((r) => ({ first_name: r.first_name, last_name: r.last_name })),
      pendingGuardianLinks: (links ?? []).map((l) => {
        const s = l.students as { first_name: string; last_name: string } | null;
        return { student_name: s ? `${s.first_name} ${s.last_name}` : "a student" };
      }),
    };
  });
