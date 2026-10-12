CREATE TABLE public.email_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  old_email text NOT NULL,
  new_email text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_change_events TO authenticated;
GRANT ALL ON public.email_change_events TO service_role;
ALTER TABLE public.email_change_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read email change history" ON public.email_change_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX email_change_events_target_idx ON public.email_change_events (target_user_id, changed_at DESC);