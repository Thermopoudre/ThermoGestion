-- Migration 002 : Création des buckets Storage Supabase
-- ✅ Buckets créés via MCP Supabase le 20/01/2026
-- Les buckets ont été créés directement via execute_sql

-- Bucket: photos
-- - Public: false (privé, accès via RLS)
-- - Allowed MIME types: image/*
-- - File size limit: 10 MB (avant compression)
-- - Structure: {atelier_id}/{projet_id}/{filename}

-- Bucket: pdfs
-- - Public: false (privé, accès via RLS)
-- - Allowed MIME types: application/pdf
-- - File size limit: 5 MB
-- - Structure: {atelier_id}/devis/{filename} ou {atelier_id}/factures/{filename}

-- Bucket: signatures
-- - Public: false (privé, accès via RLS)
-- - Allowed MIME types: image/*
-- - File size limit: 1 MB
-- - Structure: {filename}

-- Policies Storage RLS (à créer via Dashboard ou API)
-- Les policies doivent isoler les fichiers par atelier_id

-- Exemple de policy pour photos:
-- CREATE POLICY "Users can upload photos in their atelier"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'photos' AND
--     (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
--   );

-- CREATE POLICY "Users can view photos in their atelier"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'photos' AND
--     (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
--   );

-- Note: Les buckets doivent être créés manuellement via:
-- 1. Dashboard Supabase → Storage → New bucket
-- 2. Ou via API Supabase Management
