-- Round 13 AV (follow-up): the jiu_jitsu level existed but was never assigned.
--
-- Scope, deliberately narrow:
--   * belt_rank_id IS NULL          — never overwrite a real rank
--   * active = true
--   * enrolled in >= 1 Jiu Jitsu & Wrestling class
--   * enrolled in NO class of any other programme
--
-- The "only" half is the safety property. A rankless student who also does
-- karate is a failed belt import, not a jiu jitsu student; giving them a level
-- would hide the error and put them on the wrong leaderboard.
DO $$
DECLARE
  v_level uuid;
  v_jj_program uuid;
  v_assigned integer := 0;
  v_skipped integer := 0;
BEGIN
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
  SELECT count(*) INTO v_skipped
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

  RAISE NOTICE 'AV assignment: % student(s) given the Jiu Jitsu level; % rankless student(s) skipped because they also train another programme.',
    v_assigned, v_skipped;
END $$;