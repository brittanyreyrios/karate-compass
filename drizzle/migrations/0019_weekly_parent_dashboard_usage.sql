CREATE TABLE public.parent_activity_days (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  PRIMARY KEY (profile_id, activity_date)
);
REVOKE ALL ON TABLE public.parent_activity_days FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.parent_activity_days TO authenticated;
GRANT ALL ON TABLE public.parent_activity_days TO service_role;
ALTER TABLE public.parent_activity_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can select parent activity days"
ON public.parent_activity_days FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Deployment-day metadata avoids inventing pre-measurement zero weeks.
DO $block$
BEGIN
  EXECUTE format(
    'COMMENT ON TABLE public.parent_activity_days IS %L',
    jsonb_build_object('measurement_started_on',
      (now() AT TIME ZONE 'America/Chicago')::date)::text
  );
END;
$block$;

CREATE FUNCTION public.log_dashboard_open()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL
     OR COALESCE(public.has_role(v_user, 'admin'::public.app_role), false)
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = v_user AND p.archived_at IS NULL
     ) THEN
    RETURN;
  END IF;
  INSERT INTO public.parent_activity_days(profile_id, activity_date)
  VALUES (v_user, (now() AT TIME ZONE 'America/Chicago')::date)
  ON CONFLICT (profile_id, activity_date) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.log_dashboard_open() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_dashboard_open() TO authenticated;

CREATE FUNCTION public.get_weekly_active_parents(_weeks int DEFAULT 8)
RETURNS TABLE(week_start date, active_parents int, eligible_parents int, pct numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_this_week date := date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date;
  v_started date := (obj_description('public.parent_activity_days'::regclass, 'pg_class')::jsonb
    ->> 'measurement_started_on')::date;
  v_first_week date := date_trunc('week', v_started::timestamp)::date + 7;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _weeks IS NULL OR _weeks < 1 THEN
    RAISE EXCEPTION 'Weeks must be a positive integer';
  END IF;
  RETURN QUERY
  WITH non_fixture_profiles AS (
    SELECT p.* FROM public.profiles p
    WHERE lower(p.email) NOT LIKE 'zz.test.%'
      AND p.id NOT IN (
        '57a7e312-d3cb-40bf-bd89-940a516cadfd'::uuid,
        '44a1b1c7-c9cd-4192-8717-8c137e5d3c9a'::uuid,
        'd9db9608-b5d0-44f9-bbd4-b44514459708'::uuid,
        'a7d03379-1c50-4517-9267-2f2573a46d41'::uuid
      )
  ), eligible AS (
    SELECT count(*)::int AS total FROM non_fixture_profiles p
    WHERE p.archived_at IS NULL
      AND NOT public.has_role(p.id, 'admin'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.student_guardians g
        JOIN public.students s ON s.id = g.student_id
        WHERE g.profile_id = p.id AND s.active = true AND s.parent_id IS NOT NULL
      )
  ), weeks AS (
    SELECT v_this_week - (n * 7) AS starts
    FROM generate_series(1, _weeks) AS series(n)
    WHERE v_this_week - (n * 7) >= v_first_week
  ), activity AS (
    SELECT w.starts, count(DISTINCT d.profile_id)::int AS total
    FROM weeks w
    LEFT JOIN public.parent_activity_days d
      ON d.activity_date >= w.starts AND d.activity_date < w.starts + 7
      AND EXISTS (SELECT 1 FROM non_fixture_profiles p WHERE p.id = d.profile_id)
    GROUP BY w.starts
  )
  SELECT a.starts, a.total, e.total,
    round(100.0 * a.total / nullif(e.total, 0), 1)
  FROM activity a CROSS JOIN eligible e
  ORDER BY a.starts DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_weekly_active_parents(int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_weekly_active_parents(int) TO authenticated;
