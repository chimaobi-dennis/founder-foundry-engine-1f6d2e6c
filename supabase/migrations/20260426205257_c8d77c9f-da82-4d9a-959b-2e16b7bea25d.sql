-- Replace overly broad public SELECT policy with a folder-scoped one.
-- The bucket is public, so direct image URLs still work without auth.
DROP POLICY IF EXISTS "Public read access for template-outputs" ON storage.objects;

CREATE POLICY "Users can list their own template-outputs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'template-outputs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );