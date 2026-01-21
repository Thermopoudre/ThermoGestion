-- Migration 011 : Ajout des colonnes manquantes pour les automatisations
-- Appliquée via MCP le 2026-01-21

-- 1. Colonnes factures
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acompte_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS format_numero TEXT DEFAULT 'FACT-YYYY-NNNN',
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;

-- 2. Colonne clients pour préférence facturation
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS facture_trigger TEXT DEFAULT 'pret';

-- 3. Colonne projets pour flag auto-création
ALTER TABLE public.projets
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;

-- 4. Colonnes ateliers pour numérotation
ALTER TABLE public.ateliers
  ADD COLUMN IF NOT EXISTS facture_numero_format TEXT DEFAULT 'FACT-YYYY-NNNN',
  ADD COLUMN IF NOT EXISTS facture_numero_counter INTEGER DEFAULT 0;
