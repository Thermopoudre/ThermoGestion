-- Migration: Ajout du prix au kg pour chaque poudre
-- Date: 2026-01-21

-- Ajouter la colonne prix_kg à la table poudres
ALTER TABLE poudres ADD COLUMN IF NOT EXISTS prix_kg DECIMAL(10, 2) DEFAULT 25.00;

-- Commentaire explicatif
COMMENT ON COLUMN poudres.prix_kg IS 'Prix de la poudre en euros par kilogramme';
