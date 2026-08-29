ALTER TABLE public.announcements ADD COLUMN publish_at timestamptz;
ALTER TABLE public.events ADD COLUMN publish_at timestamptz;

-- Scheduling is a security boundary, not a UI nicety: the old SELECT policy was
-- USING (true), so a hidden-in-the-frontend post was still readable over REST.
-- Drop and recreate — a second permissive policy would OR with the old one and
-- defeat it entirely. Declarative gate, re-evaluated on every query, no cron.
DROP POLICY "Anyone signed in views announcements" ON public.announcements;
CREATE POLICY "Signed in view published announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    (publish_at IS NULL OR publish_at <= now())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY "Signed in view published events" ON public.events;
CREATE POLICY "Signed in view published events"
  ON public.events FOR SELECT TO authenticated
  USING (
    (published = true AND (publish_at IS NULL OR publish_at <= now()))
    OR public.has_role(auth.uid(), 'admin')
  );

-- SECURITY INVOKER (unchanged): the new policy above gates rows, so there is
-- deliberately no publish_at filter inside the body. The only edit versus the
-- Round 34 version is a.created_at -> COALESCE(a.publish_at, a.created_at) in
-- the ORDER BY: a post written today for next Friday must sort by when parents
-- see it, not by when staff typed it.
CREATE OR REPLACE FUNCTION public.get_school_news(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  body text,
  tag text,
  discipline text,
  disciplines text[],
  location text,
  event_date date,
  event_end_date date,
  venue text,
  address text,
  divisions text,
  registration_deadline date,
  spectator_info text,
  event_url text,
  pinned boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.category, a.title, a.body, a.tag, a.discipline, a.disciplines,
         a.location, a.event_date, a.event_end_date, a.venue, a.address,
         a.divisions, a.registration_deadline, a.spectator_info, a.event_url,
         a.pinned, a.created_at
  FROM public.announcements a
  WHERE a.category = 'school_news'
  ORDER BY
    a.pinned DESC,
    CASE WHEN a.pinned THEN 0
         WHEN a.event_date >= CURRENT_DATE THEN 1
         ELSE 2 END,
    CASE WHEN a.pinned OR a.event_date >= CURRENT_DATE THEN a.event_date END ASC NULLS LAST,
    COALESCE(a.publish_at, a.created_at) DESC,
    a.id DESC
  LIMIT GREATEST(COALESCE(_limit, 20), 0)
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.get_school_news(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_school_news(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_school_news(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_news(integer, integer) TO service_role;