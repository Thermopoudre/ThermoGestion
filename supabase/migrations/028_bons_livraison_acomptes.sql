-- Migration 028 : Bons de livraison et amélioration système acomptes
-- Ajoute la gestion des BL et améliore le suivi acompte/solde

-- =====================================================
-- 1. Table des Bons de Livraison
-- =====================================================

CREATE TABLE IF NOT EXISTS public.bons_livraison (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  numero TEXT NOT NULL, -- BL-2026-0001
  
  -- Informations livraison
  date_livraison DATE NOT NULL DEFAULT CURRENT_DATE,
  adresse_livraison TEXT, -- Si différente de l'adresse client
  transporteur TEXT, -- Nom du transporteur ou "Retrait sur place"
  
  -- Contenu du BL
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Pièces livrées
  
  -- Observations
  observations TEXT,
  etat_pieces TEXT DEFAULT 'conforme' CHECK (etat_pieces IN ('conforme', 'reserve', 'non_conforme')),
  reserves TEXT, -- Détails des réserves si applicable
  
  -- Signatures
  signe_par_client BOOLEAN DEFAULT false,
  signature_client TEXT, -- Nom du signataire client
  signature_client_data TEXT, -- Données signature canvas
  signed_at TIMESTAMPTZ,
  
  -- PDF
  pdf_url TEXT,
  
  -- Métadonnées
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bons_livraison_atelier ON public.bons_livraison(atelier_id);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_projet ON public.bons_livraison(projet_id);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_client ON public.bons_livraison(client_id);
CREATE INDEX IF NOT EXISTS idx_bons_livraison_date ON public.bons_livraison(date_livraison);

-- RLS
ALTER TABLE public.bons_livraison ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage BL from their atelier"
  ON public.bons_livraison
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_bons_livraison_updated_at
  BEFORE UPDATE ON public.bons_livraison
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. Amélioration du suivi Acompte/Solde sur Projets
-- =====================================================

-- Ajouter colonnes de suivi financier sur projets
ALTER TABLE public.projets
  ADD COLUMN IF NOT EXISTS montant_total DECIMAL(10, 2), -- Montant total du projet (from devis)
  ADD COLUMN IF NOT EXISTS montant_acompte DECIMAL(10, 2) DEFAULT 0, -- Total acomptes versés
  ADD COLUMN IF NOT EXISTS montant_facture DECIMAL(10, 2) DEFAULT 0, -- Total facturé
  ADD COLUMN IF NOT EXISTS montant_paye DECIMAL(10, 2) DEFAULT 0, -- Total payé
  ADD COLUMN IF NOT EXISTS facture_acompte_id UUID REFERENCES public.factures(id), -- Ref facture acompte
  ADD COLUMN IF NOT EXISTS facture_solde_id UUID REFERENCES public.factures(id), -- Ref facture solde
  ADD COLUMN IF NOT EXISTS bl_id UUID REFERENCES public.bons_livraison(id); -- Ref bon de livraison

-- Ajouter ref devis sur facture pour traçabilité
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS devis_id UUID REFERENCES public.devis(id),
  ADD COLUMN IF NOT EXISTS devis_numero TEXT, -- Numéro devis pour affichage
  ADD COLUMN IF NOT EXISTS pourcentage_acompte DECIMAL(5, 2); -- % acompte (ex: 30.00)

-- =====================================================
-- 3. Fonction génération numéro BL
-- =====================================================

-- Ajouter compteur BL sur ateliers
ALTER TABLE public.ateliers
  ADD COLUMN IF NOT EXISTS bl_numero_format TEXT DEFAULT 'BL-YYYY-NNNN',
  ADD COLUMN IF NOT EXISTS bl_numero_counter INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION generate_bl_numero(p_atelier_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_format TEXT;
  v_counter INTEGER;
  v_year TEXT;
  v_numero TEXT;
BEGIN
  SELECT bl_numero_format, bl_numero_counter
  INTO v_format, v_counter
  FROM public.ateliers
  WHERE id = p_atelier_id;

  IF v_format IS NULL THEN
    v_format := 'BL-YYYY-NNNN';
  END IF;

  IF v_counter IS NULL THEN
    v_counter := 0;
  END IF;

  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_counter := v_counter + 1;

  v_numero := REPLACE(v_format, 'YYYY', v_year);
  v_numero := REPLACE(v_numero, 'NNNN', LPAD(v_counter::TEXT, 4, '0'));
  v_numero := REPLACE(v_numero, 'NNN', LPAD(v_counter::TEXT, 3, '0'));

  UPDATE public.ateliers
  SET bl_numero_counter = v_counter
  WHERE id = p_atelier_id;

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. Stats de conversion devis (vue matérialisée pour performance)
-- =====================================================

CREATE OR REPLACE VIEW public.v_devis_stats AS
SELECT 
  d.atelier_id,
  COUNT(*) as total_devis,
  COUNT(*) FILTER (WHERE d.status IN ('accepte', 'converted')) as devis_acceptes,
  COUNT(*) FILTER (WHERE d.status = 'refuse') as devis_refuses,
  COUNT(*) FILTER (WHERE d.status = 'expire') as devis_expires,
  COUNT(*) FILTER (WHERE d.status = 'envoye') as devis_en_attente,
  ROUND(
    COUNT(*) FILTER (WHERE d.status IN ('accepte', 'converted'))::DECIMAL / NULLIF(COUNT(*), 0) * 100,
    2
  ) as taux_conversion,
  ROUND(
    AVG(EXTRACT(DAY FROM (d.signed_at - d.created_at))) FILTER (WHERE d.signed_at IS NOT NULL),
    1
  ) as delai_moyen_signature_jours,
  SUM(d.total_ht) as montant_total_ht,
  SUM(d.total_ht) FILTER (WHERE d.status IN ('accepte', 'converted')) as montant_accepte_ht,
  EXTRACT(YEAR FROM d.created_at) as annee,
  EXTRACT(MONTH FROM d.created_at) as mois
FROM public.devis d
GROUP BY d.atelier_id, EXTRACT(YEAR FROM d.created_at), EXTRACT(MONTH FROM d.created_at);

-- Commentaires
COMMENT ON TABLE public.bons_livraison IS 'Bons de livraison pour les projets terminés';
COMMENT ON VIEW public.v_devis_stats IS 'Statistiques de conversion des devis par atelier et période';
