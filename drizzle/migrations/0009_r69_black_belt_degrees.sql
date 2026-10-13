ALTER TABLE public.belt_ranks ADD COLUMN degree smallint;
ALTER TABLE public.belt_ranks ADD CONSTRAINT belt_ranks_degree_range CHECK (degree BETWEEN 1 AND 6);
ALTER TABLE public.students ADD COLUMN personal_test_date date;
COMMENT ON COLUMN public.belt_ranks.degree IS 'Explicit black belt degree, 1 through 6; NULL for existing ranks including recommended Black. Never infer from names.';
COMMENT ON COLUMN public.students.personal_test_date IS 'Individual Black/degree test date. Colour belts continue using class_schedules.next_test_date.';

-- Additive rank backfill derived from the existing Solid Black system; existing ranks and students are untouched.
INSERT INTO public.belt_ranks (system_id, name, short_name, pattern, color_primary, color_accent, curriculum_tier, sort_order, active, degree)
SELECT black.system_id, degrees.name, degrees.short_name, 'solid', '#000000', '#F5C518', 'advanced', degrees.sort_order, true, degrees.degree
FROM public.belt_ranks black
JOIN public.belt_systems system ON system.id = black.system_id AND system.slug = 'solid'
CROSS JOIN (VALUES
  ('1st Degree Black Belt', '1st Degree', 9, 1::smallint),
  ('2nd Degree Black Belt', '2nd Degree', 10, 2::smallint),
  ('3rd Degree Black Belt', '3rd Degree', 11, 3::smallint),
  ('4th Degree Black Belt', '4th Degree', 12, 4::smallint),
  ('5th Degree Black Belt', '5th Degree', 13, 5::smallint),
  ('6th Degree Black Belt', '6th Degree', 14, 6::smallint)
) AS degrees(name, short_name, sort_order, degree)
WHERE black.name = 'Black' AND black.degree IS NULL;