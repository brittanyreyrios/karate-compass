CREATE TABLE public.pending_student_claims (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 code text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.pending_student_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pending_student_claims TO service_role;
ALTER TABLE public.pending_student_claims ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.pending_student_claims IS 'Private signup claim intent; only verified authenticated processing reads/consumes it.';
CREATE FUNCTION public.finish_pending_student_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_user uuid := auth.uid(); v_code text; v_result jsonb;
BEGIN
 IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM pg_advisory_xact_lock(71371, hashtext(v_user::text));
 SELECT code INTO v_code FROM public.pending_student_claims WHERE profile_id = v_user FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('attempted', false); END IF;
 BEGIN v_result := public.claim_student(v_code);
 EXCEPTION WHEN OTHERS THEN v_result := jsonb_build_object('success', false); END;
 DELETE FROM public.pending_student_claims WHERE profile_id = v_user;
 RETURN jsonb_build_object('attempted', true, 'success', COALESCE((v_result->>'success')::boolean, false), 'student_id', v_result->>'student_id');
END;
$fn$;
REVOKE ALL ON FUNCTION public.finish_pending_student_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_pending_student_claim() TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_claim text; v_code text; v_matched text; v_photo boolean; v_release text; v_belt text; v_rank uuid; v_class uuid; v_student uuid; r record;
BEGIN
 v_code := btrim(COALESCE(NEW.raw_user_meta_data->>'invite_code', ''));
 v_claim := upper(btrim(COALESCE(NEW.raw_user_meta_data->>'claim_code', '')));
 IF v_claim <> '' AND EXISTS (SELECT 1 FROM public.students WHERE claim_code = v_claim AND parent_id IS NULL) THEN
  NULL;
 ELSE
  SELECT code INTO v_matched FROM public.invite_codes
  WHERE upper(code) = upper(v_code) AND active = true AND (expires_at IS NULL OR expires_at > now()) AND used_count < max_uses FOR UPDATE;
  IF v_matched IS NULL THEN RAISE EXCEPTION 'Unable to create account'; END IF;
  UPDATE public.invite_codes SET used_count = used_count + 1 WHERE code = v_matched;
 END IF;
 v_photo := COALESCE((NEW.raw_user_meta_data->>'photo_consent')::boolean, false);
 v_release := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'media_release_version', '')), '');
 INSERT INTO public.profiles (id,email,family_name,photo_consent,photo_consent_updated_at,media_release_version,media_release_accepted_at)
 VALUES (NEW.id,NEW.email,COALESCE(NEW.raw_user_meta_data->>'family_name',split_part(NEW.email,'@',1)),v_photo,CASE WHEN v_photo THEN now() ELSE NULL END,v_release,CASE WHEN v_release IS NOT NULL THEN now() ELSE NULL END);
 INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'parent');
 IF v_claim <> '' THEN INSERT INTO public.pending_student_claims(profile_id,code) VALUES(NEW.id,v_claim); END IF;
 BEGIN
  FOR r IN SELECT * FROM public.pending_student_imports WHERE lower(btrim(parent_email))=lower(btrim(NEW.email)) LOOP
   v_student:=NULL;
   IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.parent_id=NEW.id AND lower(btrim(s.first_name))=lower(btrim(r.first_name)) AND lower(btrim(s.last_name))=lower(btrim(r.last_name))) THEN
    v_belt:=COALESCE(NULLIF(btrim(r.current_belt),''),'White');
    v_rank:=COALESCE(r.belt_rank_id,public.resolve_belt_rank_id(v_belt));
    v_class:=r.class_id;
    IF v_class IS NULL THEN SELECT cs.id INTO v_class FROM public.class_schedules cs WHERE lower(btrim(cs.class_name))=lower(btrim(COALESCE(r.class_name,''))) LIMIT 1; END IF;
    INSERT INTO public.students(parent_id,first_name,last_name,current_belt,belt_rank_id,class_name,start_date)
    VALUES(NEW.id,r.first_name,r.last_name,v_belt,v_rank,COALESCE(NULLIF(btrim(r.class_name),''),'Unassigned'),COALESCE(r.start_date,CURRENT_DATE)) RETURNING id INTO v_student;
    IF v_student IS NOT NULL AND v_class IS NOT NULL THEN INSERT INTO public.student_classes(student_id,class_id,is_primary) VALUES(v_student,v_class,true) ON CONFLICT(student_id,class_id) DO NOTHING; END IF;
   END IF;
   DELETE FROM public.pending_student_imports WHERE id=r.id;
  END LOOP;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'auto-link of pending students failed for %: %',NEW.email,SQLERRM; END;
 BEGIN
  FOR r IN SELECT * FROM public.pending_guardian_links WHERE email=lower(btrim(NEW.email)) LOOP
   INSERT INTO public.student_guardians(student_id,profile_id,is_primary) VALUES(r.student_id,NEW.id,false) ON CONFLICT(student_id,profile_id) DO NOTHING;
   DELETE FROM public.pending_guardian_links WHERE id=r.id;
  END LOOP;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pending guardian link failed for %: %',NEW.email,SQLERRM; END;
 RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_leaderboard(_division text, _period text DEFAULT 'month'::text)
RETURNS TABLE(id uuid,first_name text,last_initial text,rank_name text,rank_short_name text,pattern text,color_primary text,color_accent text,class_name text,period_points integer,uses_belts boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
 WITH bounds AS (SELECT CASE WHEN _period='all_time' THEN '-infinity'::date ELSE public.points_period_start() END AS since)
 SELECT st.id,st.first_name,CASE WHEN st.last_name IS NULL OR btrim(st.last_name)='' THEN '' ELSE upper(left(btrim(st.last_name),1))||'.' END,
 r.name,COALESCE(r.short_name,r.name),r.pattern,r.color_primary,r.color_accent,st.class_name,COALESCE(pts.total,0)::integer,COALESCE(sy.uses_belts,false)
 FROM public.students st LEFT JOIN public.belt_ranks r ON r.id=st.belt_rank_id LEFT JOIN public.belt_systems sy ON sy.id=r.system_id
 LEFT JOIN (SELECT pe.student_id,SUM(pe.delta) AS total FROM public.point_events pe,bounds b WHERE pe.occurred_on>=b.since GROUP BY pe.student_id) pts ON pts.student_id=st.id
 WHERE st.active=true AND st.parent_id IS NOT NULL AND _division=ANY(public.divisions_of(st.id)) AND COALESCE(pts.total,0)>0
 ORDER BY COALESCE(pts.total,0) DESC,st.first_name ASC LIMIT 10;
$fn$;
CREATE OR REPLACE FUNCTION public.get_my_division()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
 SELECT public.division_of(s.id) FROM public.students s WHERE public.is_guardian_of(s.id) AND s.parent_id IS NOT NULL AND s.active=true AND public.division_of(s.id) IS NOT NULL ORDER BY s.created_at LIMIT 1;
$fn$;
CREATE OR REPLACE FUNCTION public.get_winners_circle(_limit integer DEFAULT 60)
RETURNS TABLE(id uuid,first_name text,last_initial text,event_name text,placement smallint,tournament_name text,tournament_date date,disciplines text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
 SELECT tr.id,st.first_name,CASE WHEN st.last_name IS NULL OR btrim(st.last_name)='' THEN '' ELSE upper(left(btrim(st.last_name),1))||'.' END,tr.event_name,tr.placement,tr.tournament_name,tr.tournament_date,tr.disciplines
 FROM public.tournament_results tr JOIN public.students st ON st.id=tr.student_id WHERE tr.featured=true AND st.active=true AND st.parent_id IS NOT NULL
 ORDER BY tr.tournament_date DESC,tr.tournament_name ASC,tr.placement ASC NULLS LAST,tr.event_name ASC LIMIT COALESCE(_limit,60);
$fn$;
CREATE OR REPLACE FUNCTION public.get_poll_results(_poll_id uuid)
RETURNS TABLE(option_id uuid,label text,vote_count integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_poll public.polls; v_is_admin boolean; v_has_voted boolean; v_closed boolean;
BEGIN
 SELECT * INTO v_poll FROM public.polls WHERE id=_poll_id;
 IF v_poll.id IS NULL OR (v_poll.published=false AND NOT public.has_role(auth.uid(),'admin')) THEN RETURN; END IF;
 v_is_admin:=public.has_role(auth.uid(),'admin');
 v_closed:=v_poll.closes_at IS NOT NULL AND v_poll.closes_at<=now();
 v_has_voted:=EXISTS(SELECT 1 FROM public.poll_votes v WHERE v.poll_id=_poll_id AND v.profile_id=auth.uid());
 IF NOT (v_is_admin OR v_poll.results_visible='always' OR (v_poll.results_visible='after_vote' AND v_has_voted) OR (v_poll.results_visible='after_close' AND v_closed)) THEN RETURN; END IF;
 RETURN QUERY SELECT o.id,o.label,(CASE WHEN v_poll.respond_per='student' THEN COUNT(DISTINCT v.student_id) ELSE COUNT(v.id) END)::integer
 FROM public.poll_options o LEFT JOIN public.poll_votes v ON v.option_id=o.id AND (v_is_admin OR v.student_id IS NULL OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=v.student_id AND s.parent_id IS NOT NULL))
 WHERE o.poll_id=_poll_id GROUP BY o.id,o.label,o.sort_order ORDER BY o.sort_order,o.label;
END;
$fn$;