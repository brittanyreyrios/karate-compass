-- 1. Allow admins (and only admins) to write roles
GRANT INSERT, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "Admins can grant roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can revoke roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Audit log (same shape as photo_consent_events: admin-read, no client writes)
CREATE TABLE public.role_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  action text NOT NULL CHECK (action IN ('granted', 'revoked')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_change_events TO authenticated;
GRANT ALL ON public.role_change_events TO service_role;

ALTER TABLE public.role_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read role change history"
  ON public.role_change_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX role_change_events_changed_at_idx
  ON public.role_change_events (changed_at DESC);

-- 3. Lockout guard. Runs for SQL-editor deletes too, which is deliberate:
--    an accidental `DELETE FROM user_roles` must not be able to orphan the app.
CREATE OR REPLACE FUNCTION public.guard_admin_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role <> 'admin' THEN
    RETURN OLD;
  END IF;

  -- auth.uid() is NULL in the SQL editor / service contexts; only guard the
  -- self-removal case when we actually know who is acting.
  IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own admin access';
  END IF;

  IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'At least one admin must remain';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER guard_admin_role_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_delete();

-- 4. Audit trigger. changed_by is left NULL rather than invented when there is
--    no session (SQL editor / service role).
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_change_events (target_user_id, role, action, changed_by)
    VALUES (NEW.user_id, NEW.role, 'granted', auth.uid());
    RETURN NEW;
  END IF;
  INSERT INTO public.role_change_events (target_user_id, role, action, changed_by)
  VALUES (OLD.user_id, OLD.role, 'revoked', auth.uid());
  RETURN OLD;
END;
$$;

CREATE TRIGGER log_role_change
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

-- 5. Section O — the school calls it the Big Dojo.
UPDATE public.class_schedules SET location = 'Big Dojo' WHERE location = 'Large Dojo';
