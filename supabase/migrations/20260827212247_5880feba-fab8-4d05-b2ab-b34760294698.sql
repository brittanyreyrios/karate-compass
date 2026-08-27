-- The schema default granted EXECUTE to PUBLIC (shown as "=X" in proacl), which
-- includes anon. Naming anon alone does not remove a PUBLIC grant, so revoke
-- both, then re-grant only the two roles that should hold it.
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revert_point_event(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.change_attendance(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_point_event(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_attendance(uuid, integer) TO authenticated, service_role;