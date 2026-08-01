ALTER TABLE public.students
  ALTER COLUMN class_name SET DEFAULT 'Unassigned';

ALTER TABLE public.announcements
  ADD COLUMN event_end_date date,
  ADD COLUMN venue text,
  ADD COLUMN address text,
  ADD COLUMN divisions text,
  ADD COLUMN registration_deadline date,
  ADD COLUMN spectator_info text,
  ADD COLUMN event_url text;