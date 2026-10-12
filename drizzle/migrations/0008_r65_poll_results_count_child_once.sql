CREATE OR REPLACE FUNCTION public.get_poll_results(_poll_id uuid)
 RETURNS TABLE(option_id uuid, label text, vote_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_poll public.polls;
  v_is_admin boolean;
  v_has_voted boolean;
  v_closed boolean;
BEGIN
  SELECT * INTO v_poll FROM public.polls WHERE id = _poll_id;
  IF v_poll.id IS NULL OR (v_poll.published = false AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;
  v_is_admin := public.has_role(auth.uid(), 'admin');
  v_closed := v_poll.closes_at IS NOT NULL AND v_poll.closes_at <= now();
  v_has_voted := EXISTS (SELECT 1 FROM public.poll_votes v WHERE v.poll_id = _poll_id AND v.profile_id = auth.uid());

  IF NOT (
    v_is_admin
    OR (v_poll.results_visible = 'always')
    OR (v_poll.results_visible = 'after_vote' AND v_has_voted)
    OR (v_poll.results_visible = 'after_close' AND v_closed)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.id, o.label, (CASE WHEN v_poll.respond_per = 'student' THEN COUNT(DISTINCT v.student_id) ELSE COUNT(v.id) END)::integer
  FROM public.poll_options o
  LEFT JOIN public.poll_votes v ON v.option_id = o.id
  WHERE o.poll_id = _poll_id
  GROUP BY o.id, o.label, o.sort_order
  ORDER BY o.sort_order, o.label;
END;
$function$;