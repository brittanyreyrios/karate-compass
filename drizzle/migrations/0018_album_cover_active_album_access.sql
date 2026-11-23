CREATE OR REPLACE FUNCTION public.can_read_album_cover(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false)
    OR (
      public.is_active_member()
      AND EXISTS (
        SELECT 1
        FROM public.gallery_albums AS a
        WHERE a.cover_image_url = _object_name
          AND a.active = true
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_read_album_cover(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_album_cover(text) TO authenticated;

DROP POLICY "Signed-in users can read album covers" ON storage.objects;

CREATE POLICY "Signed-in users can read album covers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'album-covers'
  AND public.can_read_album_cover(name)
);