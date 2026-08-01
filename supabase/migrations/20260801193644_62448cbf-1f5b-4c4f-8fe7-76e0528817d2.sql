-- SECTION E — POINTS AUDIT LOG
CREATE TABLE public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text,
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;

CREATE INDEX point_events_student_idx ON public.point_events(student_id, occurred_on DESC);

ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view point events" ON public.point_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parents view own children point events" ON public.point_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = point_events.student_id AND s.parent_id = auth.uid()));
CREATE POLICY "Admins insert point events" ON public.point_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update point events" ON public.point_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete point events" ON public.point_events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SECTION G — PHOTO CONSENT CHANGE LOG
CREATE TABLE public.photo_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  new_value boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, UPDATE ON public.photo_consent_events TO authenticated;
GRANT ALL ON public.photo_consent_events TO service_role;

CREATE INDEX photo_consent_events_ack_idx ON public.photo_consent_events(acknowledged_at);
CREATE INDEX photo_consent_events_profile_idx ON public.photo_consent_events(profile_id, changed_at DESC);

ALTER TABLE public.photo_consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view consent events" ON public.photo_consent_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parents view own consent events" ON public.photo_consent_events FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
CREATE POLICY "Admins acknowledge consent events" ON public.photo_consent_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Capture every change regardless of how it is made.
CREATE OR REPLACE FUNCTION public.log_photo_consent_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.photo_consent THEN
      INSERT INTO public.photo_consent_events (profile_id, new_value) VALUES (NEW.id, NEW.photo_consent);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.photo_consent IS DISTINCT FROM OLD.photo_consent THEN
    INSERT INTO public.photo_consent_events (profile_id, new_value) VALUES (NEW.id, NEW.photo_consent);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_log_photo_consent
AFTER INSERT OR UPDATE OF photo_consent ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_photo_consent_change();

-- Lock down function execution to signed-in callers only.
REVOKE EXECUTE ON FUNCTION public.get_poll_results(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_poll_breakdown(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_poll_single_select() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_photo_consent_change() FROM PUBLIC, anon;