ALTER TABLE public.profiles ADD COLUMN archived_at timestamptz;

COMMENT ON COLUMN public.profiles.archived_at IS 'Admin-set archive marker. Display state only: archived accounts drop out of the default Admin Console account list and can be restored. Does NOT gate sign-in, RLS or grants. Deletion is only offered on an already-archived account.';