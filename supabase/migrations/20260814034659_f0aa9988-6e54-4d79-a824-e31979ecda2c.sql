-- Round 14 AX: the AV assignment as a callable, admin-gated function.
CREATE OR REPLACE FUNCTION public.assign_jiu_jitsu_levels()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level uuid;
  v_jj_program uuid;
  v_assigned integer := 0;
  v_skipped integer := 0;
  v_skipped_students jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT r.id INTO v_level
  FROM public.belt_ranks r
  JOIN public.belt_systems sy ON sy.id = r.system_id
  WHERE sy.slug = 'jiu_jitsu' AND r.active = true
  ORDER BY r.sort_order
  LIMIT 1;

  SELECT p.id INTO v_jj_program
  FROM public.programs p
  WHERE lower(btrim(p.name)) = lower('Jiu Jitsu & Wrestling');

  IF v_level IS NULL OR v_jj_program IS NULL THEN
    RAISE EXCEPTION 'Jiu Jitsu level or programme missing — refusing to guess';
  END IF;

  -- Rankless students who ALSO train another programme: reported, not touched.
  SELECT count(*), COALESCE(
           jsonb_agg(jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name)),
           '[]'::jsonb)
    INTO v_skipped, v_skipped_students
  FROM public.students s
  WHERE s.belt_rank_id IS NULL
    AND s.active = true
    AND EXISTS (
      SELECT 1 FROM public.student_classes sc
      JOIN public.class_schedules cs ON cs.id = sc.class_id
      WHERE sc.student_id = s.id AND cs.program_id = v_jj_program
    )
    AND EXISTS (
      SELECT 1 FROM public.student_classes sc
      JOIN public.class_schedules cs ON cs.id = sc.class_id
      WHERE sc.student_id = s.id
        AND (cs.program_id IS NULL OR cs.program_id <> v_jj_program)
    );

  UPDATE public.students s
  SET belt_rank_id = v_level
  WHERE s.belt_rank_id IS NULL
    AND s.active = true
    AND EXISTS (
      SELECT 1 FROM public.student_classes sc
      JOIN public.class_schedules cs ON cs.id = sc.class_id
      WHERE sc.student_id = s.id AND cs.program_id = v_jj_program
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.student_classes sc
      JOIN public.class_schedules cs ON cs.id = sc.class_id
      WHERE sc.student_id = s.id
        AND (cs.program_id IS NULL OR cs.program_id <> v_jj_program)
    );
  GET DIAGNOSTICS v_assigned = ROW_COUNT;

  RETURN jsonb_build_object(
    'assigned', v_assigned,
    'skipped', v_skipped,
    'skipped_students', v_skipped_students
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.assign_jiu_jitsu_levels() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assign_jiu_jitsu_levels() TO authenticated, service_role;

-- Round 14 AY: one place that says which programme a belt system belongs to.
ALTER TABLE public.belt_systems
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;

UPDATE public.belt_systems sy
SET program_id = p.id
FROM public.programs p
WHERE sy.program_id IS NULL
  AND (
    (sy.slug IN ('solid', 'camo', 'youth_stripe') AND lower(btrim(p.name)) = lower('Karate'))
    OR (sy.slug = 'jiu_jitsu' AND lower(btrim(p.name)) = lower('Jiu Jitsu & Wrestling'))
    OR (sy.slug LIKE 'tai%chi' AND lower(btrim(p.name)) = lower('Tai Chi'))
  );
