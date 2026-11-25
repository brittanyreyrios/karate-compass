CREATE OR REPLACE FUNCTION public.get_technique_library()
 RETURNS TABLE(id uuid, program_id uuid, program_name text, label text, title text, category text, difficulty text, notes text, sort_order integer, published boolean, video_youtube_id text, video_title text, video_seconds integer, video_orientation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tl.id, tl.program_id, pr.name, tl.label, tl.title,
         tl.category, tl.difficulty, tl.notes, tl.sort_order,
         tl.published, tl.video_youtube_id, tl.video_title, tl.video_seconds,
         tl.video_orientation
  FROM public.technique_library tl
  JOIN public.programs pr ON pr.id = tl.program_id
  WHERE
    public.has_role(auth.uid(), 'admin')
    OR (
      public.is_active_member()  -- guard
      AND tl.published = true
    )
  ORDER BY tl.category, tl.sort_order, tl.title;
$function$;