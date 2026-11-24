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

  -- (existing PROGRAMME BOUNDARY and ORDERING CONTRACT comments kept verbatim)
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
