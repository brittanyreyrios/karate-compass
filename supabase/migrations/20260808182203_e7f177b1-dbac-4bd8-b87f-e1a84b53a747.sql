-- Round 10 AK3: the leaderboard must know whether the student's program uses
-- belts, so it can render a neutral level chip instead of a belt graphic.
-- Return type changes, so the function is dropped and recreated.
DROP FUNCTION IF EXISTS public.get_leaderboard(text, text);

CREATE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
 RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text, pattern text, color_primary text, color_accent text, class_name text, period_points integer, uses_belts boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND public.division_of(st.belt_rank_id, st.class_name) = _division
    AND COALESCE(pts.total, 0) > 0
  ORDER BY COALESCE(pts.total, 0) DESC, st.first_name ASC
  LIMIT 10;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text) TO authenticated, service_role;