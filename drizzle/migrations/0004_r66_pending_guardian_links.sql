-- Round 66: pre-link a second guardian by email; attached at signup.
CREATE TABLE public.pending_guardian_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(btrim(email))),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_guardian_links TO authenticated;
GRANT ALL ON public.pending_guardian_links TO service_role;

ALTER TABLE public.pending_guardian_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pending guardian links"
ON public.pending_guardian_links
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

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

  -- Round 66: attach pre-linked second guardians. Never allowed to block signup.
  BEGIN
    FOR r IN
      SELECT * FROM public.pending_guardian_links
      WHERE email = lower(btrim(NEW.email))
    LOOP
      INSERT INTO public.student_guardians (student_id, profile_id, is_primary)
      VALUES (r.student_id, NEW.id, false)
      ON CONFLICT (student_id, profile_id) DO NOTHING;
      DELETE FROM public.pending_guardian_links WHERE id = r.id;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pending guardian link failed for %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;