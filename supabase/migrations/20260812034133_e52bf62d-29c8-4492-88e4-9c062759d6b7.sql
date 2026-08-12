-- ============================================================
-- Round 13 AU1 — technique_library
-- Deliberately NOT curriculum_items: that table feeds
-- get_curriculum_for_student, the karate entitlement boundary.
-- ============================================================
CREATE TABLE public.technique_library (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
  label text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  difficulty text,
  video_youtube_id text,
  video_title text,
  video_seconds integer,
  notes text,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  -- AU4: exists from day one, deliberately unused and unexposed.
  belt_rank_id uuid REFERENCES public.belt_ranks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technique_library TO authenticated;
GRANT ALL ON public.technique_library TO service_role;

ALTER TABLE public.technique_library ENABLE ROW LEVEL SECURITY;

-- Families never read this table directly; entitlement is resolved in
-- get_technique_library() below. So the only table policy is the admin one.
CREATE POLICY "Admins manage the technique library"
ON public.technique_library FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER technique_library_updated_at
BEFORE UPDATE ON public.technique_library
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX technique_library_program_idx
  ON public.technique_library (program_id, published, category, sort_order);

-- ============================================================
-- AU2 — server-side entitlement, same shape as
-- get_curriculum_for_all_children: parent from auth.uid(), decided in SQL.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_technique_library()
RETURNS TABLE(
  id uuid, program_id uuid, program_name text, label text, title text,
  category text, difficulty text, notes text, sort_order integer,
  published boolean, video_youtube_id text, video_title text, video_seconds integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.program_id, pr.name, tl.label, tl.title,
         tl.category, tl.difficulty, tl.notes, tl.sort_order,
         tl.published, tl.video_youtube_id, tl.video_title, tl.video_seconds
  FROM public.technique_library tl
  JOIN public.programs pr ON pr.id = tl.program_id
  WHERE
    -- Admins see everything, drafts included.
    public.has_role(auth.uid(), 'admin')
    OR (
      tl.published = true
      AND EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.student_classes sc ON sc.student_id = s.id
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE s.parent_id = auth.uid()
          AND s.active = true
          AND cs.program_id = tl.program_id
      )
    )
  ORDER BY tl.category, tl.sort_order, tl.title;
$function$;

REVOKE ALL ON FUNCTION public.get_technique_library() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_technique_library() TO authenticated, service_role;

-- ============================================================
-- AV — Jiu Jitsu as a beltless system (tai chi pattern)
-- ============================================================
INSERT INTO public.belt_systems (slug, name, age_guidance, sort_order, uses_belts)
VALUES ('jiu_jitsu', 'Jiu Jitsu', 'Jiu jitsu and wrestling students', 3, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.belt_ranks
  (system_id, name, short_name, pattern, color_primary, color_accent, curriculum_tier, sort_order, active)
SELECT bs.id, 'Jiu Jitsu', 'JJ', 'solid', '#111111', NULL, 'beginner', 0, true
FROM public.belt_systems bs
WHERE bs.slug = 'jiu_jitsu'
  AND NOT EXISTS (SELECT 1 FROM public.belt_ranks r WHERE r.system_id = bs.id);

-- ============================================================
-- AW — sixth division
-- ============================================================
INSERT INTO public.leaderboard_divisions (key, name, sort_order)
VALUES ('jiu_jitsu', 'Jiu Jitsu', 5)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.division_of(_student_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- Null-rank branch stays first: an unranked student has no division.
    WHEN s.belt_rank_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.student_classes sc
      JOIN public.class_schedules cs ON cs.id = sc.class_id
      WHERE sc.student_id = s.id AND cs.is_teen_adult
    ) THEN 'teen_adult'
    ELSE (
      SELECT CASE
               WHEN sy.slug = 'youth_stripe' THEN 'tiny_tiger'
               WHEN sy.slug = 'camo' THEN 'camo'
               WHEN sy.slug = 'solid' AND r.curriculum_tier = 'beginner' THEN 'solid_beginner'
               WHEN sy.slug = 'solid' AND r.curriculum_tier IN ('intermediate', 'advanced')
                 THEN 'solid_advanced'
               -- Round 13 AW: jiu-jitsu-only students hold the beltless jiu
               -- jitsu level. A student who also does karate holds a karate
               -- belt, so they never reach this branch.
               WHEN sy.slug = 'jiu_jitsu' THEN 'jiu_jitsu'
               ELSE NULL
             END
      FROM public.belt_ranks r
      JOIN public.belt_systems sy ON sy.id = r.system_id
      WHERE r.id = s.belt_rank_id
    )
  END
  FROM public.students s
  WHERE s.id = _student_id;
$function$;

REVOKE ALL ON FUNCTION public.division_of(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.division_of(uuid) TO authenticated, service_role;