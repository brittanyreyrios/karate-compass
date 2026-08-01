-- Events calendar (Section C2) + class_schedules timetable seed (Section C0).
-- The timetable values below are the authoritative printed schedule and are
-- applied idempotently, superseding earlier placeholder schedule seeds.

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'other',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  audience_label text,
  published boolean NOT NULL DEFAULT true,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events (starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed in view published events" ON public.events;
CREATE POLICY "Signed in view published events" ON public.events
  FOR SELECT TO authenticated
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert events" ON public.events;
CREATE POLICY "Admins insert events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update events" ON public.events;
CREATE POLICY "Admins update events" ON public.events
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete events" ON public.events;
CREATE POLICY "Admins delete events" ON public.events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Class timetable: authoritative values, safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS class_schedules_class_name_key
  ON public.class_schedules (class_name);

INSERT INTO public.class_schedules (class_name, days, time_start, time_end, location)
VALUES
  ('Tiny Tigers',                      'Mon/Wed', '5:15pm', '5:45pm', 'Large Dojo'),
  ('Tiger Cubs',                       'Mon/Wed', '5:15pm', '5:45pm', 'Small Dojo'),
  ('Young Tigers',                     'Mon/Wed', '5:45pm', '6:30pm', 'Large Dojo'),
  ('Teen Karate',                      'Mon/Wed', '6:30pm', '7:15pm', 'Small Dojo'),
  ('Karate Beginners',                 'Mon/Wed', '6:30pm', '7:15pm', 'Large Dojo'),
  ('Adult Karate',                     'Mon/Wed', '7:15pm', '8:00pm', 'Large Dojo'),
  ('Adult Striking',                   'Mon/Wed', '7:15pm', '8:00pm', 'V12'),
  ('Kid''s Jiu Jitsu',                 'Tue/Thu', '5:15pm', '6:00pm', 'Large Dojo'),
  ('Intermediate Karate',              'Tue/Thu', '6:00pm', '6:45pm', 'Large Dojo'),
  ('Tai Chi',                          'Tue/Thu', '6:00pm', '7:00pm', 'Small Dojo'),
  ('Intermediate / Advanced Children', 'Tue/Thu', '6:45pm', '7:30pm', 'Large Dojo'),
  ('Adult Jiu Jitsu & Wrestling',      'Tue/Thu', '7:30pm', '8:30pm', 'Large Dojo')
ON CONFLICT (class_name) DO UPDATE SET
  days = EXCLUDED.days,
  time_start = EXCLUDED.time_start,
  time_end = EXCLUDED.time_end,
  location = EXCLUDED.location;