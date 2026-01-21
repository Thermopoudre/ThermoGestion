-- Migration: Alertes stock bas
-- Date: 2026-01-21

-- Ajouter seuil d'alerte aux stocks de poudre
ALTER TABLE stock_poudres ADD COLUMN IF NOT EXISTS seuil_alerte_kg DECIMAL(10, 2) DEFAULT 5.00;
ALTER TABLE stock_poudres ADD COLUMN IF NOT EXISTS alerte_active BOOLEAN DEFAULT true;
ALTER TABLE stock_poudres ADD COLUMN IF NOT EXISTS derniere_alerte_at TIMESTAMP WITH TIME ZONE;

-- Table des alertes/notifications
CREATE TABLE IF NOT EXISTS alertes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'stock_bas', 'devis_expiration', 'facture_impayee', etc.
  titre VARCHAR(255) NOT NULL,
  message TEXT,
  lien VARCHAR(500), -- Lien vers la ressource concernée
  lu BOOLEAN DEFAULT false,
  lu_at TIMESTAMP WITH TIME ZONE,
  lu_par UUID REFERENCES users(id),
  data JSONB, -- Données supplémentaires (poudre_id, devis_id, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_alertes_atelier ON alertes(atelier_id);
CREATE INDEX IF NOT EXISTS idx_alertes_non_lues ON alertes(atelier_id, lu) WHERE lu = false;
CREATE INDEX IF NOT EXISTS idx_alertes_type ON alertes(type);

-- RLS
ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;

-- Politique: les utilisateurs peuvent voir les alertes de leur atelier
DROP POLICY IF EXISTS "Users can view their atelier alerts" ON alertes;
CREATE POLICY "Users can view their atelier alerts" ON alertes
  FOR SELECT
  USING (
    atelier_id IN (SELECT atelier_id FROM users WHERE id = auth.uid())
  );

-- Politique: les utilisateurs peuvent marquer les alertes comme lues
DROP POLICY IF EXISTS "Users can update their atelier alerts" ON alertes;
CREATE POLICY "Users can update their atelier alerts" ON alertes
  FOR UPDATE
  USING (
    atelier_id IN (SELECT atelier_id FROM users WHERE id = auth.uid())
  );

-- Fonction pour vérifier les stocks bas et créer des alertes
CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS void AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Parcourir les stocks en dessous du seuil qui n'ont pas eu d'alerte récente (24h)
  FOR rec IN
    SELECT 
      sp.id as stock_id,
      sp.atelier_id,
      sp.poudre_id,
      sp.stock_reel_kg,
      sp.seuil_alerte_kg,
      sp.derniere_alerte_at,
      p.marque,
      p.reference,
      p.ral
    FROM stock_poudres sp
    JOIN poudres p ON p.id = sp.poudre_id
    WHERE sp.alerte_active = true
      AND sp.stock_reel_kg < sp.seuil_alerte_kg
      AND (sp.derniere_alerte_at IS NULL OR sp.derniere_alerte_at < NOW() - INTERVAL '24 hours')
  LOOP
    -- Créer l'alerte
    INSERT INTO alertes (atelier_id, type, titre, message, lien, data)
    VALUES (
      rec.atelier_id,
      'stock_bas',
      'Stock bas: ' || rec.marque || ' ' || rec.reference,
      'Le stock de ' || rec.marque || ' ' || rec.reference || 
        COALESCE(' (RAL ' || rec.ral || ')', '') ||
        ' est à ' || ROUND(rec.stock_reel_kg::numeric, 2) || ' kg (seuil: ' || rec.seuil_alerte_kg || ' kg)',
      '/app/poudres/' || rec.poudre_id || '/stock',
      jsonb_build_object('poudre_id', rec.poudre_id, 'stock_actuel', rec.stock_reel_kg, 'seuil', rec.seuil_alerte_kg)
    );
    
    -- Mettre à jour la date de dernière alerte
    UPDATE stock_poudres SET derniere_alerte_at = NOW() WHERE id = rec.stock_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE alertes IS 'Notifications et alertes pour les utilisateurs';
COMMENT ON COLUMN stock_poudres.seuil_alerte_kg IS 'Seuil en kg en dessous duquel une alerte est générée';
COMMENT ON COLUMN stock_poudres.alerte_active IS 'Si les alertes sont activées pour ce stock';
