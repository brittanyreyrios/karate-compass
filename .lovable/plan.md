# Security fix: archived accounts lose access (awaiting approval)

Nothing has been applied. Database: one new migration in `drizzle/migrations/` (0022). Code: one file, `src/lib/parent-accounts.functions.ts`. No UI, no dependency changes.

## Pre-check: who reads the affected tables
Every read of announcements, events, polls, poll_options, curriculum_items, gallery_albums, class_schedules, belt_ranks, belt_systems, programs, class_holidays, dojo_point_guidelines and leaderboard_divisions lives in:
- signed-in pages under `src/routes/_authenticated/` (index, announcements, calendar, gallery, leaderboard, polls, curriculum, admin)
- staff components (`admin-*.tsx`) used only from the admin page
- helpers `lib/announcements.ts`, `belts.ts`, `enrollment.ts`, `scheduled-announcements.ts`, `polls.ts`, `technique-library.ts`, `tournament-results.ts`, imported only by those pages.

Signed-out pages (`auth`, `reset-password`, `terms`, `privacy-policy`, `media-release`, root) read none of them. The only server functions (`parent-accounts`, `email-delivery`) are admin-only and read none of them. Result: no signed-out visitor depends on these reads.

One profile is archived today (`fcf54c4c-…`).

## SQL (migration 0022_archived_accounts_lose_access)

```sql
-- 2. Guardian check also requires a non-archived caller.
CREATE OR REPLACE FUNCTION public.is_guardian_of(_student_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.student_guardians g
    JOIN public.students s ON s.id = g.student_id
    JOIN public.profiles p ON p.id = g.profile_id
    WHERE g.student_id = _student_id
      AND g.profile_id = auth.uid()
      AND s.parent_id IS NOT NULL
      AND p.archived_at IS NULL
  );
$function$;

-- 3a. Content tables: keep conditions, add active-member check to the non-admin path.
DROP POLICY "Signed in view published announcements" ON public.announcements;
CREATE POLICY "Signed in view published announcements" ON public.announcements FOR SELECT TO authenticated
  USING (((publish_at IS NULL OR publish_at <= now()) AND public.is_active_member()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Signed in view published events" ON public.events;
CREATE POLICY "Signed in view published events" ON public.events FOR SELECT TO authenticated
  USING ((published = true AND (publish_at IS NULL OR publish_at <= now()) AND public.is_active_member()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Signed in view published polls" ON public.polls;
CREATE POLICY "Signed in view published polls" ON public.polls FOR SELECT TO authenticated
  USING ((published = true AND public.is_active_member()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Signed in view options of visible polls" ON public.poll_options;
CREATE POLICY "Signed in view options of visible polls" ON public.poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
    AND ((p.published = true AND public.is_active_member()) OR public.has_role(auth.uid(), 'admin'::app_role))));

DROP POLICY "Signed in view active curriculum" ON public.curriculum_items;
CREATE POLICY "Signed in view active curriculum" ON public.curriculum_items FOR SELECT TO authenticated
  USING ((active = true AND public.is_active_member()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Signed in view active albums" ON public.gallery_albums;
CREATE POLICY "Signed in view active albums" ON public.gallery_albums FOR SELECT TO authenticated
  USING ((active = true AND public.is_active_member()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3b. class_schedules: two duplicate open policies become one.
DROP POLICY "Anyone authenticated can view class schedules" ON public.class_schedules;
DROP POLICY "Anyone signed in views schedules" ON public.class_schedules;
CREATE POLICY "Active members view class schedules" ON public.class_schedules FOR SELECT TO authenticated
  USING (public.is_active_member());

-- 3c. Reference tables: USING (true) -> active members (admins included via is_active_member).
DROP POLICY belt_ranks_select ON public.belt_ranks;
CREATE POLICY belt_ranks_select ON public.belt_ranks FOR SELECT TO authenticated USING (public.is_active_member());
DROP POLICY belt_systems_select ON public.belt_systems;
CREATE POLICY belt_systems_select ON public.belt_systems FOR SELECT TO authenticated USING (public.is_active_member());
DROP POLICY "Signed-in users can read programmes" ON public.programs;
CREATE POLICY "Signed-in users can read programmes" ON public.programs FOR SELECT TO authenticated USING (public.is_active_member());
DROP POLICY "Authenticated can view holidays" ON public.class_holidays;
CREATE POLICY "Authenticated can view holidays" ON public.class_holidays FOR SELECT TO authenticated USING (public.is_active_member());
DROP POLICY "Anyone signed in views guidelines" ON public.dojo_point_guidelines;
CREATE POLICY "Anyone signed in views guidelines" ON public.dojo_point_guidelines FOR SELECT TO authenticated USING (public.is_active_member());
DROP POLICY "Divisions readable by signed-in users" ON public.leaderboard_divisions;
CREATE POLICY "Divisions readable by signed-in users" ON public.leaderboard_divisions FOR SELECT TO authenticated USING (public.is_active_member());

-- 4. Read functions. Bodies identical to today except the marked guard.
CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
 RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text, pattern text, color_primary text, color_accent text, class_name text, period_points integer, uses_belts boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 WITH bounds AS (SELECT CASE WHEN _period='all_time' THEN '-infinity'::date ELSE public.points_period_start() END AS since)
 SELECT st.id,st.first_name,CASE WHEN st.last_name IS NULL OR btrim(st.last_name)='' THEN '' ELSE upper(left(btrim(st.last_name),1))||'.' END,
 r.name,COALESCE(r.short_name,r.name),r.pattern,r.color_primary,r.color_accent,st.class_name,COALESCE(pts.total,0)::integer,COALESCE(sy.uses_belts,false)
 FROM public.students st LEFT JOIN public.belt_ranks r ON r.id=st.belt_rank_id LEFT JOIN public.belt_systems sy ON sy.id=r.system_id
 LEFT JOIN (SELECT pe.student_id,SUM(pe.delta) AS total FROM public.point_events pe,bounds b WHERE pe.occurred_on>=b.since GROUP BY pe.student_id) pts ON pts.student_id=st.id
 WHERE public.is_active_member()  -- guard
   AND st.active=true AND st.parent_id IS NOT NULL AND _division=ANY(public.divisions_of(st.id)) AND COALESCE(pts.total,0)>0
 ORDER BY COALESCE(pts.total,0) DESC,st.first_name ASC LIMIT 10;
$function$;

CREATE OR REPLACE FUNCTION public.get_winners_circle(_limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, first_name text, last_initial text, event_name text, placement smallint, tournament_name text, tournament_date date, disciplines text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT tr.id,st.first_name,CASE WHEN st.last_name IS NULL OR btrim(st.last_name)='' THEN '' ELSE upper(left(btrim(st.last_name),1))||'.' END,tr.event_name,tr.placement,tr.tournament_name,tr.tournament_date,tr.disciplines
 FROM public.tournament_results tr JOIN public.students st ON st.id=tr.student_id
 WHERE public.is_active_member()  -- guard
   AND tr.featured=true AND st.active=true AND st.parent_id IS NOT NULL
 ORDER BY tr.tournament_date DESC,tr.tournament_name ASC,tr.placement ASC NULLS LAST,tr.event_name ASC LIMIT COALESCE(_limit,60);
$function$;

CREATE OR REPLACE FUNCTION public.get_technique_library()
 RETURNS TABLE(id uuid, program_id uuid, program_name text, label text, title text, category text, difficulty text, notes text, sort_order integer, published boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.program_id, pr.name, tl.label, tl.title,
         tl.category, tl.difficulty, tl.notes, tl.sort_order,
         tl.published, tl.video_youtube_id, tl.video_title, tl.video_seconds,
         tl.video_orientation
  FROM public.technique_library tl
  JOIN public.programs pr ON pr.id = tl.program_id
  WHERE
    public.has_role(auth.uid(), 'admin')
    OR (
      public.is_active_member()  -- guard
      AND tl.published = true
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.student_classes sc ON sc.student_id = s.id
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE public.is_guardian_of(s.id) AND s.active = true AND cs.program_id = tl.program_id
      )
    )
  ORDER BY tl.category, tl.sort_order, tl.title;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_division()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT public.division_of(s.id) FROM public.students s
 WHERE public.is_active_member()  -- guard
   AND public.is_guardian_of(s.id) AND s.parent_id IS NOT NULL AND s.active=true AND public.division_of(s.id) IS NOT NULL
 ORDER BY s.created_at LIMIT 1;
$function$;

-- get_poll_results: one guard line added after BEGIN; rest unchanged.
CREATE OR REPLACE FUNCTION public.get_poll_results(_poll_id uuid)
 RETURNS TABLE(option_id uuid, label text, vote_count integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_poll public.polls; v_is_admin boolean; v_has_voted boolean; v_closed boolean;
BEGIN
 IF NOT public.is_active_member() THEN RETURN; END IF;  -- guard
 SELECT * INTO v_poll FROM public.polls WHERE id=_poll_id;
 IF v_poll.id IS NULL OR (v_poll.published=false AND NOT public.has_role(auth.uid(),'admin')) THEN RETURN; END IF;
 v_is_admin:=public.has_role(auth.uid(),'admin');
 v_closed:=v_poll.closes_at IS NOT NULL AND v_poll.closes_at<=now();
 v_has_voted:=EXISTS(SELECT 1 FROM public.poll_votes v WHERE v.poll_id=_poll_id AND v.profile_id=auth.uid());
 IF NOT (v_is_admin OR v_poll.results_visible='always' OR (v_poll.results_visible='after_vote' AND v_has_voted) OR (v_poll.results_visible='after_close' AND v_closed)) THEN RETURN; END IF;
 RETURN QUERY SELECT o.id,o.label,(CASE WHEN v_poll.respond_per='student' THEN COUNT(DISTINCT v.student_id) ELSE COUNT(v.id) END)::integer
 FROM public.poll_options o LEFT JOIN public.poll_votes v ON v.option_id=o.id AND (v_is_admin OR v.student_id IS NULL OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=v.student_id AND s.parent_id IS NOT NULL))
 WHERE o.poll_id=_poll_id GROUP BY o.id,o.label,o.sort_order ORDER BY o.sort_order,o.label;
END;
$function$;
```

`get_curriculum_for_student`: the full current body (with its comments) is re-created verbatim, with one line inserted directly after `BEGIN`:
`IF NOT public.is_active_member() THEN RETURN; END IF;  -- guard`
so an archived caller gets no rows instead of the current "Not authorized" error.

`get_curriculum_for_all_children`: unchanged. Every row it returns comes from `WHERE public.is_guardian_of(s.id)`, which now returns false for an archived caller, so it already returns no rows. (Say if you want an explicit guard added anyway.)

`CREATE OR REPLACE` keeps existing execute grants; read-back will confirm.

## Code diff: `src/lib/parent-accounts.functions.ts`

```diff
@@ setParentAccountArchived handler, after reading the profile
-    // Archiving is state only: it never touches auth settings, so the parent can
-    // still sign in. ...
+    // Archiving bans sign-in; restoring lifts the ban. The auth change runs
+    // FIRST, so a failed ban/unban leaves the account exactly as it was.
+    const BAN_FOREVER = "876000h"; // ~100 years
+    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
+      ban_duration: data.archived ? BAN_FOREVER : "none",
+    });
+    if (banErr) throw new Error(data.archived
+      ? `Could not block sign-in, so the account was not archived: ${banErr.message}`
+      : `Could not restore sign-in, so the account was not restored: ${banErr.message}`);
     const { error: profileErr } = await supabaseAdmin
       .from("profiles")
       .update({ archived_at: ... })
       .eq("id", data.profileId);
-    if (profileErr) throw new Error(profileErr.message);
+    if (profileErr) {
+      // Undo the auth change so we never leave a half-archived account.
+      await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
+        ban_duration: data.archived ? "none" : BAN_FOREVER,
+      });
+      throw new Error(profileErr.message);
+    }
```

Plus a new admin-only function for step 6:

```ts
export const banArchivedParentAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles").select("id").not("archived_at", "is", null);
    if (error) throw new Error(error.message);
    const failed: string[] = [];
    for (const r of rows ?? []) {
      const { error: e } = await supabaseAdmin.auth.admin.updateUserById(r.id, { ban_duration: "876000h" });
      if (e) failed.push(r.id);
    }
    return { banned: (rows ?? []).length - failed.length, failed };
  });
```
It is idempotent and only touches profiles already archived. I'll run it once as the staff fixture; it is not wired to any button. Auth-schema SQL writes stay off-limits.

## Existing signed-in sessions
- Data: cut off immediately. Every read rule checks archived status on each request.
- Sign-in: a ban blocks new sign-ins and session renewal. The current sign-in token stays technically valid until it expires (up to 1 hour), but returns no data. I'll measure what the test parent's open session sees right after archiving.

## Tests (fixtures only: zz.test.negative parent, zzstaff)
a. Before: child, attendance, points, announcements, calendar, belt progress, leaderboard visible.
b. Archive via staff page; as parent: zero rows from students, attendance_events, point_events, announcements, class_schedules, belt_ranks; get_leaderboard empty; fresh sign-in refused.
c. Restore via staff page: (a) returns, sign-in works.
d. Staff checks throughout unchanged.
e. Signed out: all 13 tables return nothing.
Archiving the parent sets the permanent child inactive; restore reactivates it via the existing marker. I'll compare that child's full row with its baseline afterwards. End state: parent restored and unbanned.

Then: read back changed policies and functions, compare all other policies with baseline, run the quick scan (new vs existing, nothing dismissed), confirm package.json/bun.lock unchanged.
