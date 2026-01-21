-- Migration 013 : Fonction génération numéro facture
-- Appliquée via MCP le 2026-01-21

CREATE OR REPLACE FUNCTION generate_facture_numero(p_atelier_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_format TEXT;
  v_counter INTEGER;
  v_year TEXT;
  v_numero TEXT;
BEGIN
  SELECT facture_numero_format, facture_numero_counter
  INTO v_format, v_counter
  FROM public.ateliers
  WHERE id = p_atelier_id;

  IF v_format IS NULL THEN
    v_format := 'FACT-YYYY-NNNN';
  END IF;

  IF v_counter IS NULL THEN
    v_counter := 0;
  END IF;

  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_counter := v_counter + 1;

  v_numero := REPLACE(v_format, 'YYYY', v_year);
  v_numero := REPLACE(v_numero, 'NNNN', LPAD(v_counter::TEXT, 4, '0'));
  v_numero := REPLACE(v_numero, 'NNN', LPAD(v_counter::TEXT, 3, '0'));
  v_numero := REPLACE(v_numero, 'NN', LPAD(v_counter::TEXT, 2, '0'));

  UPDATE public.ateliers
  SET facture_numero_counter = v_counter
  WHERE id = p_atelier_id;

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table pour les paiements
CREATE TABLE IF NOT EXISTS public.paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('acompte', 'solde', 'complete')),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'gocardless', 'cash', 'check', 'transfer', 'other')),
  payment_ref TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paiements_atelier ON public.paiements(atelier_id);
CREATE INDEX IF NOT EXISTS idx_paiements_facture ON public.paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_client ON public.paiements(client_id);

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage payments from their atelier" ON public.paiements;

CREATE POLICY "Users can manage payments from their atelier"
  ON public.paiements
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );
