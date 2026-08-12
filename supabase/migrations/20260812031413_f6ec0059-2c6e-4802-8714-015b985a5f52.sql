-- ============ AT1: programmes ============
CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read programmes"
  ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage programmes"
  ON public.programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER programs_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT INSERT, UPDATE, DELETE ON public.programs TO authenticated;

INSERT INTO public.programs (name, sort_order) VALUES
  ('Karate', 0), ('Jiu Jitsu & Wrestling', 1), ('Tai Chi', 2);

-- AT2: a class belongs to one programme (unassigned until Britt confirms)
ALTER TABLE public.class_schedules
  ADD COLUMN program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;

-- ============ AS1: the join table ============
CREATE TABLE public.student_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_classes TO authenticated;
GRANT ALL ON public.student_classes TO service_role;
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;

-- Parents read their own children's enrollments; only admins may write.
CREATE POLICY "Parents read their own students' enrollments"
  ON public.student_classes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.parent_id = auth.uid())
  );
CREATE POLICY "Admins insert enrollments"
  ON public.student_classes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update enrollments"
  ON public.student_classes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete enrollments"
  ON public.student_classes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX student_classes_student_idx ON public.student_classes (student_id);
CREATE INDEX student_classes_class_idx ON public.student_classes (class_id);
-- At most one primary row per student, enforced by the database, not by code.
CREATE UNIQUE INDEX student_classes_one_primary_idx
  ON public.student_classes (student_id) WHERE is_primary;

-- ============ AS2: migrate existing membership ============
DO $mig$
DECLARE
  v_migrated integer;
  v_unmatched integer;
  v_empty_classes integer;
  r record;
BEGIN
  INSERT INTO public.student_classes (student_id, class_id, is_primary)
  SELECT s.id, cs.id, true
  FROM public.students s
  JOIN public.class_schedules cs
    ON lower(btrim(cs.class_name)) = lower(btrim(s.class_name))
  ON CONFLICT (student_id, class_id) DO NOTHING;
  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  SELECT count(*) INTO v_unmatched
  FROM public.students s
  WHERE NOT EXISTS (SELECT 1 FROM public.student_classes sc WHERE sc.student_id = s.id);

  SELECT count(*) INTO v_empty_classes
  FROM public.class_schedules cs
  WHERE NOT EXISTS (SELECT 1 FROM public.student_classes sc WHERE sc.class_id = cs.id);

  RAISE NOTICE 'AS2 students migrated: %', v_migrated;
  RAISE NOTICE 'AS2 students matching no class row: %', v_unmatched;
  RAISE NOTICE 'AS2 classes with no students: %', v_empty_classes;

  FOR r IN
    SELECT s.first_name, s.last_name, s.class_name FROM public.students s
    WHERE NOT EXISTS (SELECT 1 FROM public.student_classes sc WHERE sc.student_id = s.id)
  LOOP
    RAISE NOTICE 'AS2 unmatched student: % % (class_name=%)', r.first_name, r.last_name, r.class_name;
  END LOOP;
END
$mig$;

-- ============ AS3: class_name becomes derived-only ============
-- The ONLY writer of students.class_name from here on. Application code must
-- never write it again; membership lives in student_classes.
CREATE OR REPLACE FUNCTION public.sync_primary_class_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_label text;
BEGIN
  v_student := COALESCE(NEW.student_id, OLD.student_id);

  -- Auto-promote: if the student has rows but no primary (e.g. the primary was
  -- just removed), the oldest remaining enrollment becomes primary.
  IF NOT EXISTS (
    SELECT 1 FROM public.student_classes WHERE student_id = v_student AND is_primary
  ) THEN
    UPDATE public.student_classes sc
    SET is_primary = true
    WHERE sc.id = (
      SELECT id FROM public.student_classes
      WHERE student_id = v_student
      ORDER BY created_at, id
      LIMIT 1
    );
  END IF;

  SELECT cs.class_name INTO v_label
  FROM public.student_classes sc
  JOIN public.class_schedules cs ON cs.id = sc.class_id
  WHERE sc.student_id = v_student AND sc.is_primary;

  UPDATE public.students
  SET class_name = COALESCE(v_label, 'Unassigned')
  WHERE id = v_student
    AND class_name IS DISTINCT FROM COALESCE(v_label, 'Unassigned');

  RETURN NULL;
END;
$$;

CREATE TRIGGER student_classes_sync_label
AFTER INSERT OR UPDATE OR DELETE ON public.student_classes
FOR EACH ROW EXECUTE FUNCTION public.sync_primary_class_name();

-- ============ AS4: readers move to the relationship ============
DROP FUNCTION IF EXISTS public.division_of(uuid, text);

CREATE OR REPLACE FUNCTION public.division_of(_student_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
               ELSE NULL
             END
      FROM public.belt_ranks r
      JOIN public.belt_systems sy ON sy.id = r.system_id
      WHERE r.id = s.belt_rank_id
    )
  END
  FROM public.students s
  WHERE s.id = _student_id;
$$;

REVOKE EXECUTE ON FUNCTION public.division_of(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.division_of(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
RETURNS TABLE(id uuid, first_name text, last_initial text, rank_name text, rank_short_name text, pattern text, color_primary text, color_accent text, class_name text, period_points integer, uses_belts boolean)
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
    AND public.division_of(st.id) = _division
    AND COALESCE(pts.total, 0) > 0
  ORDER BY COALESCE(pts.total, 0) DESC, st.first_name ASC
  LIMIT 10;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_division()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.division_of(s.id)
  FROM public.students s
  WHERE s.parent_id = auth.uid()
    AND s.active = true
    AND public.division_of(s.id) IS NOT NULL
  ORDER BY s.created_at
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_division() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_division() TO authenticated, service_role;

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
         (SELECT count(*) FROM public.student_classes sc
          JOIN public.students s ON s.id = sc.student_id
          WHERE sc.class_id = cs.id AND s.active = true)::integer
  FROM public.class_schedules cs
  ORDER BY cs.class_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.class_student_counts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.class_student_counts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_class_test_date(_schedule_id uuid, _date date, _post_announcement boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class text;
  v_location text;
  v_existing uuid;
  v_count integer := 0;
  v_action text := 'none';
  v_pretty text;
  v_title text;
  v_body text;
  v_new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT cs.class_name, cs.location, cs.test_announcement_id
    INTO v_class, v_location, v_existing
  FROM public.class_schedules cs WHERE cs.id = _schedule_id;

  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  UPDATE public.class_schedules SET next_test_date = _date WHERE id = _schedule_id;

  -- Round 12: membership through the join table, never a name comparison.
  UPDATE public.students s
  SET next_test_date = _date
  WHERE EXISTS (
    SELECT 1 FROM public.student_classes sc
    WHERE sc.student_id = s.id AND sc.class_id = _schedule_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF (_date IS NULL OR NOT COALESCE(_post_announcement, false)) AND v_existing IS NOT NULL THEN
    DELETE FROM public.announcements WHERE id = v_existing;
    UPDATE public.class_schedules SET test_announcement_id = NULL WHERE id = _schedule_id;
    v_action := 'deleted';
  ELSIF _date IS NOT NULL AND COALESCE(_post_announcement, false) THEN
    v_pretty := to_char(_date, 'FMDay, FMMonth FMDD, YYYY');
    v_title := 'Belt testing — ' || v_class;
    v_body := v_class || ' tests on ' || v_pretty || '.'
      || CASE WHEN v_location IS NOT NULL AND btrim(v_location) <> ''
              THEN ' Location: ' || v_location || '.' ELSE '' END
      || ' Ask your instructor on the mat for what to prepare.';

    IF v_existing IS NOT NULL THEN
      UPDATE public.announcements
      SET category = 'school_news', title = v_title, body = v_body,
          event_date = _date, location = v_location
      WHERE id = v_existing;
      v_action := 'updated';
    ELSE
      INSERT INTO public.announcements (category, title, body, event_date, location, created_by)
      VALUES ('school_news', v_title, v_body, _date, v_location, auth.uid())
      RETURNING id INTO v_new_id;
      UPDATE public.class_schedules SET test_announcement_id = v_new_id WHERE id = _schedule_id;
      v_action := 'created';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'class_name', v_class,
    'students_updated', v_count,
    'announcement_action', v_action,
    'cleared', _date IS NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_class_test_date(uuid, date, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_class_test_date(uuid, date, boolean) TO authenticated, service_role;

-- ============ AS5: enrollment at signup ============
ALTER TABLE public.pending_student_imports
  ADD COLUMN class_id uuid REFERENCES public.class_schedules(id) ON DELETE SET NULL;

UPDATE public.pending_student_imports p
SET class_id = cs.id
FROM public.class_schedules cs
WHERE p.class_id IS NULL
  AND lower(btrim(cs.class_name)) = lower(btrim(p.class_name));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_matched text;
  v_photo boolean;
  v_release text;
  v_belt text;
  v_rank uuid;
  v_class uuid;
  v_student uuid;
  r record;
BEGIN
  v_code := btrim(COALESCE(NEW.raw_user_meta_data->>'invite_code', ''));

  SELECT code INTO v_matched
  FROM public.invite_codes
  WHERE upper(code) = upper(v_code)
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND used_count < max_uses
  FOR UPDATE;

  IF v_matched IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  UPDATE public.invite_codes SET used_count = used_count + 1 WHERE code = v_matched;

  v_photo := COALESCE((NEW.raw_user_meta_data->>'photo_consent')::boolean, false);
  v_release := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'media_release_version', '')), '');

  INSERT INTO public.profiles (
    id, email, family_name,
    photo_consent, photo_consent_updated_at,
    media_release_version, media_release_accepted_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'family_name', split_part(NEW.email, '@', 1)),
    v_photo,
    CASE WHEN v_photo THEN now() ELSE NULL END,
    v_release,
    CASE WHEN v_release IS NOT NULL THEN now() ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent');

  -- Auto-link parked roster rows. Never allowed to block signup.
  BEGIN
    FOR r IN
      SELECT * FROM public.pending_student_imports
      WHERE lower(btrim(parent_email)) = lower(btrim(NEW.email))
    LOOP
      v_student := NULL;
      IF NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.parent_id = NEW.id
          AND lower(btrim(s.first_name)) = lower(btrim(r.first_name))
          AND lower(btrim(s.last_name)) = lower(btrim(r.last_name))
      ) THEN
        v_belt := COALESCE(NULLIF(btrim(r.current_belt), ''), 'White');
        v_rank := COALESCE(r.belt_rank_id, public.resolve_belt_rank_id(v_belt));

        -- Round 12 AS5: the class is resolved at import time, where a human is
        -- watching. Fall back to the normalised name match only for rows parked
        -- before the column existed.
        v_class := r.class_id;
        IF v_class IS NULL THEN
          SELECT cs.id INTO v_class FROM public.class_schedules cs
          WHERE lower(btrim(cs.class_name)) = lower(btrim(COALESCE(r.class_name, '')))
          LIMIT 1;
        END IF;

        INSERT INTO public.students (parent_id, first_name, last_name, current_belt, belt_rank_id, class_name, start_date)
        VALUES (
          NEW.id, r.first_name, r.last_name,
          v_belt,
          v_rank,
          COALESCE(NULLIF(btrim(r.class_name), ''), 'Unassigned'),
          COALESCE(r.start_date, CURRENT_DATE)
        )
        RETURNING id INTO v_student;

        IF v_student IS NOT NULL AND v_class IS NOT NULL THEN
          INSERT INTO public.student_classes (student_id, class_id, is_primary)
          VALUES (v_student, v_class, true)
          ON CONFLICT (student_id, class_id) DO NOTHING;
        END IF;
      END IF;
      DELETE FROM public.pending_student_imports WHERE id = r.id;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto-link of pending students failed for %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$$;