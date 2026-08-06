-- These run with elevated rights, so only signed-in callers may execute them.
REVOKE EXECUTE ON FUNCTION public.division_of(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_division() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.class_student_counts() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.division_of(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_division() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.class_student_counts() TO authenticated, service_role;
