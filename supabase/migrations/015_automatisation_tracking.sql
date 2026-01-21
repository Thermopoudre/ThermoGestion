-- Migration 015 : Colonnes de traçabilité des automatisations
-- Appliquée via MCP le 2026-01-21

-- Colonnes sur projets pour tracker les automatisations exécutées
ALTER TABLE public.projets
  ADD COLUMN IF NOT EXISTS auto_facture_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_stock_decremented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poudre_quantite_kg DECIMAL(10, 3);

-- Colonnes sur devis pour tracker la conversion
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS auto_projet_created_at TIMESTAMPTZ;

-- Vérifier que la contrainte CHECK sur facture_trigger est correcte
DO $$
BEGIN
  ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_facture_trigger_check;
  ALTER TABLE public.clients ADD CONSTRAINT clients_facture_trigger_check 
    CHECK (facture_trigger IN ('pret', 'livre', 'manuel'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Mettre à jour les clients existants avec la valeur par défaut
UPDATE public.clients 
SET facture_trigger = 'pret' 
WHERE facture_trigger IS NULL;
