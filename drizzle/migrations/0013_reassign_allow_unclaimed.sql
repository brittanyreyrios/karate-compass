CREATE OR REPLACE FUNCTION public.admin_reassign_student(_student_id uuid, _new_parent_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_parent uuid;
  v_family text;
  v_old_parent uuid;
  v_name text;
BEGIN
  -- A definer function bypasses RLS: this check IS the security boundary.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT s.parent_id, s.first_name || ' ' || s.last_name
    INTO v_old_parent, v_name
  FROM public.students s WHERE s.id = _student_id;

  -- Existence by row, not by family: unclaimed students have no parent.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  SELECT p.id, p.family_name INTO v_new_parent, v_family
  FROM public.profiles p
  WHERE lower(btrim(p.email)) = lower(btrim(_new_parent_email));

  IF v_new_parent IS NULL THEN
    RAISE EXCEPTION 'No account found for that email — ask them to sign up first';
  END IF;

  IF v_new_parent = v_old_parent THEN
    RAISE EXCEPTION 'That student is already on this account';
  END IF;

  UPDATE public.students SET parent_id = v_new_parent WHERE id = _student_id;

  RETURN jsonb_build_object(
    'student_id', _student_id,
    'student_name', v_name,
    'old_parent_id', v_old_parent,
    'new_parent_id', v_new_parent,
    'new_family_name', v_family
  );
END;
$function$;