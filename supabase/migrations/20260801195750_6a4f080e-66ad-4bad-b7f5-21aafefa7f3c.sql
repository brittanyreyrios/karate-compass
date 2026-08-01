-- 1. belt_systems
CREATE TABLE public.belt_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  age_guidance text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.belt_systems TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.belt_systems TO authenticated;
GRANT ALL ON public.belt_systems TO service_role;
ALTER TABLE public.belt_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "belt_systems_select" ON public.belt_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "belt_systems_admin_write" ON public.belt_systems FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER belt_systems_updated_at BEFORE UPDATE ON public.belt_systems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. belt_ranks
CREATE TABLE public.belt_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.belt_systems(id) ON DELETE RESTRICT,
  name text NOT NULL,
  short_name text,
  pattern text NOT NULL DEFAULT 'solid',
  color_primary text NOT NULL,
  color_accent text,
  curriculum_tier text NOT NULL DEFAULT 'beginner',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_id, sort_order),
  CONSTRAINT belt_ranks_pattern_chk CHECK (pattern IN ('solid','stripe','camo')),
  CONSTRAINT belt_ranks_tier_chk CHECK (curriculum_tier IN ('beginner','intermediate','advanced'))
);
GRANT SELECT ON public.belt_ranks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.belt_ranks TO authenticated;
GRANT ALL ON public.belt_ranks TO service_role;
ALTER TABLE public.belt_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "belt_ranks_select" ON public.belt_ranks FOR SELECT TO authenticated USING (true);
CREATE POLICY "belt_ranks_admin_write" ON public.belt_ranks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER belt_ranks_updated_at BEFORE UPDATE ON public.belt_ranks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. seed systems
INSERT INTO public.belt_systems (slug, name, age_guidance, sort_order) VALUES
  ('youth_stripe', 'White Belt with Stripe', 'Typically age 5 and under', 1),
  ('camo',         'Camo Belt',              'Typically ages 6-7',       2),
  ('solid',        'Solid Belt',             'Typically age 8 and up',   3)
ON CONFLICT (slug) DO NOTHING;

-- 4. seed ranks
INSERT INTO public.belt_ranks (system_id, name, short_name, pattern, color_primary, color_accent, curriculum_tier, sort_order)
SELECT s.id, v.name, v.short_name, v.pattern, v.cp, v.ca, v.tier, v.so
FROM public.belt_systems s
JOIN (VALUES
  ('youth_stripe','White',                     'White',         'solid', '#f8fafc', NULL,      'beginner', 1),
  ('youth_stripe','White with Gold Stripe',    'Gold Stripe',   'stripe','#f8fafc', '#f5c518', 'beginner', 2),
  ('youth_stripe','White with Orange Stripe',  'Orange Stripe', 'stripe','#f8fafc', '#fb923c', 'beginner', 3),
  ('youth_stripe','White with Green Stripe',   'Green Stripe',  'stripe','#f8fafc', '#22c55e', 'beginner', 4),
  ('youth_stripe','White with Purple Stripe',  'Purple Stripe', 'stripe','#f8fafc', '#a855f7', 'beginner', 5),
  ('youth_stripe','White with Blue Stripe',    'Blue Stripe',   'stripe','#f8fafc', '#3b82f6', 'beginner', 6),
  ('youth_stripe','White with Brown Stripe',   'Brown Stripe',  'stripe','#f8fafc', '#92400e', 'beginner', 7),
  ('camo','White',        'White',  'solid','#f8fafc', NULL,      'beginner', 1),
  ('camo','Camo Gold',    'Gold',   'camo', '#4b5320', '#f5c518', 'beginner', 2),
  ('camo','Camo Orange',  'Orange', 'camo', '#4b5320', '#fb923c', 'beginner', 3),
  ('camo','Camo Green',   'Green',  'camo', '#4b5320', '#22c55e', 'beginner', 4),
  ('camo','Camo Purple',  'Purple', 'camo', '#4b5320', '#a855f7', 'beginner', 5),
  ('camo','Camo Blue',    'Blue',   'camo', '#4b5320', '#3b82f6', 'beginner', 6),
  ('camo','Camo Brown',   'Brown',  'camo', '#4b5320', '#92400e', 'beginner', 7),
  ('solid','White',  'White',  'solid','#f8fafc', NULL, 'beginner',     1),
  ('solid','Gold',   'Gold',   'solid','#f5c518', NULL, 'beginner',     2),
  ('solid','Orange', 'Orange', 'solid','#fb923c', NULL, 'beginner',     3),
  ('solid','Green',  'Green',  'solid','#22c55e', NULL, 'intermediate', 4),
  ('solid','Purple', 'Purple', 'solid','#a855f7', NULL, 'intermediate', 5),
  ('solid','Blue',   'Blue',   'solid','#3b82f6', NULL, 'intermediate', 6),
  ('solid','Brown',  'Brown',  'solid','#92400e', NULL, 'advanced',     7),
  ('solid','Black',  'Black',  'solid','#0a0a0a', NULL, 'advanced',     8)
) AS v(slug, name, short_name, pattern, cp, ca, tier, so) ON v.slug = s.slug
ON CONFLICT (system_id, sort_order) DO NOTHING;

-- 5. students.belt_rank_id + backfill (solid system only, no defaulting)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS belt_rank_id uuid REFERENCES public.belt_ranks(id);

UPDATE public.students st
SET belt_rank_id = r.id
FROM public.belt_ranks r
JOIN public.belt_systems s ON s.id = r.system_id AND s.slug = 'solid'
WHERE st.belt_rank_id IS NULL
  AND lower(btrim(st.current_belt)) = lower(r.name);

-- keep current_belt as denormalized display value
CREATE OR REPLACE FUNCTION public.sync_student_belt_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.belt_rank_id IS NOT NULL THEN
    SELECT name INTO NEW.current_belt FROM public.belt_ranks WHERE id = NEW.belt_rank_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER students_sync_belt_text
BEFORE INSERT OR UPDATE OF belt_rank_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.sync_student_belt_text();

-- 6. curriculum gating
ALTER TABLE public.curriculum_items
  ADD COLUMN IF NOT EXISTS belt_rank_id uuid REFERENCES public.belt_ranks(id),
  ADD COLUMN IF NOT EXISTS curriculum_tier text;
ALTER TABLE public.curriculum_items ALTER COLUMN belt DROP NOT NULL;
ALTER TABLE public.curriculum_items
  ADD CONSTRAINT curriculum_items_target_chk CHECK (
    (belt_rank_id IS NOT NULL AND curriculum_tier IS NULL)
    OR (belt_rank_id IS NULL AND curriculum_tier IS NOT NULL)
  ) NOT VALID;
ALTER TABLE public.curriculum_items
  ADD CONSTRAINT curriculum_items_tier_chk CHECK (
    curriculum_tier IS NULL OR curriculum_tier IN ('beginner','intermediate','advanced')
  );

-- 7. leaderboard rewrite
DROP FUNCTION IF EXISTS public.get_leaderboard();

CREATE OR REPLACE FUNCTION public.get_leaderboard(_system_slug text, _period text DEFAULT 'month')
RETURNS TABLE(
  id uuid,
  first_name text,
  last_initial text,
  rank_name text,
  rank_short_name text,
  pattern text,
  color_primary text,
  color_accent text,
  class_name text,
  period_points integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    FROM public.point_events pe
    WHERE _period = 'all_time'
       OR pe.occurred_on >= date_trunc('month', CURRENT_DATE)::date
    GROUP BY pe.student_id
  ) pts ON pts.student_id = st.id
  WHERE st.active = true
    AND sy.slug = _system_slug
    AND COALESCE(pts.total, 0) > 0
  ORDER BY COALESCE(pts.total, 0) DESC, st.first_name ASC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text) TO authenticated;