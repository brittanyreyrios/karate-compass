-- Supersedes the placeholder seed data in migration 20260731044242 (tournament
-- announcements) and 20260708023143 (invented class_schedules rows). Those two
-- migrations are already applied and are intentionally left untouched; this
-- migration makes their seed data harmless on a fresh database by running after
-- them and replacing the values. Safe to re-run.

-- 1. Remove invented class rows, but only if nothing real references them.
DELETE FROM public.class_schedules cs
WHERE cs.class_name IN ('Little Tigers', 'Juniors', 'Teens/Adults')
  AND NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.class_name = cs.class_name
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.class_holidays h WHERE h.class_name = cs.class_name
  );

-- 2. Remove placeholder tournament announcements (blank venue / wrong titles).
DELETE FROM public.announcements
WHERE category = 'tournament'
  AND (
    title IN ('Jiu Jitsu World League', 'IBJJF Open')
    OR (title = 'ISKF Open' AND venue IS NULL AND event_date IS DISTINCT FROM DATE '2027-01-23')
  );

-- 3. Insert the three verified events, guarded so re-runs are no-ops.
INSERT INTO public.announcements (
  category, title, body, discipline, event_date, event_end_date,
  venue, address, divisions, registration_deadline, spectator_info, event_url
)
SELECT v.category, v.title, v.body, v.discipline, v.event_date, v.event_end_date,
       v.venue, v.address, v.divisions, v.registration_deadline, v.spectator_info, v.event_url
FROM (
  VALUES
    (
      'tournament', 'Jiu Jitsu World League: Houston XIX',
      'Youth divisions available.', 'Jiu Jitsu',
      DATE '2026-08-22', NULL::date,
      'Fort Bend County Epicenter', '28505 Southwest Fwy, Rosenberg, TX 77471',
      'Gi and NoGi — Youth, Adults, and Masters', NULL::date, NULL::text,
      'https://www.jjworldleague.com/'
    ),
    (
      'tournament', 'IBJJF Houston Fall International Open 2026',
      'Age divisions for this event begin at Juvenile (birth years 2009–2010). Check with your instructor before registering a younger student.',
      'Jiu Jitsu',
      DATE '2026-10-10', DATE '2026-10-11',
      'NRG Center, Hall D', '1 NRG Pkwy, NRG Park, Houston, TX 77054',
      NULL::text, DATE '2026-10-02', 'Spectator entry: Free · Parking: $25',
      'https://ibjjf.com/events/houston-fall-international-open-ibjjf-jiu-jitsu-championship-2026'
    ),
    (
      'tournament', 'ISKF Open',
      'Details coming soon.', 'Karate',
      DATE '2027-01-23', NULL::date,
      NULL::text, NULL::text,
      NULL::text, NULL::date, NULL::text, NULL::text
    )
) AS v(category, title, body, discipline, event_date, event_end_date,
       venue, address, divisions, registration_deadline, spectator_info, event_url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.announcements a
  WHERE a.category = 'tournament' AND a.title = v.title
);

-- 4. Keep the verified detail fields authoritative if rows already existed.
UPDATE public.announcements SET
  body = 'Youth divisions available.',
  discipline = 'Jiu Jitsu',
  event_date = DATE '2026-08-22', event_end_date = NULL,
  venue = 'Fort Bend County Epicenter',
  address = '28505 Southwest Fwy, Rosenberg, TX 77471',
  divisions = 'Gi and NoGi — Youth, Adults, and Masters',
  registration_deadline = NULL, spectator_info = NULL,
  event_url = 'https://www.jjworldleague.com/'
WHERE category = 'tournament' AND title = 'Jiu Jitsu World League: Houston XIX';

UPDATE public.announcements SET
  body = 'Age divisions for this event begin at Juvenile (birth years 2009–2010). Check with your instructor before registering a younger student.',
  discipline = 'Jiu Jitsu',
  event_date = DATE '2026-10-10', event_end_date = DATE '2026-10-11',
  venue = 'NRG Center, Hall D',
  address = '1 NRG Pkwy, NRG Park, Houston, TX 77054',
  registration_deadline = DATE '2026-10-02',
  spectator_info = 'Spectator entry: Free · Parking: $25',
  event_url = 'https://ibjjf.com/events/houston-fall-international-open-ibjjf-jiu-jitsu-championship-2026'
WHERE category = 'tournament' AND title = 'IBJJF Houston Fall International Open 2026';

UPDATE public.announcements SET
  discipline = 'Karate',
  event_date = DATE '2027-01-23', event_end_date = NULL
WHERE category = 'tournament' AND title = 'ISKF Open';