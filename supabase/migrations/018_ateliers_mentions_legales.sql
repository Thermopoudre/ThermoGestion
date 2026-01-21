-- Migration 018 : Mentions légales obligatoires pour factures
-- Colonnes ajoutées à la table ateliers pour conformité française

ALTER TABLE public.ateliers
  ADD COLUMN IF NOT EXISTS tva_intra TEXT,           -- N° TVA intracommunautaire (FR + 11 chiffres)
  ADD COLUMN IF NOT EXISTS rcs TEXT,                  -- RCS Ville + numéro (ex: RCS Paris B 123 456 789)
  ADD COLUMN IF NOT EXISTS forme_juridique TEXT,      -- SARL, SAS, EURL, Auto-entrepreneur, etc.
  ADD COLUMN IF NOT EXISTS capital_social TEXT,       -- Ex: "10 000 €"
  ADD COLUMN IF NOT EXISTS iban TEXT,                 -- IBAN pour paiement
  ADD COLUMN IF NOT EXISTS bic TEXT;                  -- Code BIC/SWIFT

-- Commentaires pour documentation
COMMENT ON COLUMN public.ateliers.tva_intra IS 'Numéro TVA intracommunautaire (format FR + 11 chiffres)';
COMMENT ON COLUMN public.ateliers.rcs IS 'RCS Ville + numéro (ex: RCS Paris B 123 456 789)';
COMMENT ON COLUMN public.ateliers.forme_juridique IS 'Forme juridique: SARL, SAS, EURL, EI, Auto-entrepreneur, etc.';
COMMENT ON COLUMN public.ateliers.capital_social IS 'Capital social (ex: 10 000 €)';
COMMENT ON COLUMN public.ateliers.iban IS 'IBAN pour paiement bancaire';
COMMENT ON COLUMN public.ateliers.bic IS 'Code BIC/SWIFT de la banque';
