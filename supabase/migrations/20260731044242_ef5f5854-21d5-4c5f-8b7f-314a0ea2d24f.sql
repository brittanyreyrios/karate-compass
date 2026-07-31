-- 1. Photo consent + media release
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_consent_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_release_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_release_version text;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (family_name, photo_consent, photo_consent_updated_at) ON public.profiles TO authenticated;

-- 2. Invite code pre-check
CREATE OR REPLACE FUNCTION public.check_invite_code(_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invite_codes
    WHERE upper(code) = upper(trim(_code))
      AND active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND used_count < max_uses
  );
$$;
REVOKE ALL ON FUNCTION public.check_invite_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_invite_code(text) TO anon, authenticated;

-- 3. Gallery albums
CREATE TABLE IF NOT EXISTS public.gallery_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date,
  external_url text NOT NULL,
  cover_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_albums TO authenticated;
GRANT ALL ON public.gallery_albums TO service_role;
ALTER TABLE public.gallery_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in view active albums" ON public.gallery_albums
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert albums" ON public.gallery_albums
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update albums" ON public.gallery_albums
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete albums" ON public.gallery_albums
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.gallery_albums (title, external_url, cover_image_url, sort_order)
VALUES ('Summer Camp', '', NULL, 0),
       ('Swat Team', '', NULL, 1),
       ('Evening Classes — Last Week', '', NULL, 2);

-- 4. Curriculum items (intentionally seeded with nothing)
CREATE TABLE IF NOT EXISTS public.curriculum_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belt text NOT NULL,
  technique text NOT NULL,
  category text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_items TO authenticated;
GRANT ALL ON public.curriculum_items TO service_role;
ALTER TABLE public.curriculum_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in view active curriculum" ON public.curriculum_items
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert curriculum" ON public.curriculum_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update curriculum" ON public.curriculum_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete curriculum" ON public.curriculum_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Tournament seeds (name + discipline + date only; every other field blank)
INSERT INTO public.announcements (category, title, body, tag, discipline, location, event_date)
VALUES ('tournament', 'ISKF Open', '', NULL, 'Karate', '', DATE '2027-01-23'),
       ('tournament', 'Jiu Jitsu World League', '', NULL, 'Jiu Jitsu', '', DATE '2026-08-22'),
       ('tournament', 'IBJJF Open', '', NULL, 'Jiu Jitsu', '', DATE '2026-10-10');

-- 6. Case-insensitive email indexes
CREATE INDEX IF NOT EXISTS profiles_lower_email_idx ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS pending_imports_lower_parent_email_idx ON public.pending_student_imports (lower(parent_email));

-- 7. handle_new_user: invite gate (unchanged) + media release stamp + auto-link
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_code text;
  v_matched text;
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

  INSERT INTO public.profiles (id, email, family_name, media_release_accepted_at, media_release_version)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'family_name', split_part(NEW.email, '@', 1)),
    now(),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'media_release_version', '')), '')
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