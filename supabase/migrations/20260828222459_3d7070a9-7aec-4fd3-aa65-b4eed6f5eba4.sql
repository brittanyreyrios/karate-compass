ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- SECURITY INVOKER (the default): the existing announcements policies keep
-- deciding who reads what, so no policy changes here. STABLE + read-only.
--
-- Ordering must happen here, not in the browser: the feed is paginated and
-- sorting a fetched page client-side silently omits every row outside it.
--
-- Groups: pinned, then upcoming (event_date >= CURRENT_DATE) soonest first,
-- then everything else (past event dates AND null event dates) newest-posted
-- first. Past events are their OWN group on purpose — a single event_date ASC
-- would park the oldest past event at the top forever.
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
    a.created_at DESC,
    a.id DESC
  LIMIT GREATEST(COALESCE(_limit, 20), 0)
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.get_school_news(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_school_news(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_school_news(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_news(integer, integer) TO service_role;