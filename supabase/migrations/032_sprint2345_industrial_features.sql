-- ============================================================
-- MIGRATION 032: Sprints 2-5 - Features industrielles completes
-- ============================================================

-- ── SPRINT 3: FOURNISSEURS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  contact_nom TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  siret TEXT,
  conditions_paiement TEXT DEFAULT 'Net 30 jours',
  delai_livraison_jours INT DEFAULT 7,
  note_qualite NUMERIC(3,1) DEFAULT 3.0 CHECK (note_qualite >= 0 AND note_qualite <= 5),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fournisseurs_atelier" ON fournisseurs
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_fournisseurs_atelier ON fournisseurs(atelier_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_nom ON fournisseurs(atelier_id, nom);

-- Lier poudres aux fournisseurs
DO $$ BEGIN
  ALTER TABLE poudres ADD COLUMN fournisseur_id UUID REFERENCES fournisseurs(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ── SPRINT 3: LOTS / TRACABILITE ───────────────────────────

CREATE TABLE IF NOT EXISTS lots_poudre (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  poudre_id UUID NOT NULL REFERENCES poudres(id) ON DELETE CASCADE,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  numero_lot TEXT NOT NULL,
  date_reception DATE NOT NULL DEFAULT CURRENT_DATE,
  date_expiration DATE,
  date_fabrication DATE,
  quantite_kg NUMERIC(10,2) NOT NULL CHECK (quantite_kg > 0),
  quantite_restante_kg NUMERIC(10,2) NOT NULL CHECK (quantite_restante_kg >= 0),
  prix_achat_kg NUMERIC(10,2),
  certificat_url TEXT,
  certificat_analyse TEXT,
  conforme BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lots_poudre ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lots_poudre_atelier" ON lots_poudre
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_lots_poudre_atelier ON lots_poudre(atelier_id);
CREATE INDEX IF NOT EXISTS idx_lots_poudre_poudre ON lots_poudre(poudre_id);
CREATE INDEX IF NOT EXISTS idx_lots_expiration ON lots_poudre(date_expiration)
  WHERE date_expiration IS NOT NULL;

-- Lier projets aux lots (tracabilite complete)
DO $$ BEGIN
  ALTER TABLE projets ADD COLUMN lot_poudre_id UUID REFERENCES lots_poudre(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ── SPRINT 3: QUALITY GATES ────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_gates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  etape_declenchement TEXT NOT NULL, -- status du projet qui declenche le gate
  checks JSONB NOT NULL DEFAULT '[]',
  -- [{"label": "Epaisseur conforme", "type": "boolean", "required": true},
  --  {"label": "Epaisseur mesuree (um)", "type": "number", "min": 60, "max": 120, "required": true}]
  bloquant BOOLEAN DEFAULT true, -- si true, impossible de passer a l'etape suivante sans validation
  actif BOOLEAN DEFAULT true,
  ordre INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quality_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quality_gates_atelier" ON quality_gates
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE TABLE IF NOT EXISTS quality_gate_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  quality_gate_id UUID NOT NULL REFERENCES quality_gates(id),
  resultats JSONB NOT NULL DEFAULT '{}',
  conforme BOOLEAN NOT NULL,
  commentaire TEXT,
  photos TEXT[], -- URLs des photos QC
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quality_gate_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quality_gate_results_atelier" ON quality_gate_results
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_qg_results_projet ON quality_gate_results(projet_id);


-- ── SPRINT 3: CERTIFICATS DE CONFORMITE ────────────────────

CREATE TABLE IF NOT EXISTS certificats_conformite (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'standard'
    CHECK (type IN ('standard', 'qualicoat', 'qualimarine', 'gsb', 'custom')),
  -- Mesures
  epaisseur_mesuree NUMERIC(6,1),
  epaisseur_min NUMERIC(6,1),
  epaisseur_max NUMERIC(6,1),
  adherence_ok BOOLEAN,
  brillance_ok BOOLEAN,
  durete_ok BOOLEAN,
  resistance_corrosion_ok BOOLEAN,
  -- Parametres cuisson
  temperature_cuisson INT,
  duree_cuisson INT,
  -- Tracabilite
  lot_poudre_id UUID REFERENCES lots_poudre(id),
  operateur_id UUID REFERENCES users(id),
  -- Resultats detailles
  mesures_detail JSONB DEFAULT '{}',
  remarques TEXT,
  conforme BOOLEAN NOT NULL DEFAULT true,
  pdf_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(atelier_id, numero)
);

ALTER TABLE certificats_conformite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificats_atelier" ON certificats_conformite
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_certificats_projet ON certificats_conformite(projet_id);
CREATE INDEX IF NOT EXISTS idx_certificats_atelier ON certificats_conformite(atelier_id, numero);


-- ── SPRINT 4: WEBHOOKS SORTANTS ────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status INT,
  last_response TEXT,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_owner_admin" ON webhooks
  FOR ALL USING (
    atelier_id = get_user_atelier_id()
    AND user_has_role(ARRAY['owner', 'admin'])
  );

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  duration_ms INT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id, created_at DESC);
-- Auto-nettoyage logs > 30 jours
CREATE INDEX IF NOT EXISTS idx_webhook_logs_cleanup ON webhook_logs(created_at)
  WHERE created_at < NOW() - INTERVAL '30 days';


-- ── SPRINT 4: EXPORT SAGE/EBP ──────────────────────────────

CREATE TABLE IF NOT EXISTS export_comptable_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fec', 'sage', 'ebp', 'cegid', 'csv')),
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,
  nb_ecritures INT NOT NULL DEFAULT 0,
  fichier_url TEXT,
  cree_par UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE export_comptable_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "export_logs_compta" ON export_comptable_logs
  FOR ALL USING (
    atelier_id = get_user_atelier_id()
    AND user_has_role(ARRAY['owner', 'admin', 'compta'])
  );


-- ── SPRINT 4: IMPORT EDI ──────────────────────────────────

CREATE TABLE IF NOT EXISTS edi_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('edifact', 'xml', 'csv', 'json')),
  fichier_original TEXT,
  statut TEXT NOT NULL DEFAULT 'pending'
    CHECK (statut IN ('pending', 'processing', 'completed', 'failed')),
  nb_lignes_total INT DEFAULT 0,
  nb_lignes_importees INT DEFAULT 0,
  nb_erreurs INT DEFAULT 0,
  erreurs_detail JSONB DEFAULT '[]',
  resultat JSONB DEFAULT '{}',
  cree_par UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE edi_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edi_imports_atelier" ON edi_imports
  FOR ALL USING (atelier_id = get_user_atelier_id());


-- ── SPRINT 5: GRILLES TARIFAIRES INDUSTRIELLES ─────────────

CREATE TABLE IF NOT EXISTS grilles_tarifaires_industrielles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- NULL = grille par defaut
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'surface'
    CHECK (type IN ('surface', 'poids', 'piece', 'forfait')),
  paliers JSONB NOT NULL DEFAULT '[]',
  -- [{"min": 0, "max": 10, "prix_unitaire": 25.00},
  --  {"min": 10, "max": 50, "prix_unitaire": 20.00},
  --  {"min": 50, "max": null, "prix_unitaire": 15.00}]
  remise_volume_percent NUMERIC(5,2) DEFAULT 0,
  conditions TEXT,
  valide_du DATE,
  valide_au DATE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE grilles_tarifaires_industrielles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grilles_industrielles_atelier" ON grilles_tarifaires_industrielles
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_grilles_industrielles_client
  ON grilles_tarifaires_industrielles(atelier_id, client_id);


-- ── SPRINT 5: PIPELINE COMMERCIAL CRM ─────────────────────

CREATE TABLE IF NOT EXISTS crm_pipeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  -- Prospect info (si pas encore client)
  prospect_nom TEXT,
  prospect_email TEXT,
  prospect_telephone TEXT,
  prospect_entreprise TEXT,
  -- Pipeline
  etape TEXT NOT NULL DEFAULT 'prospect'
    CHECK (etape IN ('prospect', 'qualification', 'proposition', 'negociation', 'gagne', 'perdu')),
  valeur_estimee NUMERIC(12,2) DEFAULT 0,
  probabilite INT DEFAULT 50 CHECK (probabilite >= 0 AND probabilite <= 100),
  source TEXT CHECK (source IN ('site_web', 'recommandation', 'salon', 'demarchage', 'partenaire', 'autre')),
  -- Suivi
  prochaine_action TEXT,
  date_prochaine_action DATE,
  responsable_id UUID REFERENCES users(id),
  notes TEXT,
  -- Dates
  date_premier_contact DATE DEFAULT CURRENT_DATE,
  date_cloture DATE,
  raison_perte TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_pipeline_atelier" ON crm_pipeline
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_crm_pipeline_atelier_etape
  ON crm_pipeline(atelier_id, etape);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_responsable
  ON crm_pipeline(responsable_id, date_prochaine_action);


-- ── SPRINT 5: MODE DEMO ────────────────────────────────────

-- Flag pour identifier les comptes demo
DO $$ BEGIN
  ALTER TABLE ateliers ADD COLUMN is_demo BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ateliers ADD COLUMN demo_expires_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Donnees demo pre-generees (function)
CREATE OR REPLACE FUNCTION seed_demo_data(p_atelier_id UUID, p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_client1_id UUID;
  v_client2_id UUID;
  v_client3_id UUID;
  v_poudre1_id UUID;
  v_poudre2_id UUID;
  v_poudre3_id UUID;
BEGIN
  -- Clients demo
  INSERT INTO clients (id, atelier_id, full_name, email, phone, type, siret)
  VALUES
    (gen_random_uuid(), p_atelier_id, 'Acier Plus SAS', 'contact@acierplus.fr', '01 23 45 67 89', 'professionnel', '12345678901234'),
    (gen_random_uuid(), p_atelier_id, 'MetalPro Industries', 'commandes@metalpro.fr', '01 98 76 54 32', 'professionnel', '98765432109876'),
    (gen_random_uuid(), p_atelier_id, 'Jean Dupont', 'jean.dupont@email.fr', '06 12 34 56 78', 'particulier', NULL)
  RETURNING id INTO v_client1_id;

  SELECT id INTO v_client1_id FROM clients WHERE atelier_id = p_atelier_id AND full_name = 'Acier Plus SAS' LIMIT 1;
  SELECT id INTO v_client2_id FROM clients WHERE atelier_id = p_atelier_id AND full_name = 'MetalPro Industries' LIMIT 1;
  SELECT id INTO v_client3_id FROM clients WHERE atelier_id = p_atelier_id AND full_name = 'Jean Dupont' LIMIT 1;

  -- Poudres demo
  INSERT INTO poudres (id, atelier_id, marque, reference, type, ral, finition, densite, temp_cuisson, duree_cuisson, consommation_m2, stock_theorique_kg, stock_reel_kg, prix_kg)
  VALUES
    (gen_random_uuid(), p_atelier_id, 'IGP', 'IGP-9005-M', 'polyester', '9005', 'mat', 1.4, 200, 15, 0.12, 25, 22.5, 12.50),
    (gen_random_uuid(), p_atelier_id, 'AkzoNobel', 'INT-7016-S', 'epoxy-polyester', '7016', 'satin', 1.5, 190, 20, 0.15, 40, 38, 14.00),
    (gen_random_uuid(), p_atelier_id, 'Tiger', 'TIG-9016-B', 'polyester', '9016', 'brillant', 1.3, 180, 15, 0.11, 15, 12, 11.00)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_poudre1_id FROM poudres WHERE atelier_id = p_atelier_id AND reference = 'IGP-9005-M' LIMIT 1;
  SELECT id INTO v_poudre2_id FROM poudres WHERE atelier_id = p_atelier_id AND reference = 'INT-7016-S' LIMIT 1;
  SELECT id INTO v_poudre3_id FROM poudres WHERE atelier_id = p_atelier_id AND reference = 'TIG-9016-B' LIMIT 1;

  -- Projets demo (differents statuts)
  INSERT INTO projets (atelier_id, client_id, numero, name, status, poudre_id, couches, temp_cuisson, duree_cuisson, date_depot, date_promise, created_by)
  VALUES
    (p_atelier_id, v_client1_id, 'PROJ-DEMO-001', 'Portail acier 2m x 1.5m', 'en_cours', v_poudre1_id, 2, 200, 15, CURRENT_DATE - 3, CURRENT_DATE + 4, p_user_id),
    (p_atelier_id, v_client2_id, 'PROJ-DEMO-002', 'Lot 50 equerres industrielles', 'en_cuisson', v_poudre2_id, 1, 190, 20, CURRENT_DATE - 5, CURRENT_DATE + 2, p_user_id),
    (p_atelier_id, v_client1_id, 'PROJ-DEMO-003', 'Garde-corps balcon', 'qc', v_poudre1_id, 2, 200, 15, CURRENT_DATE - 7, CURRENT_DATE + 1, p_user_id),
    (p_atelier_id, v_client3_id, 'PROJ-DEMO-004', 'Jantes 4x 17 pouces', 'pret', v_poudre3_id, 2, 180, 15, CURRENT_DATE - 10, CURRENT_DATE, p_user_id),
    (p_atelier_id, v_client2_id, 'PROJ-DEMO-005', 'Lot 200 pattes de fixation', 'devis', v_poudre2_id, 1, 190, 20, NULL, CURRENT_DATE + 14, p_user_id)
  ON CONFLICT DO NOTHING;

  -- Factures demo
  INSERT INTO factures (atelier_id, client_id, numero, type, status, payment_status, total_ht, total_ttc, tva_rate, created_by)
  VALUES
    (p_atelier_id, v_client1_id, 'FACT-DEMO-001', 'complete', 'envoyee', 'paid', 850.00, 1020.00, 20, p_user_id),
    (p_atelier_id, v_client2_id, 'FACT-DEMO-002', 'acompte', 'envoyee', 'unpaid', 1200.00, 1440.00, 20, p_user_id),
    (p_atelier_id, v_client3_id, 'FACT-DEMO-003', 'complete', 'envoyee', 'paid', 320.00, 384.00, 20, p_user_id)
  ON CONFLICT DO NOTHING;

END;
$$ LANGUAGE plpgsql;


-- ── REFRESH AUTOMATIQUE VUE MATERIALISEE ───────────────────

-- Cette function est appelee par le cron /api/cron/refresh-metrics
CREATE OR REPLACE FUNCTION auto_refresh_dashboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics;
END;
$$ LANGUAGE plpgsql;
