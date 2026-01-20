-- Migration 007 : Améliorations facturation
-- Ajout numérotation automatique, format paramétrable, paiements Stripe

-- Ajouter colonnes manquantes pour facturation complète
ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb, -- Items facturés (détails)
  ADD COLUMN IF NOT EXISTS acompte_amount DECIMAL(10, 2), -- Montant acompte si type = 'solde'
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT, -- ID lien paiement Stripe
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT, -- ID paiement Stripe
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')), -- Statut paiement détaillé
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ, -- Date signature électronique
  ADD COLUMN IF NOT EXISTS signature_url TEXT, -- URL signature électronique
  ADD COLUMN IF NOT EXISTS notes TEXT, -- Notes facture
  ADD COLUMN IF NOT EXISTS due_date DATE, -- Date d'échéance
  ADD COLUMN IF NOT EXISTS format_numero TEXT DEFAULT 'FACT-YYYY-NNNN'; -- Format numérotation (paramétrable)

-- Table pour stocker la configuration de numérotation par atelier
ALTER TABLE public.ateliers
  ADD COLUMN IF NOT EXISTS facture_numero_format TEXT DEFAULT 'FACT-YYYY-NNNN', -- Format numérotation factures
  ADD COLUMN IF NOT EXISTS facture_numero_counter INTEGER DEFAULT 0; -- Compteur factures (reset annuel)

-- Table pour les paiements (traçabilité complète)
CREATE TABLE IF NOT EXISTS public.paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('acompte', 'solde', 'complete')),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'gocardless', 'cash', 'check', 'transfer', 'other')),
  payment_ref TEXT, -- Référence paiement (numéro chèque, virement, etc.)
  stripe_payment_intent_id TEXT, -- ID Stripe si paiement Stripe
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_paiements_atelier ON public.paiements(atelier_id);
CREATE INDEX IF NOT EXISTS idx_paiements_facture ON public.paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_client ON public.paiements(client_id);
CREATE INDEX IF NOT EXISTS idx_paiements_status ON public.paiements(status);

-- RLS Policies pour paiements
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payments from their atelier"
  ON public.paiements
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_paiements_updated_at
  BEFORE UPDATE ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour générer le numéro de facture automatique
CREATE OR REPLACE FUNCTION generate_facture_numero(p_atelier_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_format TEXT;
  v_counter INTEGER;
  v_year TEXT;
  v_numero TEXT;
BEGIN
  -- Récupérer le format et le compteur de l'atelier
  SELECT facture_numero_format, facture_numero_counter
  INTO v_format, v_counter
  FROM public.ateliers
  WHERE id = p_atelier_id;

  -- Si pas de format, utiliser le défaut
  IF v_format IS NULL THEN
    v_format := 'FACT-YYYY-NNNN';
  END IF;

  -- Si pas de compteur, initialiser à 0
  IF v_counter IS NULL THEN
    v_counter := 0;
  END IF;

  -- Récupérer l'année courante
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Incrémenter le compteur
  v_counter := v_counter + 1;

  -- Générer le numéro selon le format
  v_numero := REPLACE(v_format, 'YYYY', v_year);
  v_numero := REPLACE(v_numero, 'NNNN', LPAD(v_counter::TEXT, 4, '0'));
  v_numero := REPLACE(v_numero, 'NNN', LPAD(v_counter::TEXT, 3, '0'));
  v_numero := REPLACE(v_numero, 'NN', LPAD(v_counter::TEXT, 2, '0'));

  -- Mettre à jour le compteur de l'atelier
  UPDATE public.ateliers
  SET facture_numero_counter = v_counter
  WHERE id = p_atelier_id;

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réinitialiser le compteur annuel (à appeler via cron ou manuellement)
CREATE OR REPLACE FUNCTION reset_facture_counter_annual()
RETURNS void AS $$
BEGIN
  UPDATE public.ateliers
  SET facture_numero_counter = 0
  WHERE EXTRACT(YEAR FROM CURRENT_DATE) > EXTRACT(YEAR FROM updated_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE public.paiements IS 'Traçabilité complète des paiements (acompte, solde, complet)';
COMMENT ON FUNCTION generate_facture_numero IS 'Génère un numéro de facture automatique selon le format de l''atelier';
