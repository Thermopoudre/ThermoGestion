-- Migration : Création des buckets Storage
-- Date : 2026-01-21
-- Description : Crée les buckets pour photos, PDFs et signatures

-- Bucket pour les photos des projets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  10485760, -- 10MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket pour les PDFs (devis, factures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdfs',
  'pdfs',
  true,
  20971520, -- 20MB max
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket pour les signatures électroniques
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  true,
  1048576, -- 1MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Politiques d'accès pour le bucket photos
-- Lecture publique
CREATE POLICY "Photos sont lisibles publiquement"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Upload pour les utilisateurs authentifiés
CREATE POLICY "Utilisateurs authentifiés peuvent uploader des photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');

-- Mise à jour pour les propriétaires
CREATE POLICY "Propriétaires peuvent mettre à jour leurs photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Suppression pour les propriétaires
CREATE POLICY "Propriétaires peuvent supprimer leurs photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Politiques pour le bucket pdfs
CREATE POLICY "PDFs sont lisibles publiquement"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

CREATE POLICY "Utilisateurs authentifiés peuvent uploader des PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Propriétaires peuvent supprimer leurs PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdfs');

-- Politiques pour le bucket signatures
CREATE POLICY "Signatures sont lisibles publiquement"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

CREATE POLICY "Utilisateurs authentifiés peuvent uploader des signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Propriétaires peuvent supprimer leurs signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'signatures');
