-- Supabase Storage policies
CREATE POLICY "Users can upload own comic panels" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'comic-panels' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can view own comic panels" ON storage.objects
FOR SELECT USING (
  bucket_id = 'comic-panels' AND
  auth.uid()::text = (storage.foldername(name))[2]
);