-- 1. Columns
ALTER TABLE public.curriculum_items
  ADD COLUMN IF NOT EXISTS video_orientation text;
ALTER TABLE public.technique_library
  ADD COLUMN IF NOT EXISTS video_orientation text;

ALTER TABLE public.curriculum_items
  ADD CONSTRAINT curriculum_items_video_orientation_check
  CHECK (video_orientation IS NULL OR video_orientation IN ('landscape','portrait'));
ALTER TABLE public.technique_library
  ADD CONSTRAINT technique_library_video_orientation_check
  CHECK (video_orientation IS NULL OR video_orientation IN ('landscape','portrait'));

-- 2. Readers: return type changes, so DROP then CREATE.
DROP FUNCTION IF EXISTS public.get_curriculum_for_student(uuid);
DROP FUNCTION IF EXISTS public.get_curriculum_for_all_children();
DROP FUNCTION IF EXISTS public.get_technique_library();

CREATE FUNCTION public.get_curriculum_for_student(_student_id uuid)
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
  SELECT s.parent_id, s.belt_rank_id INTO v_parent, v_rank
  FROM public.students s WHERE s.id = _student_id;

  IF v_parent IS NULL THEN
    RETURN;
  END IF;

  IF NOT (v_parent = auth.uid() OR public.has_role(auth.uid(), 'admin')) THEN
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
         -- Strictly boolean: a tier-targeted item inherited from a lower tier
         -- must be false, never NULL, so the UI can trust the flag.
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

CREATE FUNCTION public.get_curriculum_for_all_children()
 RETURNS TABLE(student_id uuid, first_name text, belt_rank_id_student uuid, student_created_at timestamp with time zone, id uuid, technique text, category text, notes text, sort_order integer, belt_rank_id uuid, curriculum_tier text, rank_name text, group_label text, is_current boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tiers AS (SELECT ARRAY['beginner','intermediate','advanced']::text[] AS t),
  kids AS (
    SELECT s.id, s.first_name, s.belt_rank_id, s.created_at,
           r.system_id, r.sort_order AS rank_order, r.curriculum_tier AS tier
    FROM public.students s
    LEFT JOIN public.belt_ranks r ON r.id = s.belt_rank_id
    WHERE s.parent_id = auth.uid()
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

CREATE FUNCTION public.get_technique_library()
 RETURNS TABLE(id uuid, program_id uuid, program_name text, label text, title text, category text, difficulty text, notes text, sort_order integer, published boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.program_id, pr.name, tl.label, tl.title,
         tl.category, tl.difficulty, tl.notes, tl.sort_order,
         tl.published, tl.video_youtube_id, tl.video_title, tl.video_seconds,
         tl.video_orientation
  FROM public.technique_library tl
  JOIN public.programs pr ON pr.id = tl.program_id
  WHERE
    -- Admins see everything, drafts included.
    public.has_role(auth.uid(), 'admin')
    OR (
      tl.published = true
      AND EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.student_classes sc ON sc.student_id = s.id
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE s.parent_id = auth.uid()
          AND s.active = true
          AND cs.program_id = tl.program_id
      )
    )
  ORDER BY tl.category, tl.sort_order, tl.title;
$function$;

-- 3. Grants last, so they stick to the new function objects.
REVOKE EXECUTE ON FUNCTION public.get_curriculum_for_student(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_curriculum_for_student(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_curriculum_for_all_children() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_curriculum_for_all_children() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_technique_library() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_technique_library() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_curriculum_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_curriculum_for_all_children() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_technique_library() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_curriculum_for_student(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_curriculum_for_all_children() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_technique_library() TO service_role;