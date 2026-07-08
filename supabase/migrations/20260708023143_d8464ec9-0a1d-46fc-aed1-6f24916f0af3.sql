
CREATE TABLE public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_name text unique not null,
  next_test_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedules TO authenticated;
GRANT ALL ON public.class_schedules TO service_role;

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in views schedules"
  ON public.class_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert schedules"
  ON public.class_schedules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update schedules"
  ON public.class_schedules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete schedules"
  ON public.class_schedules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER class_schedules_set_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.class_schedules (class_name)
VALUES ('Little Tigers'), ('Juniors'), ('Teens/Adults')
ON CONFLICT (class_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  current_belt text,
  class_name text,
  points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, first_name, last_name, current_belt, class_name, points
  FROM public.students
  WHERE active = true
  ORDER BY points DESC, first_name ASC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
