-- Supabase Storage policies
CREATE POLICY "Users can upload own comic panels" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'PixelPanel' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can view own comic panels" ON storage.objects
FOR SELECT USING (
  bucket_id = 'PixelPanel' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Public read access for Next.js image optimization
CREATE POLICY "Public read access for PixelPanel bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'PixelPanel'
);