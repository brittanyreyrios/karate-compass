-- Round 21: a student can belong to more than one leaderboard board.
-- division_of() still answers "what is this student's primary division?" and is
-- left exactly as it is; divisions_of() wraps it and adds jiu jitsu membership
-- derived from actual class enrolment rather than from the student's belt system.
CREATE OR REPLACE FUNCTION public.divisions_of(_student_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT d
      FROM (
        -- Primary division, computed by the single existing source of truth.
        SELECT public.division_of(_student_id) AS d
        UNION ALL
        -- Plus the jiu jitsu board for anyone enrolled in a class belonging to
        -- the "Jiu Jitsu & Wrestling" programme (679fb4c1-8004-4db1-a88b-11e910de640d).
        SELECT 'jiu_jitsu'
        WHERE EXISTS (
          SELECT 1
          FROM public.student_classes sc
          JOIN public.class_schedules cs ON cs.id = sc.class_id
          WHERE sc.student_id = _student_id
            AND cs.program_id = '679fb4c1-8004-4db1-a88b-11e910de640d'::uuid
        )
      ) s
      WHERE d IS NOT NULL
    ),
    ARRAY[]::text[]
  );
$$;

REVOKE ALL ON FUNCTION public.divisions_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.divisions_of(uuid) TO authenticated, service_role;

-- get_leaderboard: only the division test changes.
CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text, pattern text, color_primary text, color_accent text, class_name text, period_points integer, uses_belts boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT CASE WHEN _period = 'all_time' THEN '-infinity'::date
                ELSE date_trunc('month', CURRENT_DATE)::date END AS since
  )
  SELECT st.id,
         st.first_name,
         CASE WHEN st.last_name IS NULL OR btrim(st.last_name) = '' THEN ''
              ELSE upper(left(btrim(st.last_name), 1)) || '.' END,
         r.name,
         COALESCE(r.short_name, r.name),
         r.pattern,
         r.color_primary,
         r.color_accent,
         st.class_name,
         COALESCE(pts.total, 0)::integer,
         sy.uses_belts
  FROM public.students st
  JOIN public.belt_ranks r ON r.id = st.belt_rank_id
  JOIN public.belt_systems sy ON sy.id = r.system_id
  LEFT JOIN (
    SELECT pe.student_id, SUM(pe.delta) AS total
    FROM public.point_events pe, bounds b
    WHERE pe.occurred_on >= b.since
    GROUP BY pe.student_id
  ) pts ON pts.student_id = st.id
  WHERE st.active = true
    AND _division = ANY (public.divisions_of(st.id))
    AND COALESCE(pts.total, 0) > 0
  ORDER BY COALESCE(pts.total, 0) DESC, st.first_name ASC
  LIMIT 10;
$$;