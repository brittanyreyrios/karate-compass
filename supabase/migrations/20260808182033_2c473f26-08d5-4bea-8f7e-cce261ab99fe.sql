-- ============================================================
-- Round 10 — AK / AL / AM / AO1
-- ============================================================

-- AK1/AK3: a program can exist without belts. Data-driven, so a future
-- beltless program needs no code change.
ALTER TABLE public.belt_systems
  ADD COLUMN IF NOT EXISTS uses_belts boolean NOT NULL DEFAULT true;

-- AK2: fourth system, seeded with a single level. Colours are stored but never
-- rendered as a belt graphic because uses_belts = false.
INSERT INTO public.belt_systems (slug, name, age_guidance, sort_order, uses_belts)
VALUES ('tai_chi', 'Tai Chi', 'Adults', 4, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.belt_ranks (
  system_id, name, short_name, pattern, color_primary, color_accent,
  curriculum_tier, sort_order, active
)
SELECT sy.id, 'Tai Chi Flow', 'Flow', 'solid', '#3f3f46', NULL, 'beginner', 0, true
FROM public.belt_systems sy
WHERE sy.slug = 'tai_chi'
  AND NOT EXISTS (
    SELECT 1 FROM public.belt_ranks r
    WHERE r.system_id = sy.id AND lower(btrim(r.name)) = 'tai chi flow'
  );

-- AK5: migrate the students already in the roster. Identified by class name
-- (confirmed with the school: "Tai Chi" only), normalised the same way as
-- division_of and class_student_counts.
UPDATE public.students s
SET belt_rank_id = (
  SELECT r.id FROM public.belt_ranks r
  JOIN public.belt_systems sy ON sy.id = r.system_id
  WHERE sy.slug = 'tai_chi' AND lower(btrim(r.name)) = 'tai chi flow'
)
WHERE s.belt_rank_id IS NULL
  AND lower(btrim(s.class_name)) = 'tai chi';

-- ============================================================
-- AL: parked roster rows must carry a resolved rank.
-- ============================================================
ALTER TABLE public.pending_student_imports
  ADD COLUMN IF NOT EXISTS belt_rank_id uuid REFERENCES public.belt_ranks(id);

-- Backfill already-parked rows with the same matcher the importer uses.
-- Ambiguous names resolve to NULL by design.
UPDATE public.pending_student_imports p
SET belt_rank_id = COALESCE(
  CASE WHEN lower(btrim(p.class_name)) = 'tai chi' THEN (
    SELECT r.id FROM public.belt_ranks r
    JOIN public.belt_systems sy ON sy.id = r.system_id
    WHERE sy.slug = 'tai_chi' AND lower(btrim(r.name)) = 'tai chi flow'
  ) END,
  public.resolve_belt_rank_id(p.current_belt)
)
WHERE p.belt_rank_id IS NULL;

-- handle_new_user: copy the parked rank across. The linking block stays inside
-- BEGIN ... EXCEPTION — a rank lookup must never block a signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_matched text;
  v_photo boolean;
  v_release text;
  v_belt text;
  v_rank uuid;
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
      IF NOT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.parent_id = NEW.id
          AND lower(btrim(s.first_name)) = lower(btrim(r.first_name))
          AND lower(btrim(s.last_name)) = lower(btrim(r.last_name))
      ) THEN
        v_belt := COALESCE(NULLIF(btrim(r.current_belt), ''), 'White');
        -- Round 10 AL: the rank is resolved when the row is parked, by a human
        -- watching the importer. Fall back to the name matcher only for rows
        -- parked before that column existed. Ambiguous => NULL, never a guess.
        v_rank := COALESCE(r.belt_rank_id, public.resolve_belt_rank_id(v_belt));

        INSERT INTO public.students (parent_id, first_name, last_name, current_belt, belt_rank_id, class_name, start_date)
        VALUES (
          NEW.id, r.first_name, r.last_name,
          v_belt,
          v_rank,
          COALESCE(NULLIF(btrim(r.class_name), ''), 'Unassigned'),
          COALESCE(r.start_date, CURRENT_DATE)
        );
      END IF;
      DELETE FROM public.pending_student_imports WHERE id = r.id;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto-link of pending students failed for %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- AM: move a student to another parent account.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reassign_student(
  _student_id uuid,
  _new_parent_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_parent uuid;
  v_family text;
  v_old_parent uuid;
  v_name text;
BEGIN
  -- A definer function bypasses RLS: this check IS the security boundary.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT s.parent_id, s.first_name || ' ' || s.last_name
    INTO v_old_parent, v_name
  FROM public.students s WHERE s.id = _student_id;

  IF v_old_parent IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  SELECT p.id, p.family_name INTO v_new_parent, v_family
  FROM public.profiles p
  WHERE lower(btrim(p.email)) = lower(btrim(_new_parent_email));

  IF v_new_parent IS NULL THEN
    RAISE EXCEPTION 'No account found for that email — ask them to sign up first';
  END IF;

  IF v_new_parent = v_old_parent THEN
    RAISE EXCEPTION 'That student is already on this account';
  END IF;

  UPDATE public.students SET parent_id = v_new_parent WHERE id = _student_id;

  RETURN jsonb_build_object(
    'student_id', _student_id,
    'student_name', v_name,
    'old_parent_id', v_old_parent,
    'new_parent_id', v_new_parent,
    'new_family_name', v_family
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_reassign_student(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_reassign_student(uuid, text) TO authenticated, service_role;

-- ============================================================
-- AO1: testing date + student dates + announcement, in one transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_class_test_date(
  _schedule_id uuid,
  _date date,
  _post_announcement boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Normalised comparison, matching division_of and class_student_counts. A
  -- trailing space in a class name must not silently reach zero students.
  UPDATE public.students s
  SET next_test_date = _date
  WHERE lower(btrim(s.class_name)) = lower(btrim(v_class));
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Announcement lifecycle, unchanged from Round 5: clearing the date or
  -- unticking the box deletes it; an existing one is edited, never re-posted.
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
$function$;

REVOKE EXECUTE ON FUNCTION public.set_class_test_date(uuid, date, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_class_test_date(uuid, date, boolean) TO authenticated, service_role;