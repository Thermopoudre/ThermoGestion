-- Migration 010 : Automatisations ThermoGestion
-- Date : 2026-01-21
-- Description : Préférences client, déclencheurs automatiques factures/projets/stock

-- ============================================
-- 1. PRÉFÉRENCE FACTURATION PAR CLIENT
-- ============================================

-- Ajouter la préférence de déclenchement de facture sur le client
-- 'pret' = Facture envoyée quand projet prêt (défaut)
-- 'livre' = Facture envoyée après récupération/livraison
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS facture_trigger TEXT DEFAULT 'pret' 
    CHECK (facture_trigger IN ('pret', 'livre'));

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN public.clients.facture_trigger IS 
  'Moment d''envoi automatique de la facture: pret = quand projet prêt, livre = après récupération';

-- ============================================
-- 2. LIAISON AUTOMATIQUE DEVIS → PROJET
-- ============================================

-- Ajouter un flag pour savoir si le projet a été créé automatiquement
ALTER TABLE public.projets
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;

-- ============================================
-- 3. STOCK POUDRE - HISTORIQUE MOUVEMENTS
-- ============================================

-- Table pour tracer tous les mouvements de stock
CREATE TABLE IF NOT EXISTS public.stock_mouvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  poudre_id UUID NOT NULL REFERENCES public.poudres(id) ON DELETE CASCADE,
  projet_id UUID REFERENCES public.projets(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement', 'inventaire')),
  quantite DECIMAL(10, 3) NOT NULL, -- Positif pour entrée, négatif pour sortie
  quantite_avant DECIMAL(10, 3),
  quantite_apres DECIMAL(10, 3),
  motif TEXT, -- 'cuisson_projet', 'achat', 'ajustement_inventaire', etc.
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_atelier ON public.stock_mouvements(atelier_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_poudre ON public.stock_mouvements(poudre_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_projet ON public.stock_mouvements(projet_id);

-- RLS pour stock_mouvements
ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage stock movements from their atelier"
  ON public.stock_mouvements
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ============================================
-- 4. FACTURES AUTO - LIAISON PROJET
-- ============================================

-- Ajouter un flag pour savoir si la facture a été créée automatiquement
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;

-- ============================================
-- 5. WORKFLOW SYNCHRONISÉ
-- ============================================

-- Mapping workflow → statut (pour synchronisation)
-- Étape 0 (Préparation) → en_cours
-- Étape 1 (Application poudre) → en_cours
-- Étape 2 (Cuisson) → en_cuisson
-- Étape 3 (Contrôle qualité) → qc
-- Étape 4 (Prêt) → pret

-- Ce mapping sera géré côté application, pas en BDD

-- ============================================
-- 6. NOTIFICATIONS CONFIG
-- ============================================

-- S'assurer que la table push_subscriptions existe
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- RLS pour push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (user_id = auth.uid());
