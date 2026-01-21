-- Migration: Relances automatiques devis
-- Date: 2026-01-21

-- Ajouter les champs de relance aux devis
ALTER TABLE devis ADD COLUMN IF NOT EXISTS relance_count INTEGER DEFAULT 0;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS derniere_relance_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS relance_desactivee BOOLEAN DEFAULT false;

-- Ajouter les paramètres de relance dans les settings atelier
-- Ces paramètres seront stockés dans settings.devis_relance

-- Commentaires
COMMENT ON COLUMN devis.relance_count IS 'Nombre de relances envoyées';
COMMENT ON COLUMN devis.derniere_relance_at IS 'Date de la dernière relance';
COMMENT ON COLUMN devis.relance_desactivee IS 'Désactiver les relances pour ce devis';
