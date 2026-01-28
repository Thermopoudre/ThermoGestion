-- ============================================
-- Migration 030: Advanced Features
-- - Demandes de devis clients
-- - Analyse rentabilité projets
-- - Relances automatiques
-- - Contrats clients
-- - Certificats conformité
-- - Planning capacitaire
-- - Dashboard personnalisable
-- ============================================

-- =====================
-- 1. DEMANDES DE DEVIS (Portail Client)
-- =====================
CREATE TABLE IF NOT EXISTS public.demandes_devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  type_pieces TEXT,
  quantite INTEGER,
  couleur_souhaitee TEXT,
  finition TEXT DEFAULT 'mat',
  urgence TEXT DEFAULT 'normal', -- normal, urgent, tres_urgent
  date_souhaitee DATE,
  notes TEXT,
  status TEXT DEFAULT 'nouvelle', -- nouvelle, en_cours, devis_envoye, refuse
  devis_id UUID REFERENCES public.devis(id),
  traite_par UUID REFERENCES public.users(id),
  traite_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demandes_devis_atelier ON public.demandes_devis(atelier_id);
CREATE INDEX IF NOT EXISTS idx_demandes_devis_client ON public.demandes_devis(client_id);
CREATE INDEX IF NOT EXISTS idx_demandes_devis_status ON public.demandes_devis(status);

-- =====================
-- 2. ANALYSE RENTABILITE
-- =====================
-- Coûts réels par projet
CREATE TABLE IF NOT EXISTS public.couts_projet (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  type_cout TEXT NOT NULL, -- poudre, main_oeuvre, energie, preparation, transport, autre
  description TEXT,
  quantite DECIMAL(10, 3),
  unite TEXT, -- kg, h, kWh, forfait
  cout_unitaire DECIMAL(10, 2),
  cout_total DECIMAL(10, 2) NOT NULL,
  date_cout DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_couts_projet_projet ON public.couts_projet(projet_id);

-- Vue analyse rentabilité
CREATE OR REPLACE VIEW public.v_rentabilite_projets AS
SELECT 
  p.id AS projet_id,
  p.numero,
  p.name,
  p.atelier_id,
  p.client_id,
  c.full_name AS client_name,
  p.status,
  p.created_at,
  d.total_ht AS montant_devis_ht,
  d.total_ttc AS montant_devis_ttc,
  COALESCE(SUM(cp.cout_total), 0) AS cout_reel_total,
  COALESCE(d.total_ht, 0) - COALESCE(SUM(cp.cout_total), 0) AS marge_brute,
  CASE 
    WHEN COALESCE(d.total_ht, 0) > 0 
    THEN ((COALESCE(d.total_ht, 0) - COALESCE(SUM(cp.cout_total), 0)) / d.total_ht * 100)
    ELSE 0 
  END AS marge_pourcent
FROM public.projets p
LEFT JOIN public.devis d ON p.devis_id = d.id
LEFT JOIN public.clients c ON p.client_id = c.id
LEFT JOIN public.couts_projet cp ON p.id = cp.projet_id
GROUP BY p.id, p.numero, p.name, p.atelier_id, p.client_id, c.full_name, p.status, p.created_at, d.total_ht, d.total_ttc;

-- =====================
-- 3. RELANCES AUTOMATIQUES
-- =====================
CREATE TABLE IF NOT EXISTS public.relances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  type_relance TEXT NOT NULL, -- facture_impayee, devis_non_signe, projet_pret
  reference_id UUID NOT NULL, -- ID de la facture, devis ou projet
  reference_type TEXT NOT NULL, -- facture, devis, projet
  client_id UUID NOT NULL REFERENCES public.clients(id),
  niveau INTEGER DEFAULT 1, -- 1, 2, 3 (escalade)
  date_relance TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  canal TEXT DEFAULT 'email', -- email, sms, courrier
  contenu TEXT,
  statut TEXT DEFAULT 'envoyee', -- planifiee, envoyee, repondue, ignoree
  reponse TEXT,
  repondu_at TIMESTAMP WITH TIME ZONE,
  prochaine_relance DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relances_atelier ON public.relances(atelier_id);
CREATE INDEX IF NOT EXISTS idx_relances_reference ON public.relances(reference_id, reference_type);

-- Configuration des relances automatiques
CREATE TABLE IF NOT EXISTS public.config_relances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  type_relance TEXT NOT NULL, -- facture_impayee, devis_non_signe
  actif BOOLEAN DEFAULT true,
  delai_j1 INTEGER DEFAULT 7, -- Jours avant première relance
  delai_j2 INTEGER DEFAULT 15, -- Jours avant deuxième relance
  delai_j3 INTEGER DEFAULT 30, -- Jours avant troisième relance
  canal_j1 TEXT DEFAULT 'email',
  canal_j2 TEXT DEFAULT 'email',
  canal_j3 TEXT DEFAULT 'email,sms',
  template_email TEXT,
  template_sms TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(atelier_id, type_relance)
);

-- =====================
-- 4. CONTRATS CLIENTS / GRILLES TARIFAIRES
-- =====================
CREATE TABLE IF NOT EXISTS public.contrats_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  numero TEXT,
  date_debut DATE NOT NULL,
  date_fin DATE,
  remise_globale_pourcent DECIMAL(5, 2) DEFAULT 0,
  conditions_paiement TEXT,
  delai_paiement_jours INTEGER DEFAULT 30,
  volume_engagement_m2 DECIMAL(10, 2), -- m² par an engagés
  prix_m2_negocie DECIMAL(10, 2),
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(atelier_id, client_id)
);

-- Tarifs spécifiques par prestation pour un client
CREATE TABLE IF NOT EXISTS public.tarifs_client (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contrat_id UUID NOT NULL REFERENCES public.contrats_clients(id) ON DELETE CASCADE,
  prestation_id UUID REFERENCES public.prestations(id),
  description TEXT,
  prix_unitaire_ht DECIMAL(10, 2) NOT NULL,
  remise_pourcent DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- 5. CERTIFICATS DE CONFORMITE
-- =====================
CREATE TABLE IF NOT EXISTS public.certificats_conformite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  date_emission DATE DEFAULT CURRENT_DATE,
  -- Infos poudre
  poudre_reference TEXT,
  poudre_lot TEXT,
  poudre_fabricant TEXT,
  -- Paramètres cuisson
  temperature_cuisson INTEGER,
  duree_cuisson INTEGER,
  date_cuisson TIMESTAMP WITH TIME ZONE,
  -- Résultats contrôle
  epaisseur_mesuree_um INTEGER, -- Micromètres
  adherence_conforme BOOLEAN DEFAULT true,
  aspect_conforme BOOLEAN DEFAULT true,
  couleur_conforme BOOLEAN DEFAULT true,
  brillance_conforme BOOLEAN DEFAULT true,
  -- Certification
  norme_reference TEXT, -- ISO, QUALICOAT, etc.
  observations TEXT,
  controleur_nom TEXT,
  controleur_signature TEXT,
  -- PDF
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificats_projet ON public.certificats_conformite(projet_id);

-- =====================
-- 6. PLANNING CAPACITAIRE
-- =====================
-- Capacité quotidienne de l'atelier
ALTER TABLE public.ateliers 
  ADD COLUMN IF NOT EXISTS capacite_m2_jour DECIMAL(10, 2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS nb_fours INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nb_cabines INTEGER DEFAULT 1;

-- Vue charge de travail
CREATE OR REPLACE VIEW public.v_charge_travail AS
SELECT 
  p.atelier_id,
  DATE(COALESCE(p.date_promise, p.created_at + INTERVAL '7 days')) AS date_prevue,
  COUNT(*) AS nb_projets,
  COALESCE(SUM(p.surface_m2), COUNT(*) * 5) AS surface_totale_m2
FROM public.projets p
WHERE p.status IN ('devis', 'en_cours', 'en_cuisson', 'qc')
GROUP BY p.atelier_id, DATE(COALESCE(p.date_promise, p.created_at + INTERVAL '7 days'));

-- =====================
-- 7. DASHBOARD PERSONNALISABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- kpi, chart, list, calendar, etc.
  widget_config JSONB DEFAULT '{}',
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1,
  height INTEGER DEFAULT 1,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON public.dashboard_widgets(user_id);

-- =====================
-- 8. EXPORTS COMPTABLES
-- =====================
CREATE TABLE IF NOT EXISTS public.exports_comptables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  type_export TEXT NOT NULL, -- fec, csv, quickbooks, sage
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nb_ecritures INTEGER,
  fichier_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- RLS POLICIES
-- =====================

-- Demandes de devis
ALTER TABLE public.demandes_devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demandes_devis_select_policy" ON public.demandes_devis
  FOR SELECT USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
    OR client_id IN (SELECT client_id FROM public.client_users WHERE id = auth.uid())
  );

CREATE POLICY "demandes_devis_insert_policy" ON public.demandes_devis
  FOR INSERT WITH CHECK (
    client_id IN (SELECT client_id FROM public.client_users WHERE id = auth.uid())
  );

-- Coûts projet
ALTER TABLE public.couts_projet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couts_projet_policy" ON public.couts_projet
  FOR ALL USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- Relances
ALTER TABLE public.relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relances_policy" ON public.relances
  FOR ALL USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- Config relances
ALTER TABLE public.config_relances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_relances_policy" ON public.config_relances
  FOR ALL USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- Contrats clients
ALTER TABLE public.contrats_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contrats_clients_policy" ON public.contrats_clients
  FOR ALL USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- Tarifs client
ALTER TABLE public.tarifs_client ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarifs_client_policy" ON public.tarifs_client
  FOR ALL USING (
    contrat_id IN (
      SELECT id FROM public.contrats_clients 
      WHERE atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Certificats conformité
ALTER TABLE public.certificats_conformite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificats_conformite_policy" ON public.certificats_conformite
  FOR ALL USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- Dashboard widgets
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_widgets_policy" ON public.dashboard_widgets
  FOR ALL USING (user_id = auth.uid());

-- Exports comptables
ALTER TABLE public.exports_comptables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exports_comptables_policy" ON public.exports_comptables
  FOR ALL USING (
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- =====================
-- TRIGGERS
-- =====================

-- Trigger updated_at pour toutes les nouvelles tables
CREATE TRIGGER update_demandes_devis_updated_at BEFORE UPDATE ON public.demandes_devis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_relances_updated_at BEFORE UPDATE ON public.config_relances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contrats_clients_updated_at BEFORE UPDATE ON public.contrats_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
