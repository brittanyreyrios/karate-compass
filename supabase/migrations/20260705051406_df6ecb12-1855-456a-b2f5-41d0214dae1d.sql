ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_name text NOT NULL DEFAULT 'Little Tigers',
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;