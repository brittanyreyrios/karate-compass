CREATE OR REPLACE FUNCTION public.resolve_belt_rank_id(_belt text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id
  FROM public.belt_ranks r
  JOIN public.belt_systems sy ON sy.id = r.system_id
  WHERE r.active = true
    AND NULLIF(btrim(COALESCE(_belt, '')), '') IS NOT NULL
    AND (
      lower(btrim(r.name)) = lower(btrim(_belt))
      OR lower(btrim(COALESCE(r.short_name, ''))) = lower(btrim(_belt))
    )
  ORDER BY sy.sort_order, r.sort_order
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_belt_rank_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_belt_rank_id(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        -- Resolve the rank across all three belt systems. No match => NULL,
        -- surfaced by the "No belt rank set" filter in the admin roster.
        v_rank := public.resolve_belt_rank_id(v_belt);

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

CREATE OR REPLACE FUNCTION public.get_curriculum_for_student(_student_id uuid)
RETURNS TABLE(
  id uuid,
  technique text,
  category text,
  notes text,
  sort_order integer,
  belt_rank_id uuid,
  curriculum_tier text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent uuid;
  v_rank uuid;
  v_tier text;
BEGIN
  SELECT s.parent_id, s.belt_rank_id INTO v_parent, v_rank
  FROM public.students s WHERE s.id = _student_id;

  IF v_parent IS NULL THEN
    RETURN;
  END IF;

  IF NOT (v_parent = auth.uid() OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized for this student';
  END IF;

  IF v_rank IS NULL THEN
    RETURN;
  END IF;

  SELECT r.curriculum_tier INTO v_tier FROM public.belt_ranks r WHERE r.id = v_rank;

  RETURN QUERY
  SELECT ci.id, ci.technique, ci.category, ci.notes, ci.sort_order, ci.belt_rank_id, ci.curriculum_tier
  FROM public.curriculum_items ci
  WHERE ci.active = true
    AND (
      ci.belt_rank_id = v_rank
      OR (ci.curriculum_tier IS NOT NULL AND v_tier IS NOT NULL AND ci.curriculum_tier = v_tier)
    )
  ORDER BY ci.sort_order, ci.technique;
END;
$$;

REVOKE ALL ON FUNCTION public.get_curriculum_for_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_curriculum_for_student(uuid) TO authenticated, service_role;