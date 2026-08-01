CREATE OR REPLACE FUNCTION public.resolve_belt_rank_id(_belt text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF NULLIF(btrim(COALESCE(_belt, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  -- Collect EVERY active rank whose name or short_name matches, across all
  -- three systems. No system preference, no LIMIT 1: an ambiguous belt name is
  -- a state a human must resolve, so it must resolve to NULL rather than to a
  -- winner. A wrong-system student is invisible; an unranked one is countable.
  SELECT array_agg(r.id) INTO v_ids
  FROM public.belt_ranks r
  WHERE r.active = true
    AND (
      lower(btrim(r.name)) = lower(btrim(_belt))
      OR lower(btrim(COALESCE(r.short_name, ''))) = lower(btrim(_belt))
    );

  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RETURN NULL;
  END IF;

  RETURN v_ids[1];
END;
$function$;