-- =====================================================
-- MIGRATION COMPLÈTE : 52 améliorations ThermoGestion
-- Date: 2026-02-08
-- =====================================================

-- 1. POUDRES: péremption, lots, fiche technique, cuisson détaillée
ALTER TABLE poudres
  ADD COLUMN IF NOT EXISTS date_peremption date,
  ADD COLUMN IF NOT EXISTS numero_lot text,
  ADD COLUMN IF NOT EXISTS fiche_technique_url text,
  ADD COLUMN IF NOT EXISTS fds_url text,
  ADD COLUMN IF NOT EXISTS fournisseur text,
  ADD COLUMN IF NOT EXISTS date_reception date,
  ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS qualicoat_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualimarine_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS epaisseur_min_um integer,
  ADD COLUMN IF NOT EXISTS epaisseur_max_um integer,
  ADD COLUMN IF NOT EXISTS temp_cuisson_min integer,
  ADD COLUMN IF NOT EXISTS temp_cuisson_max integer,
  ADD COLUMN IF NOT EXISTS duree_cuisson_min integer,
  ADD COLUMN IF NOT EXISTS duree_cuisson_max integer;

-- 2. PROJETS: cuisson réelle + épaisseur mesurée
ALTER TABLE projets
  ADD COLUMN IF NOT EXISTS temp_cuisson_reelle integer,
  ADD COLUMN IF NOT EXISTS duree_cuisson_reelle integer,
  ADD COLUMN IF NOT EXISTS ecart_temperature integer,
  ADD COLUMN IF NOT EXISTS epaisseur_mesuree_um numeric(10,2),
  ADD COLUMN IF NOT EXISTS epaisseur_min_um numeric(10,2),
  ADD COLUMN IF NOT EXISTS epaisseur_max_um numeric(10,2),
  ADD COLUMN IF NOT EXISTS poids_total_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS dimensions_piece text,
  ADD COLUMN IF NOT EXISTS quality_validated_at timestamptz;

-- 3. ATELIERS: config four + watermark + quotas + certifications
ALTER TABLE ateliers
  ADD COLUMN IF NOT EXISTS four_longueur_cm integer,
  ADD COLUMN IF NOT EXISTS four_largeur_cm integer,
  ADD COLUMN IF NOT EXISTS four_hauteur_cm integer,
  ADD COLUMN IF NOT EXISTS four_poids_max_kg integer,
  ADD COLUMN IF NOT EXISTS four_fournees_jour integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS four_temp_max integer DEFAULT 250,
  ADD COLUMN IF NOT EXISTS watermark_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS watermark_url text,
  ADD COLUMN IF NOT EXISTS storage_quota_gb integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS storage_used_bytes bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS certification_qualicoat boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_qualicoat_expiry date,
  ADD COLUMN IF NOT EXISTS certification_qualimarine boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_qualimarine_expiry date,
  ADD COLUMN IF NOT EXISTS certifications_autres jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS objectif_m2_jour numeric(10,2),
  ADD COLUMN IF NOT EXISTS objectif_pieces_jour integer,
  ADD COLUMN IF NOT EXISTS objectif_series_jour integer;

-- 4. TABLE: Consommables (EPI, filtres, produits chimiques)
CREATE TABLE IF NOT EXISTS consommables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  nom text NOT NULL,
  categorie text NOT NULL DEFAULT 'autre',
  description text,
  unite text DEFAULT 'pièce',
  stock_actuel numeric(10,2) DEFAULT 0,
  stock_minimum numeric(10,2) DEFAULT 0,
  prix_unitaire numeric(10,2),
  fournisseur text,
  reference_fournisseur text,
  date_peremption date,
  emplacement text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. TABLE: Mouvements consommables
CREATE TABLE IF NOT EXISTS consommables_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consommable_id uuid NOT NULL REFERENCES consommables(id) ON DELETE CASCADE,
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement')),
  quantite numeric(10,2) NOT NULL,
  motif text,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 6. TABLE: Maintenance équipements
CREATE TABLE IF NOT EXISTS maintenance_equipements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id uuid NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'preventive',
  description text NOT NULL,
  date_planifiee date,
  date_realisee date,
  cout numeric(10,2),
  technicien text,
  notes text,
  statut text DEFAULT 'planifie',
  prochaine_maintenance date,
  intervalle_jours integer,
  created_at timestamptz DEFAULT now()
);

-- 7. TABLE: Feature flags par plan
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  plan_lite boolean DEFAULT false,
  plan_pro boolean DEFAULT true,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insérer les feature flags par défaut
INSERT INTO feature_flags (feature_key, label, plan_lite, plan_pro) VALUES
  ('stock_intelligent', 'Stock intelligent avancé', false, true),
  ('grille_tarifaire', 'Grilles tarifaires personnalisables', false, true),
  ('ecran_atelier', 'Écran atelier TV', false, true),
  ('certifications', 'Gestion certifications QUALICOAT', false, true),
  ('consommables', 'Gestion consommables', false, true),
  ('maintenance', 'Maintenance préventive', false, true),
  ('api_publique', 'API publique REST', false, true),
  ('webhooks', 'Webhooks configurables', false, true),
  ('multi_langue', 'Multi-langue', false, true),
  ('previsionnel_ca', 'Prévisionnel CA', true, true),
  ('exports_comptable', 'Exports comptables avancés', false, true),
  ('relances_commerciales', 'Relances commerciales auto', true, true),
  ('devis_templates', 'Templates devis personnalisés', true, true),
  ('portail_client', 'Portail client', true, true),
  ('photos_projet', 'Photos projet', true, true),
  ('planning', 'Planning & calendrier', false, true),
  ('batching', 'Regroupement séries', false, true),
  ('objectifs_journaliers', 'Objectifs journaliers équipe', false, true)
ON CONFLICT (feature_key) DO NOTHING;

-- 8. TABLE: Grilles tarifaires par palier
CREATE TABLE IF NOT EXISTS grilles_tarifaires_paliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  nom text NOT NULL DEFAULT 'Standard',
  surface_min_m2 numeric(10,2) NOT NULL DEFAULT 0,
  surface_max_m2 numeric(10,2),
  prix_m2 numeric(10,2) NOT NULL,
  majoration_metallise_pct numeric(5,2) DEFAULT 25,
  majoration_texture_pct numeric(5,2) DEFAULT 15,
  majoration_brillant_pct numeric(5,2) DEFAULT 10,
  forfait_minimum numeric(10,2) DEFAULT 0,
  prix_kg_petites_pieces numeric(10,2),
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 9. TABLE: Archive factures (archivage légal 10 ans)
CREATE TABLE IF NOT EXISTS factures_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id),
  atelier_id uuid NOT NULL REFERENCES ateliers(id),
  numero text NOT NULL,
  pdf_url text NOT NULL,
  xml_facturx text,
  hash_sha256 text NOT NULL,
  montant_ttc numeric(10,2) NOT NULL,
  date_emission date NOT NULL,
  date_archivage timestamptz DEFAULT now(),
  expire_at date NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factures_archive_atelier ON factures_archive(atelier_id);
CREATE INDEX IF NOT EXISTS idx_factures_archive_expire ON factures_archive(expire_at);

-- 10. TABLE: Data retention logs (RGPD)
CREATE TABLE IF NOT EXISTS data_retention_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid REFERENCES ateliers(id),
  action text NOT NULL,
  table_name text NOT NULL,
  records_affected integer DEFAULT 0,
  details jsonb DEFAULT '{}',
  executed_at timestamptz DEFAULT now()
);

-- 11. TABLE: Objectifs journaliers
CREATE TABLE IF NOT EXISTS objectifs_journaliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  m2_traites numeric(10,2) DEFAULT 0,
  pieces_traitees integer DEFAULT 0,
  series_terminees integer DEFAULT 0,
  projets_livres integer DEFAULT 0,
  temps_production_min integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(atelier_id, date)
);

-- 12. TABLE: Webhooks config
CREATE TABLE IF NOT EXISTS webhooks_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]',
  active boolean DEFAULT true,
  last_triggered_at timestamptz,
  last_status integer,
  created_at timestamptz DEFAULT now()
);

-- 13. TABLE: Blog articles
CREATE TABLE IF NOT EXISTS blog_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  cover_image_url text,
  author text DEFAULT 'ThermoGestion',
  tags jsonb DEFAULT '[]',
  published boolean DEFAULT false,
  published_at timestamptz,
  views integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 14. TABLE: Exit surveys
CREATE TABLE IF NOT EXISTS exit_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid REFERENCES ateliers(id),
  user_email text,
  reason text NOT NULL,
  details text,
  plan text,
  duration_months integer,
  would_return boolean,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

-- 15. TABLE: Roadmap items (public)
CREATE TABLE IF NOT EXISTS roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text DEFAULT 'feature',
  status text DEFAULT 'planned',
  priority integer DEFAULT 0,
  votes integer DEFAULT 0,
  target_date date,
  released_at date,
  created_at timestamptz DEFAULT now()
);

-- 16. TABLE: Prévisionnel CA
CREATE TABLE IF NOT EXISTS previsionnel_ca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  mois date NOT NULL,
  ca_prevu numeric(12,2) DEFAULT 0,
  ca_reel numeric(12,2) DEFAULT 0,
  devis_en_attente numeric(12,2) DEFAULT 0,
  taux_conversion numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(atelier_id, mois)
);

-- 17. TABLE: API Keys (API publique)
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  label text NOT NULL DEFAULT 'API Key',
  permissions jsonb DEFAULT '["read"]',
  rate_limit_per_hour integer DEFAULT 1000,
  last_used_at timestamptz,
  expires_at timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 18. TABLE: Pesées stock (stock intelligent)
CREATE TABLE IF NOT EXISTS pesees_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  poudre_id uuid NOT NULL REFERENCES poudres(id) ON DELETE CASCADE,
  poids_brut_kg numeric(10,3) NOT NULL,
  tare_kg numeric(10,3) NOT NULL DEFAULT 0,
  poids_net_kg numeric(10,3) NOT NULL,
  stock_theorique_avant numeric(10,3),
  ecart_kg numeric(10,3),
  score_fiabilite numeric(5,2),
  peseur text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 19. TABLE: Suggestions pesées quotidiennes
CREATE TABLE IF NOT EXISTS suggestions_pesees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id uuid NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  poudre_id uuid NOT NULL REFERENCES poudres(id) ON DELETE CASCADE,
  date_suggestion date NOT NULL DEFAULT CURRENT_DATE,
  raison text,
  priorite integer DEFAULT 0,
  realisee boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(atelier_id, poudre_id, date_suggestion)
);

-- RLS policies pour nouvelles tables
ALTER TABLE consommables ENABLE ROW LEVEL SECURITY;
ALTER TABLE consommables_mouvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_equipements ENABLE ROW LEVEL SECURITY;
ALTER TABLE grilles_tarifaires_paliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectifs_journaliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesees_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions_pesees ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE previsionnel_ca ENABLE ROW LEVEL SECURITY;

-- RLS: Consommables
CREATE POLICY IF NOT EXISTS "consommables_atelier" ON consommables
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: Grilles tarifaires
CREATE POLICY IF NOT EXISTS "grilles_atelier" ON grilles_tarifaires_paliers
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: Factures archive
CREATE POLICY IF NOT EXISTS "archive_atelier" ON factures_archive
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: Objectifs journaliers
CREATE POLICY IF NOT EXISTS "objectifs_atelier" ON objectifs_journaliers
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: Webhooks
CREATE POLICY IF NOT EXISTS "webhooks_atelier" ON webhooks_config
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: Pesées stock
CREATE POLICY IF NOT EXISTS "pesees_atelier" ON pesees_stock
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: API Keys
CREATE POLICY IF NOT EXISTS "apikeys_atelier" ON api_keys
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- RLS: Prévisionnel CA
CREATE POLICY IF NOT EXISTS "previsionnel_atelier" ON previsionnel_ca
  FOR ALL USING (atelier_id IN (
    SELECT id FROM ateliers WHERE id IN (
      SELECT atelier_id FROM users WHERE auth_id = auth.uid()
    )
  ));

-- Blog & roadmap: public read
ALTER TABLE blog_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "blog_public_read" ON blog_articles
  FOR SELECT USING (published = true);

ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "roadmap_public_read" ON roadmap_items
  FOR SELECT USING (true);
