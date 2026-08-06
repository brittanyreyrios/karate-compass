-- AC: clear the fabricated placeholder review link. Row-scoped so a real link
-- pasted since is never wiped. This key must never be seeded again.
DELETE FROM public.app_settings
WHERE key = 'google_review_url'
  AND value = 'https://search.google.com/local/writereview?placeid=';

-- AF2: flag teen/adult classes.
ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS is_teen_adult boolean NOT NULL DEFAULT false;

-- AF3: labels + tab order for the five divisions.
-- NOTE: the authoritative set of division keys lives in public.division_of(),
-- NOT in this table. Adding a row here does not create a division — it only
-- adds a label/tab for a key division_of() can already return.
CREATE TABLE IF NOT EXISTS public.leaderboard_divisions (
  key text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leaderboard_divisions TO authenticated;
GRANT ALL ON public.leaderboard_divisions TO service_role;

ALTER TABLE public.leaderboard_divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Divisions readable by signed-in users" ON public.leaderboard_divisions;
CREATE POLICY "Divisions readable by signed-in users"
  ON public.leaderboard_divisions FOR SELECT TO authenticated USING (true);

INSERT INTO public.leaderboard_divisions (key, name, sort_order) VALUES
  ('tiny_tiger', 'Tiny Tiger', 0),
  ('camo', 'Camo Belt', 1),
  ('solid_beginner', 'Solid Belt Beginners', 2),
  ('solid_advanced', 'Solid Belt Int/Adv', 3),
  ('teen_adult', 'Teen & Adults', 4)
ON CONFLICT (key) DO NOTHING;

-- AF1/AF3: the ONE division rule. LANGUAGE sql + STABLE so Postgres can inline
-- it into the leaderboard query rather than calling it per row as a black box.
-- It never touches point_events — the points aggregate stays in get_leaderboard
-- behind the Round 7 bounds CTE and covering index.
--
-- Order matters:
--   1. No belt rank => no division. get_leaderboard inner-joins belt_ranks, so a
--      rankless student can never appear on a board; returning a division for
--      them would open a parent's tab on a board their child is absent from.
--   2. Teen/adult class beats belt: teens/adults here do hold solid belts.
--   3. Otherwise the belt system (and tier, for solid) decides.
-- Class names are matched normalised (lower(btrim(...))) because students link
-- to classes by text, not a foreign key. class_student_counts() below uses the
-- IDENTICAL expression.
CREATE OR REPLACE FUNCTION public.division_of(_belt_rank_id uuid, _class_name text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _belt_rank_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.class_schedules cs
      WHERE lower(btrim(cs.class_name)) = lower(btrim(COALESCE(_class_name, '')))
        AND cs.is_teen_adult
    ) THEN 'teen_adult'
    ELSE (
      SELECT CASE
               WHEN sy.slug = 'youth_stripe' THEN 'tiny_tiger'
               WHEN sy.slug = 'camo' THEN 'camo'
               WHEN sy.slug = 'solid' AND r.curriculum_tier = 'beginner' THEN 'solid_beginner'
               WHEN sy.slug = 'solid' AND r.curriculum_tier IN ('intermediate', 'advanced')
                 THEN 'solid_advanced'
               ELSE NULL
             END
      FROM public.belt_ranks r
      JOIN public.belt_systems sy ON sy.id = r.system_id
      WHERE r.id = _belt_rank_id
    )
  END;
$$;

-- AF3: the board query. Same shape as Round 7 — bounds CTE (sargable, no OR),
-- active = true, > 0 points, LIMIT 10, ordering — with _system_slug swapped for
-- _division. Last names NEVER leave the database: only an initial does.
DROP FUNCTION IF EXISTS public.get_leaderboard(text, text);

CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text,
              pattern text, color_primary text, color_accent text, class_name text,
              period_points integer)
LANGUAGE sql
STABLE SECURITY DEFINER
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
         COALESCE(pts.total, 0)::integer
  FROM public.students st
  JOIN public.belt_ranks r ON r.id = st.belt_rank_id
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
$$;

-- AF4: which board is my child on. Caller's own children only; returns a single
-- division key and nothing else, so no other family's data is exposed.
CREATE OR REPLACE FUNCTION public.get_my_division()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.division_of(s.belt_rank_id, s.class_name)
  FROM public.students s
  WHERE s.parent_id = auth.uid()
    AND s.active = true
    AND public.division_of(s.belt_rank_id, s.class_name) IS NOT NULL
  ORDER BY s.created_at
  LIMIT 1;
$$;

-- AF2: student count per class row, so a 0 exposes the text-match mismatch.
-- The join expression is IDENTICAL to the one in division_of above.
CREATE OR REPLACE FUNCTION public.class_student_counts()
RETURNS TABLE(class_name text, student_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT cs.class_name,
         (SELECT count(*) FROM public.students s
          WHERE s.active = true
            AND lower(btrim(s.class_name)) = lower(btrim(cs.class_name)))::integer
  FROM public.class_schedules cs
  ORDER BY cs.class_name;
END;
$$;
