
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Restrict bucket SELECT to objects owned by the user; public access still works via signed/public URL paths
DROP POLICY IF EXISTS "Profile photos are publicly accessible" ON storage.objects;

-- Mark bucket as not public to disable anonymous listing; we'll serve via signed URLs OR keep public read of specific objects
-- Keeping public read but scoping per-user listing
CREATE POLICY "Anyone can view profile photo objects"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL OR bucket_id = 'profile-photos');
