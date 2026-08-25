ALTER TABLE public.events ADD COLUMN disciplines text[];
ALTER TABLE public.announcements ADD COLUMN disciplines text[];

UPDATE public.announcements
SET disciplines = ARRAY[
  CASE btrim(discipline)
    WHEN 'Jiu-Jitsu' THEN 'Jiu Jitsu'
    WHEN 'jiu-jitsu' THEN 'Jiu Jitsu'
    WHEN 'Jiu jitsu' THEN 'Jiu Jitsu'
    ELSE btrim(discipline)
  END
]
WHERE discipline IS NOT NULL AND btrim(discipline) <> '';