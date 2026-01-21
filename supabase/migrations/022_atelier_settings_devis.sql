-- Migration: Paramètres atelier pour devis + rendement poudre
-- Date: 2026-01-21

-- Ajouter les paramètres de calcul devis dans les settings de l'atelier
-- Les settings sont stockés en JSONB dans la colonne 'settings' de la table ateliers

-- Ajouter le rendement (m²/kg) aux poudres - plus intuitif que consommation
ALTER TABLE poudres ADD COLUMN IF NOT EXISTS rendement_m2_kg DECIMAL(10, 2);

-- Mettre à jour le rendement à partir de la consommation existante si disponible
-- rendement = 1 / consommation (si consommation = 0.15 kg/m², rendement = 6.67 m²/kg)
UPDATE poudres 
SET rendement_m2_kg = CASE 
  WHEN consommation_m2 > 0 THEN ROUND(1.0 / consommation_m2, 2)
  ELSE 6.67 -- valeur par défaut ~0.15 kg/m²
END
WHERE rendement_m2_kg IS NULL;

-- Commentaires
COMMENT ON COLUMN poudres.rendement_m2_kg IS 'Surface couverte par kg de poudre (m²/kg)';
COMMENT ON COLUMN poudres.consommation_m2 IS 'Consommation en kg par m² (calculé: 1/rendement)';
