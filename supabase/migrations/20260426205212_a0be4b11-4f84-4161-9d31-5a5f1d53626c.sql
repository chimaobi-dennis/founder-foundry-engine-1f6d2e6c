-- Create storage bucket for template output thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-outputs', 'template-outputs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (bucket is public)
CREATE POLICY "Public read access for template-outputs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-outputs');

-- Allow authenticated users to upload thumbnails into their own folder
CREATE POLICY "Users can upload to their own folder in template-outputs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'template-outputs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update / replace their own thumbnails
CREATE POLICY "Users can update their own template-outputs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'template-outputs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own thumbnails
CREATE POLICY "Users can delete their own template-outputs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'template-outputs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );