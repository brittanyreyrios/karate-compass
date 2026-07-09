
-- Extend class_schedules with schedule details
ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS days text,
  ADD COLUMN IF NOT EXISTS time_start text,
  ADD COLUMN IF NOT EXISTS time_end text,
  ADD COLUMN IF NOT EXISTS location text;

-- Ensure class_name is unique so we can upsert / reference by name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_schedules_class_name_key'
  ) THEN
    ALTER TABLE public.class_schedules
      ADD CONSTRAINT class_schedules_class_name_key UNIQUE (class_name);
  END IF;
END $$;

-- Seed the 12 canonical classes
INSERT INTO public.class_schedules (class_name, days, time_start, time_end, location) VALUES
  ('Tiny Tigers',                       'Mon/Wed', '5:15pm', '5:45pm', 'Large Dojo'),
  ('Tiger Cubs',                        'Mon/Wed', '5:15pm', '5:45pm', 'Small Dojo'),
  ('Young Tigers',                      'Mon/Wed', '5:45pm', '6:30pm', 'Large Dojo'),
  ('Teen Karate',                       'Mon/Wed', '6:30pm', '7:15pm', 'Small Dojo'),
  ('Karate Beginners',                  'Mon/Wed', '6:30pm', '7:15pm', 'Large Dojo'),
  ('Adult Karate',                      'Mon/Wed', '7:15pm', '8:00pm', 'Large Dojo'),
  ('Adult Striking',                    'Mon/Wed', '7:15pm', '8:00pm', 'V12'),
  ('Kid''s Jiu Jitsu',                  'Tue/Thu', '5:15pm', '6:00pm', 'Large Dojo'),
  ('Intermediate Karate',               'Tue/Thu', '6:00pm', '6:45pm', 'Large Dojo'),
  ('Tai Chi',                           'Tue/Thu', '6:00pm', '7:00pm', 'Small Dojo'),
  ('Intermediate / Advanced Children',  'Tue/Thu', '6:45pm', '7:30pm', 'Large Dojo'),
  ('Adult Jiu Jitsu & Wrestling',       'Tue/Thu', '7:30pm', '8:30pm', 'Large Dojo')
ON CONFLICT (class_name) DO UPDATE SET
  days = EXCLUDED.days,
  time_start = EXCLUDED.time_start,
  time_end = EXCLUDED.time_end,
  location = EXCLUDED.location;

-- Allow all authenticated users (parents included) to read the master class catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='class_schedules'
      AND policyname='Anyone authenticated can view class schedules'
  ) THEN
    CREATE POLICY "Anyone authenticated can view class schedules"
      ON public.class_schedules FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- At-risk consecutive absence tracking on students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS consecutive_absences integer NOT NULL DEFAULT 0;
