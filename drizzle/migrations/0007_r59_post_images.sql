ALTER TABLE public.announcements ADD COLUMN image_url text, ADD COLUMN image_alt text;
ALTER TABLE public.polls ADD COLUMN image_url text, ADD COLUMN image_alt text;
CREATE POLICY "Signed-in users can read post images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-images');
CREATE POLICY "Admins upload post images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update post images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'post-images' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'post-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete post images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-images' AND public.has_role(auth.uid(), 'admin'));