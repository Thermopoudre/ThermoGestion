-- Migration 003 : Policies RLS Storage Supabase
-- ✅ Créées via MCP Supabase le 20/01/2026

-- Policies RLS pour bucket "photos"
CREATE POLICY IF NOT EXISTS "Users can upload photos in their atelier"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can view photos in their atelier"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can delete photos in their atelier"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
  );

-- Policies RLS pour bucket "pdfs"
CREATE POLICY IF NOT EXISTS "Users can upload pdfs in their atelier"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pdfs' AND
    (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can view pdfs in their atelier"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pdfs' AND
    (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "Users can delete pdfs in their atelier"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pdfs' AND
    (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
  );

-- Policies RLS pour bucket "signatures"
-- Pour signatures, on vérifie que l'utilisateur est authentifié
CREATE POLICY IF NOT EXISTS "Users can upload signatures"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'signatures' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY IF NOT EXISTS "Users can view signatures"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'signatures' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY IF NOT EXISTS "Users can delete signatures"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'signatures' AND
    auth.uid() IS NOT NULL
  );
