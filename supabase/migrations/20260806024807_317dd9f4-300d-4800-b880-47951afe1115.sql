-- AB1: parent/rank lookups on students
CREATE INDEX IF NOT EXISTS students_parent_idx ON public.students (parent_id);
CREATE INDEX IF NOT EXISTS students_belt_rank_idx ON public.students (belt_rank_id);

-- AB0: date-leading covering index so the monthly aggregate is index-only
CREATE INDEX IF NOT EXISTS point_events_date_student_idx
  ON public.point_events (occurred_on, student_id) INCLUDE (delta);

-- AB0: sargable period filter (the OR forced a full scan)
CREATE OR REPLACE FUNCTION public.get_leaderboard(_system_slug text, _period text DEFAULT 'month'::text)
 RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text, pattern text, color_primary text, color_accent text, class_name text, period_points integer)
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
         COALESCE(pts.total, 0)::integer
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
    AND sy.slug = _system_slug
    AND COALESCE(pts.total, 0) > 0
  ORDER BY COALESCE(pts.total, 0) DESC, st.first_name ASC
  LIMIT 10;
$function$;

-- AA2: admin-editable school settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value)
VALUES ('google_review_url', 'https://search.google.com/local/writereview?placeid=')
ON CONFLICT (key) DO NOTHING;

-- AA: per-parent dismissal of the review card
CREATE TABLE IF NOT EXISTS public.review_prompt_dismissals (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.review_prompt_dismissals TO authenticated;
GRANT ALL ON public.review_prompt_dismissals TO service_role;
ALTER TABLE public.review_prompt_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own dismissal" ON public.review_prompt_dismissals
  FOR ALL TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);
