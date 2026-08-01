-- 1. Strictly-boolean is_current -------------------------------------------
DROP FUNCTION IF EXISTS public.get_curriculum_for_student(uuid);

CREATE FUNCTION public.get_curriculum_for_student(_student_id uuid)
 RETURNS TABLE(id uuid, technique text, category text, notes text, sort_order integer, belt_rank_id uuid, curriculum_tier text, rank_name text, group_label text, is_current boolean)
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
         END AS is_current
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

-- 2. Album titles -----------------------------------------------------------
-- Matched by title so this is a no-op if the titles were already corrected.
UPDATE public.gallery_albums SET title = 'CGL 2026', sort_order = 0 WHERE title = 'Swat Team';
UPDATE public.gallery_albums SET title = 'History Night', sort_order = 1 WHERE title = 'Evening Classes — Last Week';
UPDATE public.gallery_albums SET sort_order = 2 WHERE title = 'Summer Camp';

-- 3. album-covers bucket policies -------------------------------------------
-- MANUAL RESTORE STEP: the `album-covers` bucket itself CANNOT be created in a
-- migration — writes to storage.buckets are rejected by this project's tooling.
-- On a fresh database it must be created manually BEFORE these policies are
-- useful, with exactly these settings:
--     bucket id / name : album-covers
--     public           : true (public read)
--     file size limit  : enforced client-side at 5 MB (no bucket-level limit set)
--     allowed types    : enforced client-side (image/* only)
-- Without the bucket, every album cover upload fails with a confusing error.

DROP POLICY IF EXISTS "Album covers are publicly readable" ON storage.objects;
CREATE POLICY "Album covers are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'album-covers');

DROP POLICY IF EXISTS "Admins upload album covers" ON storage.objects;
CREATE POLICY "Admins upload album covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update album covers" ON storage.objects;
CREATE POLICY "Admins update album covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete album covers" ON storage.objects;
CREATE POLICY "Admins delete album covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'));