DELETE FROM public.point_events WHERE student_id IN (SELECT id FROM public.students WHERE first_name LIKE 'ZZ%' AND last_name = 'Test');
DELETE FROM public.student_classes WHERE student_id IN (SELECT id FROM public.students WHERE first_name LIKE 'ZZ%' AND last_name = 'Test');
DELETE FROM public.students WHERE first_name LIKE 'ZZ%' AND last_name = 'Test';
DELETE FROM public.curriculum_items WHERE technique LIKE 'ZZ %' AND category = 'Test';