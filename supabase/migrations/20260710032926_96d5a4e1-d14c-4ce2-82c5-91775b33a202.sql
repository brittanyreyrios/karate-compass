
-- 1. Premium status on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_subscription_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_subscription_status_check
      CHECK (subscription_status IN ('free', 'premium'));
  END IF;
END $$;

-- 2. Class holidays
CREATE TABLE IF NOT EXISTS public.class_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  holiday_date date NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_name, holiday_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_holidays TO authenticated;
GRANT ALL ON public.class_holidays TO service_role;
ALTER TABLE public.class_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view holidays" ON public.class_holidays;
CREATE POLICY "Authenticated can view holidays"
  ON public.class_holidays FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage holidays" ON public.class_holidays;
CREATE POLICY "Admins manage holidays"
  ON public.class_holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Pending (unlinked) student imports for audit
CREATE TABLE IF NOT EXISTS public.pending_student_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  parent_email text NOT NULL,
  start_date date,
  current_belt text NOT NULL DEFAULT 'White',
  class_name text NOT NULL,
  reason text NOT NULL DEFAULT 'no_matching_parent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_student_imports TO authenticated;
GRANT ALL ON public.pending_student_imports TO service_role;
ALTER TABLE public.pending_student_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pending imports" ON public.pending_student_imports;
CREATE POLICY "Admins manage pending imports"
  ON public.pending_student_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_pending_imports_updated ON public.pending_student_imports;
CREATE TRIGGER trg_pending_imports_updated
  BEFORE UPDATE ON public.pending_student_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
