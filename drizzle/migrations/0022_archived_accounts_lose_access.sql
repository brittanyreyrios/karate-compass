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

DROP POLICY "Anyone authenticated can view class schedules" ON public.class_schedules;
DROP POLICY "Anyone signed in views schedules" ON public.class_schedules;
CREATE POLICY "Active members view class schedules" ON public.class_schedules FOR SELECT TO authenticated
  USING (public.is_active_member());

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

CREATE OR REPLACE FUNCTION public.get_curriculum_for_student(_student_id uuid)
 RETURNS TABLE(id uuid, technique text, category text, notes text, sort_order integer, belt_rank_id uuid, curriculum_tier text, rank_name text, group_label text, is_current boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parent uuid;
  v_rank uuid;
  v_tier text;
  v_system uuid;
  v_rank_order integer;
  v_tiers text[] := ARRAY['beginner', 'intermediate', 'advanced'];
BEGIN
  IF NOT public.is_active_member() THEN RETURN; END IF;  -- guard: archived callers get no rows

  SELECT s.parent_id, s.belt_rank_id INTO v_parent, v_rank
  FROM public.students s WHERE s.id = _student_id;

  IF v_parent IS NULL THEN
    RETURN;
  END IF;

  IF NOT (public.is_guardian_of(_student_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized for this student';
  END IF;

  IF v_rank IS NULL THEN
    RETURN;
  END IF;

  SELECT r.curriculum_tier, r.system_id, r.sort_order
    INTO v_tier, v_system, v_rank_order
  FROM public.belt_ranks r WHERE r.id = v_rank;

  -- The library only grows, and only within one belt system: a student keeps
  -- every rank at or below their own in their own system, and every tier-wide
  -- item at or below their own tier. Cross-system material retires entirely.
  --
  -- PROGRAMME BOUNDARY (Round 17): belt system is NOT a programme. Teen Karate,
  -- Adult Karate and Tai Chi are one programme taught by a different instructor
  -- while sharing the Solid Belt system with children's karate. A student's
  -- programmes therefore come ONLY from their class enrolments —
  -- students -> student_classes -> class_schedules.program_id — mirroring
  -- public.get_technique_library(), which is the reference implementation for
  -- this join. Do not add a second way to resolve a programme, and never match
  -- programmes by display name. ci.program_id IS NULL means "every programme".
  -- A student with no enrolments matches nothing, so they see shared items only.
  --
  -- ORDERING CONTRACT: the frontend accordion groups "already earned" rows with
  -- a run-length loop over group_label, so rows MUST stay contiguous by
  -- group_label. Reordering the ORDER BY below without preserving that grouping
  -- silently splits one belt group into several headings in the UI.
  RETURN QUERY
  SELECT ci.id,
         ci.technique,
         ci.category,
         ci.notes,
         ci.sort_order,
         ci.belt_rank_id,
         ci.curriculum_tier,
         cr.name AS rank_name,
         CASE
           WHEN cr.id IS NOT NULL THEN cr.name
           ELSE 'All ' || initcap(ci.curriculum_tier) || ' students'
         END AS group_label,
         CASE
           WHEN cr.id IS NOT NULL THEN (cr.id = v_rank)
           ELSE (ci.curriculum_tier = v_tier)
         END AS is_current,
         ci.video_youtube_id,
         ci.video_title,
         ci.video_seconds,
         ci.video_orientation
  FROM public.curriculum_items ci
  LEFT JOIN public.belt_ranks cr ON cr.id = ci.belt_rank_id
  WHERE ci.active = true
    AND (
      ci.program_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.student_classes sc
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE sc.student_id = _student_id
          AND cs.program_id = ci.program_id
      )
    )
    AND (
      (cr.id IS NOT NULL AND cr.system_id = v_system AND cr.sort_order <= v_rank_order)
      OR (
        ci.belt_rank_id IS NULL
        AND ci.curriculum_tier IS NOT NULL
        AND v_tier IS NOT NULL
        AND array_position(v_tiers, ci.curriculum_tier) <= array_position(v_tiers, v_tier)
      )
    )
  ORDER BY (CASE
              WHEN cr.id IS NOT NULL THEN (cr.id = v_rank)
              ELSE (ci.curriculum_tier = v_tier)
            END) DESC,
           (cr.id IS NULL),
           cr.sort_order DESC NULLS LAST,
           array_position(v_tiers, ci.curriculum_tier) DESC NULLS LAST,
           ci.sort_order,
           ci.technique;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_curriculum_for_all_children()
 RETURNS TABLE(student_id uuid, first_name text, belt_rank_id_student uuid, student_created_at timestamp with time zone, id uuid, technique text, category text, notes text, sort_order integer, belt_rank_id uuid, curriculum_tier text, rank_name text, group_label text, is_current boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- PROGRAMME BOUNDARY (Round 17): the EXISTS below is correlated to k.id — the
  -- CHILD — never to the parent. Resolving programmes per parent would let a
  -- karate-only child inherit a jiu jitsu sibling's programme and see their
  -- material. Join path mirrors public.get_technique_library() exactly:
  -- student_classes -> class_schedules.program_id. ci.program_id IS NULL means
  -- "every programme"; a child with no enrolments sees shared items only.
  --
  -- ORDERING CONTRACT: rows MUST stay contiguous by group_label within a child —
  -- the frontend accordion run-length groups them.
  WITH tiers AS (SELECT ARRAY['beginner','intermediate','advanced']::text[] AS t),
  kids AS (
    SELECT s.id, s.first_name, s.belt_rank_id, s.created_at,
           r.system_id, r.sort_order AS rank_order, r.curriculum_tier AS tier
    FROM public.students s
    LEFT JOIN public.belt_ranks r ON r.id = s.belt_rank_id
    WHERE public.is_active_member() AND public.is_guardian_of(s.id)
  )
  SELECT k.id,
         k.first_name,
         k.belt_rank_id,
         k.created_at,
         ci.id,
         ci.technique,
         ci.category,
         ci.notes,
         ci.sort_order,
         ci.belt_rank_id,
         ci.curriculum_tier,
         cr.name,
         CASE WHEN cr.id IS NOT NULL THEN cr.name
              ELSE 'All ' || initcap(ci.curriculum_tier) || ' students' END,
         CASE WHEN cr.id IS NOT NULL THEN (cr.id = k.belt_rank_id)
              ELSE (ci.curriculum_tier = k.tier) END,
         ci.video_youtube_id,
         ci.video_title,
         ci.video_seconds,
         ci.video_orientation
  FROM kids k
  CROSS JOIN tiers
  JOIN public.curriculum_items ci ON ci.active = true
  LEFT JOIN public.belt_ranks cr ON cr.id = ci.belt_rank_id
  WHERE k.belt_rank_id IS NOT NULL
    AND (
      ci.program_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.student_classes sc
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE sc.student_id = k.id
          AND cs.program_id = ci.program_id
      )
    )
    AND (
      (cr.id IS NOT NULL AND cr.system_id = k.system_id AND cr.sort_order <= k.rank_order)
      OR (
        ci.belt_rank_id IS NULL
        AND ci.curriculum_tier IS NOT NULL
        AND k.tier IS NOT NULL
        AND array_position(tiers.t, ci.curriculum_tier) <= array_position(tiers.t, k.tier)
      )
    )
  ORDER BY k.created_at,
           k.id,
           (CASE WHEN cr.id IS NOT NULL THEN (cr.id = k.belt_rank_id)
                 ELSE (ci.curriculum_tier = k.tier) END) DESC,
           (cr.id IS NULL),
           cr.sort_order DESC NULLS LAST,
           array_position(tiers.t, ci.curriculum_tier) DESC NULLS LAST,
           ci.sort_order,
           ci.technique;
$function$;