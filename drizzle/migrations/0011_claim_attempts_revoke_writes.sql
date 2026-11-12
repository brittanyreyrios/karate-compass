REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.claim_attempts FROM anon, authenticated;
REVOKE ALL ON public.claim_attempts FROM anon;