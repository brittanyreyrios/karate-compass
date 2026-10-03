-- Round 58 privacy fix: a parent reading even their own link row learns is_primary=false,
-- which reveals that another guardian exists. Parents never need this table directly
-- (access goes through SECURITY DEFINER is_guardian_of), so they get no SELECT at all.
DROP POLICY "Parents read own guardian links" ON public.student_guardians;