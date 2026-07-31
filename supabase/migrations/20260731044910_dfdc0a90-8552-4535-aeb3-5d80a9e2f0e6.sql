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
    CASE WHEN v_photo THEN v_release ELSE NULL END,
    CASE WHEN v_photo AND v_release IS NOT NULL THEN now() ELSE NULL END
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
        INSERT INTO public.students (parent_id, first_name, last_name, current_belt, class_name, start_date)
        VALUES (
          NEW.id, r.first_name, r.last_name,
          COALESCE(NULLIF(btrim(r.current_belt), ''), 'White'),
          COALESCE(NULLIF(btrim(r.class_name), ''), 'Little Tigers'),
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