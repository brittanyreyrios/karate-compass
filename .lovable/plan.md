# Unclaimed students — database and security only

Starting commit: `fefa6e71a1f411928a1fb221eb290fc943acf6b1`.
Live baseline: 138 students; no null parent links. No database changes have been applied.

## Scope and resolved decisions
- Staff can store real student records before a family signs up; attendance and points already reference student IDs, so no reference changes are needed.
- Preserve second-guardian access, as requested after reviewing the existing policies. Parents cannot access unclaimed students.
- Return a generic JSON failure instead of raising an exception, so failed attempts remain logged.
- No UI, dependency, signup, class-date, leaderboard, or belt changes. Credentials remain environment-only; none will be written to committed files.
- There is no belt-history table to change. Current belt is stored on students through belt_rank_id.

## Access policy comparison
The four existing admin student policies stay byte-identical.

| Policy | Existing USING | Proposed USING |
|---|---|---|
| Parents view own students | `is_guardian_of(id)` | `parent_id IS NOT NULL AND public.is_guardian_of(id)` |

The guardian helper also requires a claimed student, protecting existing SECURITY DEFINER curriculum/library reads if staff accidentally link a guardian to an unclaimed record. Existing helper grants and other policies remain unchanged.

The existing guardian-sync function gains a null-parent insert guard. Claimed students cannot be detached into unclaimed records; moving between families retains the existing workflow and safeguards.

## Full proposed SQL — approval required before applying
This is review text, not an applied migration. The platform migration tool will create the single authoritative file under drizzle/migrations after approval.

```sql
ALTER TABLE public.students ALTER COLUMN parent_id DROP NOT NULL;
ALTER TABLE public.students
  ADD COLUMN claim_code text,
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN created_by_staff boolean NOT NULL DEFAULT false;
ALTER TABLE public.students
  ADD CONSTRAINT students_claim_code_unique UNIQUE (claim_code),
  ADD CONSTRAINT students_claim_code_format
    CHECK (claim_code IS NULL OR claim_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  ADD CONSTRAINT students_claim_code_unclaimed_only
    CHECK (parent_id IS NULL OR claim_code IS NULL);

CREATE TABLE public.claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL
);
GRANT SELECT ON public.claim_attempts TO authenticated;
GRANT ALL ON public.claim_attempts TO service_role;
ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read claim attempts"
  ON public.claim_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX claim_attempts_failed_user_time_idx
  ON public.claim_attempts (user_id, attempted_at DESC)
  WHERE success = false;

CREATE OR REPLACE FUNCTION public.sync_primary_guardian()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT DISTINCT FROM NEW.parent_id THEN
    RETURN NULL;
  END IF;
  IF NEW.parent_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Move this student to another family instead of removing the main family.';
    END IF;
    RETURN NULL;
  END IF;
  UPDATE public.student_guardians
     SET is_primary = false
   WHERE student_id = NEW.id AND is_primary;
  INSERT INTO public.student_guardians (student_id, profile_id, is_primary)
  VALUES (NEW.id, NEW.parent_id, true)
  ON CONFLICT (student_id, profile_id)
  DO UPDATE SET is_primary = true, updated_at = now();
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.student_guardians
     WHERE student_id = NEW.id AND profile_id = OLD.parent_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_guardian_of(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.student_guardians g
    JOIN public.students s ON s.id = g.student_id
    WHERE g.student_id = _student_id
      AND g.profile_id = auth.uid()
      AND s.parent_id IS NOT NULL
  );
$function$;

ALTER POLICY "Parents view own students" ON public.students
  USING (parent_id IS NOT NULL AND public.is_guardian_of(id));

CREATE FUNCTION public.prepare_student_claim_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_byte integer;
  v_limit integer := (256 / length(v_alphabet)) * length(v_alphabet);
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    NEW.claim_code := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.claim_code IS NULL THEN
    -- Serialise generation; the unique constraint is the final safeguard.
    PERFORM pg_advisory_xact_lock(71370, 1);
    LOOP
      v_code := '';
      WHILE length(v_code) < 8 LOOP
        v_byte := get_byte(extensions.gen_random_bytes(1), 0);
        -- Rejection sampling avoids modulo bias.
        IF v_byte < v_limit THEN
          v_code := v_code || substr(v_alphabet, (v_byte % length(v_alphabet)) + 1, 1);
        END IF;
      END LOOP;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.students WHERE claim_code = v_code
      );
    END LOOP;
    NEW.claim_code := v_code;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.prepare_student_claim_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_student_claim_code() TO service_role;
CREATE TRIGGER students_prepare_claim_code
  BEFORE INSERT OR UPDATE OF parent_id, claim_code ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.prepare_student_claim_code();

CREATE FUNCTION public.claim_student(code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_now timestamptz;
  v_student uuid;
  v_failed integer;
  v_failure constant jsonb := '{"success":false,"message":"Unable to claim this student. Check the code or try again later."}'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN v_failure;
  END IF;
  -- Serialise attempts from the same account, including parallel requests.
  PERFORM pg_advisory_xact_lock(71371, hashtext(v_user::text));
  v_now := clock_timestamp();
  SELECT count(*) INTO v_failed
    FROM public.claim_attempts
   WHERE user_id = v_user AND success = false
     AND attempted_at >= v_now - interval '1 hour';
  IF v_failed >= 5 OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user
  ) THEN
    INSERT INTO public.claim_attempts (user_id, attempted_at, success)
    VALUES (v_user, v_now, false);
    RETURN v_failure;
  END IF;

  SELECT s.id INTO v_student
    FROM public.students s
   WHERE s.claim_code = upper(btrim(code)) AND s.parent_id IS NULL
   FOR UPDATE;
  IF v_student IS NULL THEN
    INSERT INTO public.claim_attempts (user_id, attempted_at, success)
    VALUES (v_user, v_now, false);
    RETURN v_failure;
  END IF;

  UPDATE public.students
     SET parent_id = v_user, claimed_at = v_now, claim_code = NULL
   WHERE id = v_student;
  -- Existing guardian sync creates/promotes the claimant's primary link.
  INSERT INTO public.claim_attempts (user_id, attempted_at, success)
  VALUES (v_user, v_now, true);
  RETURN jsonb_build_object('success', true, 'student_id', v_student);
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_student(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_student(text) TO authenticated;

COMMENT ON COLUMN public.students.claim_code IS
  'Private one-time 8-character claim code for unclaimed students; cleared on claim.';
COMMENT ON COLUMN public.students.claimed_at IS
  'Time of successful self-service claim; existing family links are not backfilled.';
COMMENT ON COLUMN public.students.created_by_staff IS
  'Staff creation provenance; defaults false, explicitly set true for staff-created records.';
COMMENT ON TABLE public.claim_attempts IS
  'Claim RPC attempt log. Only the definer function writes; admins can read.';
```

## Verification after approval
- Use only the dedicated parent/staff fixtures and clearly named temporary students; never claim or change a real child.
- Keep focused database integration tests in the project: eight-character allowed alphabet/uniqueness; no parent reads before claim; second guardians retain access; admin writes; successful claim preserves student ID/attendance/points; used and invalid codes share a failure; five failures block a correct code; parallel claims cannot both succeed; unauthenticated execution and direct attempt-log writes are refused.
- Verify existing students/guardian links and per-rank counts before/after; remove temporary children and only fixture attempts created by these tests.
- Run the security scan and report warnings, including any existing ones. Report full applied SQL, read-back constraints/grants/policies, cleanup, and explicit package.json/bun.lock diff (expected: no dependency changes).

## Deployment and permission notes
Making parent_id nullable requires DROP NOT NULL. The tool may refuse under the current backward-incompatible-migration permission; if refused, no alternative column will be silently substituted. You would need Settings → Agent permissions → Execute backward incompatible database migrations set to Ask each time or Always allow.

No UI is changed in this phase. Current staff screens assume every child has a parent; unclaimed records must not be entered through those screens until a later UI round addresses those assumptions. This phase provides database support, not a finished staff entry workflow.

Approval of this plan approves the full SQL above; no migration or scan has run yet.