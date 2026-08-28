CREATE TABLE public.tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  announcement_id uuid NULL REFERENCES public.announcements(id) ON DELETE SET NULL,
  tournament_name text NOT NULL,
  tournament_date date NOT NULL,
  event_name text NOT NULL,
  placement smallint NULL CONSTRAINT tournament_results_placement_positive CHECK (placement IS NULL OR placement > 0),
  disciplines text[] NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tournament_results_student_date_idx
  ON public.tournament_results (student_id, tournament_date DESC);
CREATE INDEX tournament_results_announcement_idx
  ON public.tournament_results (announcement_id);

CREATE TRIGGER tournament_results_updated_at
  BEFORE UPDATE ON public.tournament_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own children tournament results"
  ON public.tournament_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = tournament_results.student_id AND s.parent_id = auth.uid()
  ));

CREATE POLICY "Admins view tournament results"
  ON public.tournament_results FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert tournament results"
  ON public.tournament_results FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update tournament results"
  ON public.tournament_results FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tournament results"
  ON public.tournament_results FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.tournament_results FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_results TO authenticated;
GRANT ALL ON public.tournament_results TO service_role;