CREATE OR REPLACE FUNCTION public.next_curriculum_sort_order(_belt_rank_id uuid, _curriculum_tier text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_next integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  -- FOR UPDATE is illegal alongside MAX(), and locking a subquery locks nothing
  -- when the group is empty — the exact case where two admins collide. A
  -- transaction-scoped advisory lock keyed on the group serialises regardless.
  PERFORM pg_advisory_xact_lock(
    hashtext('curriculum_sort:' || COALESCE(_belt_rank_id::text, 'tier:' || COALESCE(_curriculum_tier, '')))
  );

  IF _belt_rank_id IS NOT NULL THEN
    SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_next
    FROM public.curriculum_items
    WHERE belt_rank_id = _belt_rank_id;
  ELSE
    SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_next
    FROM public.curriculum_items
    WHERE belt_rank_id IS NULL AND curriculum_tier = _curriculum_tier;
  END IF;

  RETURN COALESCE(v_next, 0);
END;
$function$;