-- Migration: Colonnes de rentabilité pour les devis
-- Date: 2026-01-21

-- Ajouter les colonnes pour le calcul de rentabilité des devis
ALTER TABLE devis ADD COLUMN IF NOT EXISTS total_revient DECIMAL(10, 2);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS marge_pct DECIMAL(5, 2);
ALTER TABLE devis ADD COLUMN IF NOT EXISTS remise JSONB;

-- Commentaires
COMMENT ON COLUMN devis.total_revient IS 'Coût de revient total (poudre + MO + consommables)';
COMMENT ON COLUMN devis.marge_pct IS 'Pourcentage de marge brute';
COMMENT ON COLUMN devis.remise IS 'Remise appliquée {type: pourcentage|montant, valeur: number}';
