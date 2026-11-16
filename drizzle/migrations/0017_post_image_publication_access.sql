CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.archived_at IS NULL
    );
$function$;

REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_post_image(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
    OR (
      public.is_active_member()
      AND (
        EXISTS (
          SELECT 1
          FROM public.announcements AS a
          WHERE a.image_url = _object_name
            AND (a.publish_at IS NULL OR a.publish_at <= now())
        )
        OR EXISTS (
          SELECT 1
          FROM public.polls AS p
          WHERE p.image_url = _object_name
            AND p.published = true
        )
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_read_post_image(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_post_image(text) TO authenticated;

DROP POLICY "Signed-in users can read post images" ON storage.objects;

CREATE POLICY "Signed-in users can read post images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-images'
  AND public.can_read_post_image(name)
);