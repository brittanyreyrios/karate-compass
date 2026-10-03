-- Round 58: one or more guardians per child. students.parent_id stays (NOT NULL, still written).
CREATE TABLE public.student_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_guardians_pair_uniq UNIQUE (student_id, profile_id)
);
CREATE UNIQUE INDEX student_guardians_one_primary ON public.student_guardians (student_id) WHERE is_primary;
CREATE INDEX student_guardians_profile_idx ON public.student_guardians (profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_guardians TO authenticated;
GRANT ALL ON public.student_guardians TO service_role;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage guardian links" ON public.student_guardians
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- A parent sees ONLY their own link rows — never a co-guardian's.
CREATE POLICY "Parents read own guardian links" ON public.student_guardians
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE TRIGGER student_guardians_updated_at BEFORE UPDATE ON public.student_guardians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: exactly one primary row per existing student.
INSERT INTO public.student_guardians (student_id, profile_id, is_primary)
SELECT s.id, s.parent_id, true FROM public.students s;

-- Access helper used by every parent-facing policy and function below.
CREATE OR REPLACE FUNCTION public.is_guardian_of(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_guardians g
    WHERE g.student_id = _student_id AND g.profile_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_guardian_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid) TO authenticated, service_role;

-- Sync: keep the primary guardian row in step with students.parent_id.
-- Order: demote -> upsert new primary -> delete old parent's row.
CREATE OR REPLACE FUNCTION public.sync_primary_guardian()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT DISTINCT FROM NEW.parent_id THEN
    RETURN NULL;
  END IF;

  -- 1. Demote every existing primary (partial unique index is not deferrable).
  UPDATE public.student_guardians
     SET is_primary = false
   WHERE student_id = NEW.id AND is_primary;

  -- 2. Upsert the incoming parent as primary (promotes an existing secondary).
  INSERT INTO public.student_guardians (student_id, profile_id, is_primary)
  VALUES (NEW.id, NEW.parent_id, true)
  ON CONFLICT (student_id, profile_id)
  DO UPDATE SET is_primary = true, updated_at = now();

  -- 3. Remove the old parent's link (old family loses access).
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.student_guardians
     WHERE student_id = NEW.id AND profile_id = OLD.parent_id;
  END IF;

  RETURN NULL;
END;
$$;
CREATE TRIGGER students_sync_primary_guardian
  AFTER INSERT OR UPDATE OF parent_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_guardian();

-- Guard: a child always keeps at least one guardian, and the main family's
-- link only goes via a move. Cascades are detected by the referenced
-- students/profiles row no longer existing (not pg_trigger_depth()).
CREATE OR REPLACE FUNCTION public.guard_guardian_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = OLD.student_id)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.profile_id) THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.student_guardians
     WHERE student_id = OLD.student_id AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'A child must always have at least one guardian. Link another guardian first, or move the child to another family.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students
     WHERE id = OLD.student_id AND parent_id = OLD.profile_id
  ) THEN
    RAISE EXCEPTION 'This is the child''s main family. Move the child to another family instead.';
  END IF;

  RETURN OLD;
END;
$$;
CREATE TRIGGER student_guardians_guard_delete
  BEFORE DELETE ON public.student_guardians
  FOR EACH ROW EXECUTE FUNCTION public.guard_guardian_delete();
REVOKE EXECUTE ON FUNCTION public.sync_primary_guardian() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_guardian_delete() FROM PUBLIC, anon;

-- The seven parent policies: only the parent check changes.
ALTER POLICY "Parents view own students" ON public.students
  USING (public.is_guardian_of(id));

ALTER POLICY "Parents view own children attendance" ON public.attendance_events
  USING (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = attendance_events.student_id) AND public.is_guardian_of(s.id))));

ALTER POLICY "Parents view own children point events" ON public.point_events
  USING (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = point_events.student_id) AND public.is_guardian_of(s.id))));

ALTER POLICY "Parents read their own students' enrollments" ON public.student_classes
  USING (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = student_classes.student_id) AND public.is_guardian_of(s.id)))));

ALTER POLICY "Parents view own children tournament results" ON public.tournament_results
  USING (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = tournament_results.student_id) AND public.is_guardian_of(s.id))));

ALTER POLICY "Parents insert own votes before close" ON public.poll_votes
  WITH CHECK ((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_votes.poll_id) AND (p.published = true) AND ((p.closes_at IS NULL) OR (p.closes_at > now()))))) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = poll_votes.student_id) AND public.is_guardian_of(s.id))))));

ALTER POLICY "Parents update own votes before close" ON public.poll_votes
  USING ((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_votes.poll_id) AND ((p.closes_at IS NULL) OR (p.closes_at > now()))))))
  WITH CHECK ((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM polls p
  WHERE ((p.id = poll_votes.poll_id) AND ((p.closes_at IS NULL) OR (p.closes_at > now()))))) AND ((student_id IS NULL) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = poll_votes.student_id) AND public.is_guardian_of(s.id))))));

-- The four functions: copied from pg_get_functiondef, only the parent check changed.
CREATE OR REPLACE FUNCTION public.get_curriculum_for_all_children()
 RETURNS TABLE(student_id uuid, first_name text, belt_rank_id_student uuid, student_created_at timestamp with time zone, id uuid, technique text, category text, notes text, sort_order integer, belt_rank_id uuid, curriculum_tier text, rank_name text, group_label text, is_current boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- PROGRAMME BOUNDARY (Round 17): the EXISTS below is correlated to k.id — the
  -- CHILD — never to the parent. Resolving programmes per parent would let a
  -- karate-only child inherit a jiu jitsu sibling's programme and see their
  -- material. Join path mirrors public.get_technique_library() exactly:
  -- student_classes -> class_schedules.program_id. ci.program_id IS NULL means
  -- "every programme"; a child with no enrolments sees shared items only.
  --
  -- ORDERING CONTRACT: rows MUST stay contiguous by group_label within a child —
  -- the frontend accordion run-length groups them.
  WITH tiers AS (SELECT ARRAY['beginner','intermediate','advanced']::text[] AS t),
  kids AS (
    SELECT s.id, s.first_name, s.belt_rank_id, s.created_at,
           r.system_id, r.sort_order AS rank_order, r.curriculum_tier AS tier
    FROM public.students s
    LEFT JOIN public.belt_ranks r ON r.id = s.belt_rank_id
    WHERE public.is_guardian_of(s.id)
  )
  SELECT k.id,
         k.first_name,
         k.belt_rank_id,
         k.created_at,
         ci.id,
         ci.technique,
         ci.category,
         ci.notes,
         ci.sort_order,
         ci.belt_rank_id,
         ci.curriculum_tier,
         cr.name,
         CASE WHEN cr.id IS NOT NULL THEN cr.name
              ELSE 'All ' || initcap(ci.curriculum_tier) || ' students' END,
         CASE WHEN cr.id IS NOT NULL THEN (cr.id = k.belt_rank_id)
              ELSE (ci.curriculum_tier = k.tier) END,
         ci.video_youtube_id,
         ci.video_title,
         ci.video_seconds,
         ci.video_orientation
  FROM kids k
  CROSS JOIN tiers
  JOIN public.curriculum_items ci ON ci.active = true
  LEFT JOIN public.belt_ranks cr ON cr.id = ci.belt_rank_id
  WHERE k.belt_rank_id IS NOT NULL
    AND (
      ci.program_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.student_classes sc
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE sc.student_id = k.id
          AND cs.program_id = ci.program_id
      )
    )
    AND (
      (cr.id IS NOT NULL AND cr.system_id = k.system_id AND cr.sort_order <= k.rank_order)
      OR (
        ci.belt_rank_id IS NULL
        AND ci.curriculum_tier IS NOT NULL
        AND k.tier IS NOT NULL
        AND array_position(tiers.t, ci.curriculum_tier) <= array_position(tiers.t, k.tier)
      )
    )
  ORDER BY k.created_at,
           k.id,
           (CASE WHEN cr.id IS NOT NULL THEN (cr.id = k.belt_rank_id)
                 ELSE (ci.curriculum_tier = k.tier) END) DESC,
           (cr.id IS NULL),
           cr.sort_order DESC NULLS LAST,
           array_position(tiers.t, ci.curriculum_tier) DESC NULLS LAST,
           ci.sort_order,
           ci.technique;
$function$;

CREATE OR REPLACE FUNCTION public.get_curriculum_for_student(_student_id uuid)
 RETURNS TABLE(id uuid, technique text, category text, notes text, sort_order integer, belt_rank_id uuid, curriculum_tier text, rank_name text, group_label text, is_current boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parent uuid;
  v_rank uuid;
  v_tier text;
  v_system uuid;
  v_rank_order integer;
  v_tiers text[] := ARRAY['beginner', 'intermediate', 'advanced'];
BEGIN
  SELECT s.parent_id, s.belt_rank_id INTO v_parent, v_rank
  FROM public.students s WHERE s.id = _student_id;

  IF v_parent IS NULL THEN
    RETURN;
  END IF;

  IF NOT (public.is_guardian_of(_student_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized for this student';
  END IF;

  IF v_rank IS NULL THEN
    RETURN;
  END IF;

  SELECT r.curriculum_tier, r.system_id, r.sort_order
    INTO v_tier, v_system, v_rank_order
  FROM public.belt_ranks r WHERE r.id = v_rank;

  -- The library only grows, and only within one belt system: a student keeps
  -- every rank at or below their own in their own system, and every tier-wide
  -- item at or below their own tier. Cross-system material retires entirely.
  --
  -- PROGRAMME BOUNDARY (Round 17): belt system is NOT a programme. Teen Karate,
  -- Adult Karate and Tai Chi are one programme taught by a different instructor
  -- while sharing the Solid Belt system with children's karate. A student's
  -- programmes therefore come ONLY from their class enrolments —
  -- students -> student_classes -> class_schedules.program_id — mirroring
  -- public.get_technique_library(), which is the reference implementation for
  -- this join. Do not add a second way to resolve a programme, and never match
  -- programmes by display name. ci.program_id IS NULL means "every programme".
  -- A student with no enrolments matches nothing, so they see shared items only.
  --
  -- ORDERING CONTRACT: the frontend accordion groups "already earned" rows with
  -- a run-length loop over group_label, so rows MUST stay contiguous by
  -- group_label. Reordering the ORDER BY below without preserving that grouping
  -- silently splits one belt group into several headings in the UI.
  RETURN QUERY
  SELECT ci.id,
         ci.technique,
         ci.category,
         ci.notes,
         ci.sort_order,
         ci.belt_rank_id,
         ci.curriculum_tier,
         cr.name AS rank_name,
         CASE
           WHEN cr.id IS NOT NULL THEN cr.name
           ELSE 'All ' || initcap(ci.curriculum_tier) || ' students'
         END AS group_label,
         CASE
           WHEN cr.id IS NOT NULL THEN (cr.id = v_rank)
           ELSE (ci.curriculum_tier = v_tier)
         END AS is_current,
         ci.video_youtube_id,
         ci.video_title,
         ci.video_seconds,
         ci.video_orientation
  FROM public.curriculum_items ci
  LEFT JOIN public.belt_ranks cr ON cr.id = ci.belt_rank_id
  WHERE ci.active = true
    AND (
      ci.program_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.student_classes sc
        JOIN public.class_schedules cs ON cs.id = sc.class_id
        WHERE sc.student_id = _student_id
          AND cs.program_id = ci.program_id
      )
    )
    AND (
      (cr.id IS NOT NULL AND cr.system_id = v_system AND cr.sort_order <= v_rank_order)
      OR (
        ci.belt_rank_id IS NULL
        AND ci.curriculum_tier IS NOT NULL
        AND v_tier IS NOT NULL
        AND array_position(v_tiers, ci.curriculum_tier) <= array_position(v_tiers, v_tier)
      )
    )
  ORDER BY (CASE
              WHEN cr.id IS NOT NULL THEN (cr.id = v_rank)
              ELSE (ci.curriculum_tier = v_tier)
            END) DESC,
           (cr.id IS NULL),
           cr.sort_order DESC NULLS LAST,
           array_position(v_tiers, ci.curriculum_tier) DESC NULLS LAST,
           ci.sort_order,
           ci.technique;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_division()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.division_of(s.id)
  FROM public.students s
  WHERE public.is_guardian_of(s.id)
    AND s.active = true
    AND public.division_of(s.id) IS NOT NULL
  ORDER BY s.created_at
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_technique_library()
 RETURNS TABLE(id uuid, program_id uuid, program_name text, label text, title text, category text, difficulty text, notes text, sort_order integer, published boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.program_id, pr.name, tl.label, tl.title,
         tl.category, tl.difficulty, tl.notes, tl.sort_order,
         tl.published, tl.video_youtube_id, tl.video_title, tl.video_seconds,
         tl.video_orientation
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
        WHERE public.is_guardian_of(s.id)
          AND s.active = true
          AND cs.program_id = tl.program_id
      )
    )
  ORDER BY tl.category, tl.sort_order, tl.title;
$function$;

-- Per-child photo consent: most restrictive wins. Admin-only rows.
CREATE VIEW public.student_photo_consent WITH (security_invoker = true) AS
SELECT g.student_id,
       count(*)::int AS guardian_count,
       count(*) FILTER (WHERE p.photo_consent = false)::int AS consent_off_count,
       bool_or(p.photo_consent = false) AS no_photos,
       (bool_or(p.photo_consent = false) AND bool_or(p.photo_consent = true)) AS conflict
FROM public.student_guardians g
JOIN public.profiles p ON p.id = g.profile_id
WHERE public.has_role(auth.uid(), 'admin')
GROUP BY g.student_id;
GRANT SELECT ON public.student_photo_consent TO authenticated;
GRANT SELECT ON public.student_photo_consent TO service_role;