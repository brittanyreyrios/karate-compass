-- SECTION D — POLLS / VOTING
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  description text,
  anonymous boolean NOT NULL DEFAULT true,
  respond_per text NOT NULL DEFAULT 'family',
  multi_select boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  results_visible text NOT NULL DEFAULT 'after_close',
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polls_respond_per_check CHECK (respond_per IN ('family','student')),
  CONSTRAINT polls_results_visible_check CHECK (results_visible IN ('always','after_vote','after_close','admins_only'))
);

CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.polls TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;

CREATE INDEX poll_options_poll_idx ON public.poll_options(poll_id, sort_order);
CREATE INDEX poll_votes_poll_idx ON public.poll_votes(poll_id);
CREATE INDEX poll_votes_profile_idx ON public.poll_votes(profile_id);

-- Duplicate-row guards (same option twice)
CREATE UNIQUE INDEX poll_votes_family_option_uniq
  ON public.poll_votes(poll_id, profile_id, option_id) WHERE student_id IS NULL;
CREATE UNIQUE INDEX poll_votes_student_option_uniq
  ON public.poll_votes(poll_id, profile_id, student_id, option_id) WHERE student_id IS NOT NULL;

-- Single-select enforcement in the database (multi_select lives on polls, so an index cannot express it)
CREATE OR REPLACE FUNCTION public.enforce_poll_single_select()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_multi boolean; v_per text;
BEGIN
  SELECT multi_select, respond_per INTO v_multi, v_per FROM public.polls WHERE id = NEW.poll_id;
  IF v_multi THEN RETURN NEW; END IF;
  IF v_per = 'student' THEN
    IF EXISTS (SELECT 1 FROM public.poll_votes v WHERE v.poll_id = NEW.poll_id
               AND v.profile_id = NEW.profile_id AND v.student_id IS NOT DISTINCT FROM NEW.student_id
               AND v.id <> NEW.id) THEN
      RAISE EXCEPTION 'This student has already answered this poll';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.poll_votes v WHERE v.poll_id = NEW.poll_id
               AND v.profile_id = NEW.profile_id AND v.id <> NEW.id) THEN
      RAISE EXCEPTION 'This family has already answered this poll';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER poll_votes_single_select
BEFORE INSERT OR UPDATE ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.enforce_poll_single_select();

CREATE TRIGGER polls_set_updated_at
BEFORE UPDATE ON public.polls
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in view published polls" ON public.polls FOR SELECT TO authenticated
  USING (published = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert polls" ON public.polls FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update polls" ON public.polls FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete polls" ON public.polls FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Signed in view options of visible polls" ON public.poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
                 AND (p.published = true OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Admins insert poll options" ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update poll options" ON public.poll_options FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete poll options" ON public.poll_options FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Votes: a parent sees only their own; only staff ever see who voted what.
CREATE POLICY "Parents view own votes" ON public.poll_votes FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
CREATE POLICY "Admins view all votes" ON public.poll_votes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parents insert own votes before close" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id
                AND p.published = true AND (p.closes_at IS NULL OR p.closes_at > now()))
    AND (
      student_id IS NULL
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = poll_votes.student_id AND s.parent_id = auth.uid())
    )
  );
CREATE POLICY "Parents update own votes before close" ON public.poll_votes FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()
         AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id
                     AND (p.closes_at IS NULL OR p.closes_at > now())))
  WITH CHECK (profile_id = auth.uid()
         AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id
                     AND (p.closes_at IS NULL OR p.closes_at > now()))
         AND (student_id IS NULL
              OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = poll_votes.student_id AND s.parent_id = auth.uid())));
CREATE POLICY "Parents delete own votes before close" ON public.poll_votes FOR DELETE TO authenticated
  USING (profile_id = auth.uid()
         AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id
                     AND (p.closes_at IS NULL OR p.closes_at > now())));
CREATE POLICY "Admins manage votes" ON public.poll_votes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Totals only. No voter identities, ever.
CREATE OR REPLACE FUNCTION public.get_poll_results(_poll_id uuid)
RETURNS TABLE(option_id uuid, label text, vote_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT o.id, o.label, COUNT(v.id)::integer
  FROM public.poll_options o
  LEFT JOIN public.poll_votes v ON v.option_id = o.id
  WHERE o.poll_id = _poll_id
  GROUP BY o.id, o.label, o.sort_order
  ORDER BY o.sort_order, o.label;
END;
$$;

-- Admin-only named breakdown. Deliberately a separate function.
CREATE OR REPLACE FUNCTION public.get_poll_breakdown(_poll_id uuid)
RETURNS TABLE(family_name text, email text, student_name text, option_label text, voted_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF EXISTS (SELECT 1 FROM public.polls p WHERE p.id = _poll_id AND p.anonymous = true) THEN
    RAISE EXCEPTION 'This poll is anonymous — individual responses are not available';
  END IF;
  RETURN QUERY
  SELECT pr.family_name, pr.email,
         CASE WHEN s.id IS NULL THEN NULL ELSE s.first_name || ' ' || s.last_name END,
         o.label, v.created_at
  FROM public.poll_votes v
  JOIN public.poll_options o ON o.id = v.option_id
  JOIN public.profiles pr ON pr.id = v.profile_id
  LEFT JOIN public.students s ON s.id = v.student_id
  WHERE v.poll_id = _poll_id
  ORDER BY pr.family_name, s.first_name, o.label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_breakdown(uuid) TO authenticated;