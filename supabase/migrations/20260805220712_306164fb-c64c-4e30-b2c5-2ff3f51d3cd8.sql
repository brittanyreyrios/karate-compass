-- 1. Backfill sort_order. Every row is currently 0 because the admin insert never
-- set it. Numbering is PER GROUP (one belt rank, or one tier for tier-wide rows)
-- and follows created_at, so items keep the order staff entered them in.
WITH ordered AS (
  SELECT id,
         (row_number() OVER (
            PARTITION BY belt_rank_id, CASE WHEN belt_rank_id IS NULL THEN curriculum_tier END
            ORDER BY created_at, id
          ) - 1)::integer AS pos
  FROM public.curriculum_items
)
UPDATE public.curriculum_items ci
SET sort_order = o.pos
FROM ordered o
WHERE o.id = ci.id AND ci.sort_order IS DISTINCT FROM o.pos;

-- 2. Next position for a new item, computed server-side so two admins adding at
-- the same moment cannot both read the same MAX and collide on one value.
CREATE OR REPLACE FUNCTION public.next_curriculum_sort_order(
  _belt_rank_id uuid,
  _curriculum_tier text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF _belt_rank_id IS NOT NULL THEN
    SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_next
    FROM public.curriculum_items
    WHERE belt_rank_id = _belt_rank_id
    FOR UPDATE;
  ELSE
    SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_next
    FROM public.curriculum_items
    WHERE belt_rank_id IS NULL AND curriculum_tier = _curriculum_tier
    FOR UPDATE;
  END IF;

  RETURN COALESCE(v_next, 0);
END;
$$;

-- 3. Batched sibling of get_curriculum_for_student: every child on the CALLING
-- account in one round trip. Entitlement is still resolved entirely server-side
-- from auth.uid() — the parent link, the student's rank, the system and the tier
-- ceiling are all read here, never accepted from the client. The per-row filter
-- and the ORDER BY contract are copied verbatim from get_curriculum_for_student,
-- with student_id/first_name prepended so rows stay contiguous per child and,
-- within a child, contiguous by group_label for the frontend's run-length loop.
CREATE OR REPLACE FUNCTION public.get_curriculum_for_all_children()
RETURNS TABLE(
  student_id uuid,
  first_name text,
  belt_rank_id_student uuid,
  student_created_at timestamptz,
  id uuid,
  technique text,
  category text,
  notes text,
  sort_order integer,
  belt_rank_id uuid,
  curriculum_tier text,
  rank_name text,
  group_label text,
  is_current boolean,
  video_youtube_id text,
  video_title text,
  video_seconds integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH tiers AS (SELECT ARRAY['beginner','intermediate','advanced']::text[] AS t),
  kids AS (
    SELECT s.id, s.first_name, s.belt_rank_id, s.created_at,
           r.system_id, r.sort_order AS rank_order, r.curriculum_tier AS tier
    FROM public.students s
    LEFT JOIN public.belt_ranks r ON r.id = s.belt_rank_id
    WHERE s.parent_id = auth.uid()
  )
  SELECT k.id,
         k.first_name,
         k.belt_rank_id,
         k.created_at,
         ci.id,
         ci.technique,
         ci.category,
         ci.notes,
         ci.sort_order,
         ci.belt_rank_id,
         ci.curriculum_tier,
         cr.name,
         CASE WHEN cr.id IS NOT NULL THEN cr.name
              ELSE 'All ' || initcap(ci.curriculum_tier) || ' students' END,
         CASE WHEN cr.id IS NOT NULL THEN (cr.id = k.belt_rank_id)
              ELSE (ci.curriculum_tier = k.tier) END,
         ci.video_youtube_id,
         ci.video_title,
         ci.video_seconds
  FROM kids k
  CROSS JOIN tiers
  JOIN public.curriculum_items ci ON ci.active = true
  LEFT JOIN public.belt_ranks cr ON cr.id = ci.belt_rank_id
  WHERE k.belt_rank_id IS NOT NULL
    AND (
      (cr.id IS NOT NULL AND cr.system_id = k.system_id AND cr.sort_order <= k.rank_order)
      OR (
        ci.belt_rank_id IS NULL
        AND ci.curriculum_tier IS NOT NULL
        AND k.tier IS NOT NULL
        AND array_position(tiers.t, ci.curriculum_tier) <= array_position(tiers.t, k.tier)
      )
    )
  ORDER BY k.created_at,
           k.id,
           (CASE WHEN cr.id IS NOT NULL THEN (cr.id = k.belt_rank_id)
                 ELSE (ci.curriculum_tier = k.tier) END) DESC,
           (cr.id IS NULL),
           cr.sort_order DESC NULLS LAST,
           array_position(tiers.t, ci.curriculum_tier) DESC NULLS LAST,
           ci.sort_order,
           ci.technique;
$$;

-- 4. Indexes matching how the entitlement functions actually read the table.
-- Rank branch filters belt_rank_id and orders by sort_order:
CREATE INDEX IF NOT EXISTS curriculum_items_rank_order_idx
  ON public.curriculum_items (belt_rank_id, sort_order)
  WHERE active = true;
-- Tier-wide branch filters belt_rank_id IS NULL + curriculum_tier, orders by sort_order:
CREATE INDEX IF NOT EXISTS curriculum_items_tier_order_idx
  ON public.curriculum_items (curriculum_tier, sort_order)
  WHERE active = true AND belt_rank_id IS NULL;
-- Admin list and every read start from active:
CREATE INDEX IF NOT EXISTS curriculum_items_active_idx
  ON public.curriculum_items (active);