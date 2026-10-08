-- Round 57: Dojo Points periods are fixed two-month Chicago calendar pairs
-- (Jan-Feb, Mar-Apr, ...). This function is the ONLY definition of when the
-- current period started; get_leaderboard and the parent dashboard both call it.
CREATE OR REPLACE FUNCTION public.points_period_start(_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT make_date(
    extract(year FROM (_at AT TIME ZONE 'America/Chicago'))::int,
    ((extract(month FROM (_at AT TIME ZONE 'America/Chicago'))::int - 1) / 2) * 2 + 1,
    1
  );
$$;

REVOKE EXECUTE ON FUNCTION public.points_period_start(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.points_period_start(timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
 RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text, pattern text, color_primary text, color_accent text, class_name text, period_points integer, uses_belts boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    -- Round 57: any non-all_time period is the current two-month Chicago
    -- period, from public.points_period_start() — the single definition.
    SELECT CASE WHEN _period = 'all_time' THEN '-infinity'::date
                ELSE public.points_period_start() END AS since
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
         COALESCE(sy.uses_belts, false)
  FROM public.students st
  LEFT JOIN public.belt_ranks r ON r.id = st.belt_rank_id
  LEFT JOIN public.belt_systems sy ON sy.id = r.system_id
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
$function$;

ALTER TABLE public.point_events
  ALTER COLUMN occurred_on SET DEFAULT ((now() AT TIME ZONE 'America/Chicago')::date);

-- One-time correction: dates only, never delta/student_id/students.points.
UPDATE public.point_events
SET occurred_on = (created_at AT TIME ZONE 'America/Chicago')::date
WHERE created_at IS NOT NULL
  AND occurred_on <> (created_at AT TIME ZONE 'America/Chicago')::date;