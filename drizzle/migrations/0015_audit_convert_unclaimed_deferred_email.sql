CREATE TABLE public.unclaimed_student_parent_links (
 student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
 parent_email text NOT NULL,
 source_class_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unclaimed_student_parent_links TO authenticated;
GRANT ALL ON public.unclaimed_student_parent_links TO service_role;
ALTER TABLE public.unclaimed_student_parent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage unclaimed parent references" ON public.unclaimed_student_parent_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX unclaimed_student_parent_links_email_idx ON public.unclaimed_student_parent_links (lower(btrim(parent_email)));
COMMENT ON TABLE public.unclaimed_student_parent_links IS 'Admin-only import email references; assigned only by confirmed-sign-in processing, never at account creation.';
CREATE FUNCTION public.clear_assigned_student_parent_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
 IF NEW.parent_id IS NOT NULL THEN DELETE FROM public.unclaimed_student_parent_links WHERE student_id = NEW.id; END IF;
 RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public.clear_assigned_student_parent_link() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER students_clear_assigned_parent_link AFTER UPDATE OF parent_id ON public.students FOR EACH ROW EXECUTE FUNCTION public.clear_assigned_student_parent_link();
CREATE FUNCTION public.convert_pending_student_imports(_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_id uuid; r public.pending_student_imports; v_class uuid; v_matches integer; v_student uuid; v_duplicate uuid; v_results jsonb := '[]'::jsonb; v_email text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF _ids IS NULL OR cardinality(_ids) = 0 OR cardinality(_ids) > 1000 THEN RAISE EXCEPTION 'Choose between 1 and 1000 import rows'; END IF;
 PERFORM pg_advisory_xact_lock(71372, 1);
 FOR v_id IN SELECT DISTINCT x FROM unnest(_ids) AS x ORDER BY x LOOP
  BEGIN
   SELECT * INTO r FROM public.pending_student_imports WHERE id = v_id FOR UPDATE;
   IF NOT FOUND THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object('import_id', v_id, 'status', 'skipped', 'reason', 'Import no longer waiting'));
    CONTINUE;
   END IF;
   v_email := lower(btrim(r.parent_email));
   PERFORM pg_advisory_xact_lock(71373, hashtext(v_email));
   IF btrim(r.first_name) = '' OR btrim(r.last_name) = '' OR v_email = '' THEN RAISE EXCEPTION 'Missing required import value'; END IF;
   SELECT count(*)::integer INTO v_matches FROM public.class_schedules WHERE lower(btrim(class_name)) = lower(btrim(r.class_name));
   v_class := NULL;
   IF v_matches = 1 THEN SELECT id INTO v_class FROM public.class_schedules WHERE lower(btrim(class_name)) = lower(btrim(r.class_name)); END IF;
   SELECT s.id INTO v_duplicate FROM public.students s
   WHERE lower(btrim(s.first_name)) = lower(btrim(r.first_name)) AND lower(btrim(s.last_name)) = lower(btrim(r.last_name))
   AND (
    (v_class IS NOT NULL AND EXISTS (SELECT 1 FROM public.student_classes sc WHERE sc.student_id = s.id AND sc.class_id = v_class))
    OR lower(btrim(s.class_name)) = lower(btrim(r.class_name))
    OR EXISTS (SELECT 1 FROM public.unclaimed_student_parent_links l WHERE l.student_id = s.id AND lower(btrim(l.source_class_name)) = lower(btrim(r.class_name)))
   ) ORDER BY s.id LIMIT 1;
   IF v_duplicate IS NOT NULL THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object('import_id',r.id,'first_name',r.first_name,'last_name',r.last_name,'status','duplicate','reason','Likely duplicate — same name and class','student_id',v_duplicate));
    CONTINUE;
   END IF;
   INSERT INTO public.students (parent_id,created_by_staff,first_name,last_name,belt_rank_id,current_belt,start_date,class_name)
   VALUES (NULL,true,r.first_name,r.last_name,r.belt_rank_id,r.current_belt,COALESCE(r.start_date,CURRENT_DATE),'Unassigned') RETURNING id INTO v_student;
   IF v_class IS NOT NULL THEN INSERT INTO public.student_classes(student_id,class_id,is_primary) VALUES(v_student,v_class,true); END IF;
   INSERT INTO public.unclaimed_student_parent_links(student_id,parent_email,source_class_name) VALUES(v_student,v_email,r.class_name);
   DELETE FROM public.pending_student_imports WHERE id = r.id;
   v_results := v_results || jsonb_build_array(jsonb_build_object('import_id',r.id,'first_name',r.first_name,'last_name',r.last_name,'status','converted','student_id',v_student,'in_no_class',v_class IS NULL,'source_class_name',r.class_name,'reason',CASE WHEN v_matches > 1 THEN 'Multiple class matches — In no class' WHEN v_matches = 0 THEN 'No class match — In no class' ELSE NULL END));
  EXCEPTION WHEN OTHERS THEN
   v_results := v_results || jsonb_build_array(jsonb_build_object('import_id',v_id,'first_name',r.first_name,'last_name',r.last_name,'status','failed','reason','Conversion failed — import kept; review its details and retry'));
  END;
 END LOOP;
 RETURN v_results;
END;
$fn$;
REVOKE ALL ON FUNCTION public.convert_pending_student_imports(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_pending_student_imports(uuid[]) TO authenticated;
CREATE FUNCTION public.finish_confirmed_student_email_links() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_user uuid := auth.uid(); v_email text; v_confirmed timestamptz; v_student uuid; v_count integer := 0;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT lower(btrim(u.email)),u.email_confirmed_at INTO v_email,v_confirmed FROM auth.users u WHERE u.id = v_user;
 IF v_email IS NULL OR v_confirmed IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user AND archived_at IS NULL) THEN
  RETURN jsonb_build_object('attempted',false,'success',false);
 END IF;
 PERFORM pg_advisory_xact_lock(71373,hashtext(v_email));
 FOR v_student IN SELECT s.id FROM public.students s JOIN public.unclaimed_student_parent_links l ON l.student_id = s.id
  WHERE lower(btrim(l.parent_email)) = v_email AND s.parent_id IS NULL ORDER BY s.id FOR UPDATE OF s LOOP
  UPDATE public.students SET parent_id = v_user,claimed_at = now() WHERE id = v_student AND parent_id IS NULL;
  IF FOUND THEN v_count := v_count + 1; END IF;
 END LOOP;
 RETURN jsonb_build_object('attempted',v_count > 0,'success',true,'linked_count',v_count);
END;
$fn$;
REVOKE ALL ON FUNCTION public.finish_confirmed_student_email_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_confirmed_student_email_links() TO authenticated;