ALTER TABLE public.tournament_results
  ADD COLUMN featured boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_winners_circle(_limit integer DEFAULT 60)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_initial text,
  event_name text,
  placement smallint,
  tournament_name text,
  tournament_date date,
  disciplines text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    tr.id,
    st.first_name,
    CASE WHEN st.last_name IS NULL OR btrim(st.last_name) = '' THEN '' ELSE upper(left(btrim(st.last_name), 1)) || '.' END,
    tr.event_name,
    tr.placement,
    tr.tournament_name,
    tr.tournament_date,
    tr.disciplines
  FROM public.tournament_results tr
  JOIN public.students st ON st.id = tr.student_id
  WHERE tr.featured = true
    AND st.active = true
  ORDER BY tr.tournament_date DESC, tr.tournament_name ASC, tr.placement ASC NULLS LAST, tr.event_name ASC
  LIMIT COALESCE(_limit, 60)
$$;

REVOKE EXECUTE ON FUNCTION public.get_winners_circle(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_winners_circle(integer) TO authenticated, service_role;