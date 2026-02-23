-- ============================================================
-- MIGRATION 031: Sprint 1 - Securite, RBAC, Performance, Sequences
-- ============================================================

-- ── 1. SEQUENCES POUR NUMEROS (elimine les race conditions) ──

CREATE SEQUENCE IF NOT EXISTS seq_facture_numero START 1;
CREATE SEQUENCE IF NOT EXISTS seq_devis_numero START 1;
CREATE SEQUENCE IF NOT EXISTS seq_projet_numero START 1;
CREATE SEQUENCE IF NOT EXISTS seq_bon_livraison_numero START 1;
CREATE SEQUENCE IF NOT EXISTS seq_avoir_numero START 1;

-- Fonction thread-safe pour generer un numero de facture
CREATE OR REPLACE FUNCTION generate_facture_numero(p_atelier_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_seq := nextval('seq_facture_numero');
  RETURN 'FACT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_devis_numero(p_atelier_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_seq := nextval('seq_devis_numero');
  RETURN 'DEV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_projet_numero(p_atelier_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_seq := nextval('seq_projet_numero');
  RETURN 'PROJ-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── 2. INDEXES COMPOSITES POUR PERFORMANCE ──────────────────

-- Dashboard queries
CREATE INDEX IF NOT EXISTS idx_projets_atelier_status_date
  ON projets(atelier_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_factures_atelier_status_date
  ON factures(atelier_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_factures_atelier_payment_paid
  ON factures(atelier_id, payment_status, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_devis_atelier_status_date
  ON devis(atelier_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devis_client_status
  ON devis(client_id, status);

-- Partial indexes for active items (dashboard performance)
CREATE INDEX IF NOT EXISTS idx_projets_actifs
  ON projets(atelier_id, date_promise)
  WHERE status IN ('en_cours', 'en_cuisson', 'qc');

CREATE INDEX IF NOT EXISTS idx_factures_impayees
  ON factures(atelier_id, total_ttc)
  WHERE payment_status = 'unpaid';

CREATE INDEX IF NOT EXISTS idx_devis_en_attente
  ON devis(atelier_id)
  WHERE status IN ('brouillon', 'envoye');

-- Client search (full-text)
CREATE INDEX IF NOT EXISTS idx_clients_search
  ON clients USING GIN(to_tsvector('french', coalesce(full_name, '') || ' ' || coalesce(email, '')));

-- Stock alerts
CREATE INDEX IF NOT EXISTS idx_poudres_stock_bas
  ON poudres(atelier_id)
  WHERE stock_reel_kg < 1;

-- Retouches by project
CREATE INDEX IF NOT EXISTS idx_retouches_projet
  ON retouches(projet_id, status);

-- Audit logs performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_atelier_date
  ON audit_logs(atelier_id, created_at DESC);

-- Series
CREATE INDEX IF NOT EXISTS idx_series_atelier_status
  ON series(atelier_id, status);


-- ── 3. RBAC - POLITIQUES RLS AVEC VERIFICATION DES ROLES ───

-- Helper function: get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user has one of required roles
CREATE OR REPLACE FUNCTION user_has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = ANY(required_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop overly permissive policies and replace with role-based ones

-- Tarifs / Pricing - only owner/admin can modify
DO $$ BEGIN
  DROP POLICY IF EXISTS "tarifs_clients_update_rbac" ON tarifs_clients;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tarifs_clients') THEN
    CREATE POLICY "tarifs_clients_update_rbac" ON tarifs_clients
      FOR UPDATE USING (
        atelier_id = get_user_atelier_id()
        AND user_has_role(ARRAY['owner', 'admin'])
      );
  END IF;
END $$;

-- Grilles tarifaires - only owner/admin can modify
DO $$ BEGIN
  DROP POLICY IF EXISTS "grilles_tarifaires_update_rbac" ON grilles_tarifaires;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grilles_tarifaires') THEN
    CREATE POLICY "grilles_tarifaires_update_rbac" ON grilles_tarifaires
      FOR UPDATE USING (
        atelier_id = get_user_atelier_id()
        AND user_has_role(ARRAY['owner', 'admin'])
      );
  END IF;
END $$;

-- Users management - only owner/admin can modify team
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_update_rbac" ON users;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "users_update_rbac" ON users
  FOR UPDATE USING (
    -- Users can update their own profile
    id = auth.uid()
    OR (
      -- Owner/admin can update team members in same atelier
      atelier_id = get_user_atelier_id()
      AND user_has_role(ARRAY['owner', 'admin'])
    )
  );

-- Factures - compta/owner/admin can create/update, operators read-only
DO $$ BEGIN
  DROP POLICY IF EXISTS "factures_insert_rbac" ON factures;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "factures_insert_rbac" ON factures
  FOR INSERT WITH CHECK (
    atelier_id = get_user_atelier_id()
    AND user_has_role(ARRAY['owner', 'admin', 'compta'])
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "factures_update_rbac" ON factures;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "factures_update_rbac" ON factures
  FOR UPDATE USING (
    atelier_id = get_user_atelier_id()
    AND user_has_role(ARRAY['owner', 'admin', 'compta'])
  );

-- Ateliers settings - only owner can modify
DO $$ BEGIN
  DROP POLICY IF EXISTS "ateliers_update_rbac" ON ateliers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "ateliers_update_rbac" ON ateliers
  FOR UPDATE USING (
    id = get_user_atelier_id()
    AND user_has_role(ARRAY['owner'])
  );


-- ── 4. CONSTRAINTS INTEGRITY ────────────────────────────────

-- Stock ne peut pas etre negatif
DO $$ BEGIN
  ALTER TABLE poudres ADD CONSTRAINT chk_stock_reel_positif
    CHECK (stock_reel_kg >= 0 OR stock_reel_kg IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE poudres ADD CONSTRAINT chk_stock_theorique_positif
    CHECK (stock_theorique_kg >= 0 OR stock_theorique_kg IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Facture total_ttc coherent
DO $$ BEGIN
  ALTER TABLE factures ADD CONSTRAINT chk_facture_totaux_positifs
    CHECK (total_ht >= 0 AND total_ttc >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Devis total coherent
DO $$ BEGIN
  ALTER TABLE devis ADD CONSTRAINT chk_devis_totaux_positifs
    CHECK (total_ht >= 0 AND total_ttc >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Date promise doit etre apres date depot
DO $$ BEGIN
  ALTER TABLE projets ADD CONSTRAINT chk_dates_coherentes
    CHECK (date_promise IS NULL OR date_depot IS NULL OR date_promise >= date_depot);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 5. VUE MATERIALISEE DASHBOARD ──────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_metrics AS
SELECT
  a.id AS atelier_id,
  -- CA du mois courant
  COALESCE(SUM(f.total_ttc) FILTER (
    WHERE f.payment_status = 'paid'
    AND f.paid_at >= date_trunc('month', NOW())
  ), 0) AS ca_mois_courant,
  -- CA du mois precedent
  COALESCE(SUM(f.total_ttc) FILTER (
    WHERE f.payment_status = 'paid'
    AND f.paid_at >= date_trunc('month', NOW()) - interval '1 month'
    AND f.paid_at < date_trunc('month', NOW())
  ), 0) AS ca_mois_precedent,
  -- Factures impayees
  COUNT(f.id) FILTER (WHERE f.payment_status = 'unpaid') AS nb_factures_impayees,
  COALESCE(SUM(f.total_ttc) FILTER (WHERE f.payment_status = 'unpaid'), 0) AS montant_impaye,
  -- Projets
  COUNT(DISTINCT p.id) FILTER (WHERE p.status IN ('en_cours', 'en_cuisson', 'qc')) AS nb_projets_en_cours,
  COUNT(DISTINCT p.id) FILTER (
    WHERE p.status IN ('en_cours', 'en_cuisson', 'qc')
    AND p.date_promise < CURRENT_DATE
    AND p.date_promise IS NOT NULL
  ) AS nb_projets_en_retard,
  -- Devis
  COUNT(DISTINCT d.id) FILTER (WHERE d.status IN ('brouillon', 'envoye')) AS nb_devis_en_attente,
  COUNT(DISTINCT d.id) AS total_devis,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status IN ('accepte', 'converted')) AS devis_convertis,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'refuse') AS devis_refuses,
  NOW() AS last_refreshed
FROM ateliers a
LEFT JOIN factures f ON f.atelier_id = a.id
LEFT JOIN projets p ON p.atelier_id = a.id
LEFT JOIN devis d ON d.atelier_id = a.id
GROUP BY a.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_atelier
  ON mv_dashboard_metrics(atelier_id);

-- Function to refresh dashboard metrics (called by cron)
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics;
END;
$$ LANGUAGE plpgsql;


-- ── 6. TABLE DEVIS_LIGNES (normalisation des items) ────────

CREATE TABLE IF NOT EXISTS devis_lignes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  ordre INT NOT NULL DEFAULT 0,
  designation TEXT NOT NULL,
  description TEXT,
  quantite NUMERIC(10,2) NOT NULL DEFAULT 1,
  unite TEXT DEFAULT 'piece',
  prix_unitaire_ht NUMERIC(10,2) NOT NULL DEFAULT 0,
  tva_rate NUMERIC(5,2) DEFAULT 20.00,
  remise_percent NUMERIC(5,2) DEFAULT 0,
  total_ht NUMERIC(10,2) GENERATED ALWAYS AS (
    quantite * prix_unitaire_ht * (1 - remise_percent / 100)
  ) STORED,
  -- Metadata metier
  poudre_id UUID REFERENCES poudres(id),
  surface_m2 NUMERIC(10,4),
  nb_couches INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devis_lignes_atelier" ON devis_lignes
  FOR ALL USING (atelier_id = get_user_atelier_id());

CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis ON devis_lignes(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_atelier ON devis_lignes(atelier_id);
