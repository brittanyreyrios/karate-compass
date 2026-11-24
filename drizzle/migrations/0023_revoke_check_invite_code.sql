-- Invite validation remains in the SECURITY DEFINER handle_new_user trigger.
REVOKE EXECUTE ON FUNCTION public.check_invite_code(text) FROM anon, authenticated, PUBLIC;