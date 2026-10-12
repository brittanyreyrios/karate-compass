CREATE TABLE public.absence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  occurred_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Chicago'))::date,
  class_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.absence_events.class_name IS 'Snapshot of students.class_name (primary class) at the moment of marking; display only.';
CREATE INDEX absence_events_student_date_idx ON public.absence_events (student_id, occurred_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absence_events TO authenticated;
GRANT ALL ON public.absence_events TO service_role;
ALTER TABLE public.absence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage absence events" ON public.absence_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.attendance_events ALTER COLUMN occurred_on SET DEFAULT ((now() AT TIME ZONE 'America/Chicago'))::date;

CREATE OR REPLACE FUNCTION public.change_attendance(_student_id uuid, _delta integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current integer;
  v_new integer;
  v_wanted integer;
  v_applied integer;
  v_ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT s.attendance_count INTO v_current
  FROM public.students s
  WHERE s.id = _student_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF _delta = 0 THEN
    RETURN jsonb_build_object(
      'student_id', _student_id,
      'delta', 0,
      'requested', 0,
      'new_total', v_current
    );
  END IF;

  IF _delta > 0 THEN
    v_new := v_current + _delta;
    UPDATE public.students SET attendance_count = v_new WHERE id = _student_id;

    -- attendance_events has no delta column — the count IS the row count — and
    -- we never invent a past date, so every new row is dated today (gym time).
    INSERT INTO public.attendance_events (student_id, occurred_on, created_by)
    SELECT _student_id, (now() AT TIME ZONE 'America/Chicago')::date, auth.uid()
    FROM generate_series(1, _delta);

    RETURN jsonb_build_object(
      'student_id', _student_id,
      'delta', _delta,
      'requested', _delta,
      'new_total', v_new
    );
  END IF;

  -- Decrease: remove the newest rows rather than writing a fictional negative
  -- one, so the log stays truthful. Fewer rows than asked for is a legitimate
  -- partial result the caller reports to the admin.
  v_wanted := LEAST(-_delta, v_current);
  IF v_wanted <= 0 THEN
    RETURN jsonb_build_object(
      'student_id', _student_id,
      'delta', 0,
      'requested', _delta,
      'new_total', v_current
    );
  END IF;

  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[]) INTO v_ids
  FROM (
    SELECT ae.id
    FROM public.attendance_events ae
    WHERE ae.student_id = _student_id
    ORDER BY ae.occurred_on DESC, ae.created_at DESC
    LIMIT v_wanted
  ) t;

  v_applied := COALESCE(array_length(v_ids, 1), 0);
  IF v_applied = 0 THEN
    RETURN jsonb_build_object(
      'student_id', _student_id,
      'delta', 0,
      'requested', _delta,
      'new_total', v_current
    );
  END IF;

  v_new := GREATEST(0, v_current - v_applied);
  UPDATE public.students SET attendance_count = v_new WHERE id = _student_id;
  DELETE FROM public.attendance_events WHERE id = ANY (v_ids);

  RETURN jsonb_build_object(
    'student_id', _student_id,
    'delta', -v_applied,
    'requested', _delta,
    'new_total', v_new
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_absent(_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_streak integer;
  v_class text;
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT s.consecutive_absences, s.class_name INTO v_streak, v_class
  FROM public.students s
  WHERE s.id = _student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  INSERT INTO public.absence_events (student_id, occurred_on, class_name, created_by)
  VALUES (_student_id, (now() AT TIME ZONE 'America/Chicago')::date, v_class, auth.uid())
  RETURNING id INTO v_id;

  v_streak := COALESCE(v_streak, 0) + 1;
  UPDATE public.students SET consecutive_absences = v_streak WHERE id = _student_id;

  RETURN jsonb_build_object('student_id', _student_id, 'absence_id', v_id, 'streak', v_streak);
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_absence(_absence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student uuid;
  v_created timestamptz;
  v_streak integer;
  v_last_checkin timestamptz;
  v_in_streak boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT a.student_id INTO v_student FROM public.absence_events a WHERE a.id = _absence_id;
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Absence not found';
  END IF;

  SELECT s.consecutive_absences INTO v_streak
  FROM public.students s WHERE s.id = v_student FOR UPDATE;

  -- Re-read under the student lock so a concurrent remove can't double-count.
  SELECT a.created_at INTO v_created FROM public.absence_events a WHERE a.id = _absence_id;
  IF v_created IS NULL THEN
    RAISE EXCEPTION 'Absence not found';
  END IF;

  -- Streak rule: only absences recorded after the latest check-in are part of
  -- the current streak, so only those decrement it (never below 0).
  SELECT max(ae.created_at) INTO v_last_checkin
  FROM public.attendance_events ae WHERE ae.student_id = v_student;
  v_in_streak := v_last_checkin IS NULL OR v_created > v_last_checkin;

  DELETE FROM public.absence_events WHERE id = _absence_id;

  IF v_in_streak THEN
    v_streak := GREATEST(0, COALESCE(v_streak, 0) - 1);
    UPDATE public.students SET consecutive_absences = v_streak WHERE id = v_student;
  END IF;

  RETURN jsonb_build_object('student_id', v_student, 'streak', v_streak, 'streak_changed', v_in_streak);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_student(_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  PERFORM 1 FROM public.students s WHERE s.id = _student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  v_result := public.change_attendance(_student_id, 1);
  -- Streak reset only; absence_events is never touched here.
  UPDATE public.students SET consecutive_absences = 0 WHERE id = _student_id;

  RETURN v_result || jsonb_build_object('streak', 0);
END;
$function$;

UPDATE public.attendance_events
SET occurred_on = (created_at AT TIME ZONE 'America/Chicago')::date
WHERE created_at IS NOT NULL
  AND occurred_on <> (created_at AT TIME ZONE 'America/Chicago')::date;

REVOKE EXECUTE ON FUNCTION public.change_attendance(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_absent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_absence(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_in_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_attendance(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_absent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_absence(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_in_student(uuid) TO authenticated, service_role;

SELECT proname, proacl::text FROM pg_proc
WHERE proname IN ('change_attendance','mark_absent','remove_absence','check_in_student')
  AND pronamespace = 'public'::regnamespace;