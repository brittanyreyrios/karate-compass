-- 1a) Lock profile updates to family_name only
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (family_name) ON public.profiles TO authenticated;

-- 1c) Leaderboard privacy: last name -> initial
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE(id uuid, first_name text, last_name text, current_belt text, class_name text, points integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id,
         first_name,
         CASE WHEN last_name IS NULL OR btrim(last_name) = '' THEN ''
              ELSE upper(left(btrim(last_name), 1)) || '.' END AS last_name,
         current_belt,
         class_name,
         points
  FROM public.students
  WHERE active = true
  ORDER BY points DESC, first_name ASC
  LIMIT 10;
$function$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

-- 1d) Invite codes
CREATE TABLE public.invite_codes (
  code text PRIMARY KEY,
  label text,
  active boolean NOT NULL DEFAULT true,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invite_codes TO authenticated;
GRANT ALL ON public.invite_codes TO service_role;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select invite codes" ON public.invite_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert invite codes" ON public.invite_codes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update invite codes" ON public.invite_codes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete invite codes" ON public.invite_codes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Gate sign-ups on a valid invite code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_matched text;
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

  INSERT INTO public.profiles (id, email, family_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'family_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent');
  RETURN NEW;
END;
$function$;

-- 2d) Dojo point guidelines
CREATE TABLE public.dojo_point_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dojo_point_guidelines TO authenticated;
GRANT ALL ON public.dojo_point_guidelines TO service_role;

ALTER TABLE public.dojo_point_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in views guidelines" ON public.dojo_point_guidelines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage guidelines" ON public.dojo_point_guidelines
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_dojo_point_guidelines_updated_at
  BEFORE UPDATE ON public.dojo_point_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.dojo_point_guidelines (rule_text, sort_order) VALUES
  ('+1 for attendance', 1),
  ('+5 for exceptional focus', 2),
  ('+5 for helping clean the mats', 3);
