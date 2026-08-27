-- Round 25: counter + audit-row writes become one transaction each.
-- A definer function bypasses RLS, so the has_role() check at the top of each
-- one IS the security boundary — same pattern as public.admin_reassign_student.

CREATE OR REPLACE FUNCTION public.award_points(
  _student_id uuid,
  _delta integer,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current integer;
  v_new integer;
  v_applied integer;
  v_event uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  -- FOR UPDATE: two concurrent awards for the same student serialise here
  -- instead of both reading the same stale total and one losing its delta.
  SELECT s.points INTO v_current
  FROM public.students s
  WHERE s.id = _student_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- Identical math to the client helper this replaces.
  v_new := GREATEST(0, v_current + _delta);
  v_applied := v_new - v_current;

  IF v_applied = 0 THEN
    RETURN jsonb_build_object(
      'student_id', _student_id,
      'delta', 0,
      'new_total', v_new,
      'event_id', NULL
    );
  END IF;

  UPDATE public.students SET points = v_new WHERE id = _student_id;

  INSERT INTO public.point_events (student_id, delta, reason, awarded_by)
  VALUES (_student_id, v_applied, _reason, auth.uid())
  RETURNING id INTO v_event;

  RETURN jsonb_build_object(
    'student_id', _student_id,
    'delta', v_applied,
    'new_total', v_new,
    'event_id', v_event
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.revert_point_event(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_student uuid;
  v_delta integer;
  v_current integer;
  v_new integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  -- The amount comes from the row being reverted, never from the caller: a
  -- stale client number would silently corrupt the counter.
  SELECT pe.student_id, pe.delta INTO v_student, v_delta
  FROM public.point_events pe
  WHERE pe.id = _event_id
  FOR UPDATE;

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Point event not found';
  END IF;

  SELECT s.points INTO v_current
  FROM public.students s
  WHERE s.id = v_student
  FOR UPDATE;

  v_new := GREATEST(0, COALESCE(v_current, 0) - v_delta);

  UPDATE public.students SET points = v_new WHERE id = v_student;
  DELETE FROM public.point_events WHERE id = _event_id;

  RETURN jsonb_build_object(
    'student_id', v_student,
    'delta', v_delta,
    'new_total', v_new,
    'event_id', _event_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.change_attendance(
  _student_id uuid,
  _delta integer
)
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
    -- we never invent a past date, so every new row is dated today.
    INSERT INTO public.attendance_events (student_id, occurred_on, created_by)
    SELECT _student_id, CURRENT_DATE, auth.uid()
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

GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_point_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_attendance(uuid, integer) TO authenticated, service_role;

-- A schema-level default privilege grants anon EXECUTE on every new function,
-- so REVOKE ... FROM PUBLIC is not enough — anon must be named explicitly.
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revert_point_event(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.change_attendance(uuid, integer) FROM anon;