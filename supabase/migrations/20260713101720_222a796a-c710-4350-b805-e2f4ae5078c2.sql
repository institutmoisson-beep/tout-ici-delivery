
-- Public read (needed so images display via public URL even in a private bucket setup with signed URLs is avoided)
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "media_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "media_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "media_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));
