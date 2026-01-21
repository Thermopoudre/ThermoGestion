-- Migration 012 : Table mouvements de stock
-- Appliquée via MCP le 2026-01-21

CREATE TABLE IF NOT EXISTS public.stock_mouvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  poudre_id UUID NOT NULL REFERENCES public.poudres(id) ON DELETE CASCADE,
  projet_id UUID REFERENCES public.projets(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement', 'inventaire')),
  quantite DECIMAL(10, 3) NOT NULL,
  quantite_avant DECIMAL(10, 3),
  quantite_apres DECIMAL(10, 3),
  motif TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_atelier ON public.stock_mouvements(atelier_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_poudre ON public.stock_mouvements(poudre_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_projet ON public.stock_mouvements(projet_id);

-- RLS pour stock_mouvements
ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage stock movements from their atelier" ON public.stock_mouvements;

CREATE POLICY "Users can manage stock movements from their atelier"
  ON public.stock_mouvements
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );
