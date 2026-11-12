REVOKE EXECUTE ON FUNCTION public.division_of(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.divisions_of(uuid)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.division_of(uuid)   TO service_role;
GRANT  EXECUTE ON FUNCTION public.divisions_of(uuid)  TO service_role;