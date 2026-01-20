-- Migration 006 : Portail client final
-- Authentification séparée pour les clients finaux (pas les ateliers)

-- Table pour les comptes clients (extension de auth.users)
CREATE TABLE IF NOT EXISTS public.client_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id) -- Un seul compte par client
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_client_users_client ON public.client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_atelier ON public.client_users(atelier_id);
CREATE INDEX IF NOT EXISTS idx_client_users_email ON public.client_users(email);

-- RLS Policies pour client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Policy: Les clients peuvent voir leur propre compte
CREATE POLICY "Clients can view their own account"
  ON public.client_users
  FOR SELECT
  USING (id = auth.uid());

-- Policy: Les clients peuvent mettre à jour leur propre compte
CREATE POLICY "Clients can update their own account"
  ON public.client_users
  FOR UPDATE
  USING (id = auth.uid());

-- Policy: Les utilisateurs atelier peuvent voir les comptes clients de leur atelier
CREATE POLICY "Atelier users can view client accounts from their atelier"
  ON public.client_users
  FOR SELECT
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_client_users_updated_at
  BEFORE UPDATE ON public.client_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table pour les confirmations de récupération/livraison
CREATE TABLE IF NOT EXISTS public.client_confirmations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES public.client_users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('recuperation', 'livraison')),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmation_code TEXT, -- Code de confirmation optionnel
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_client_confirmations_projet ON public.client_confirmations(projet_id);
CREATE INDEX IF NOT EXISTS idx_client_confirmations_client ON public.client_confirmations(client_user_id);

-- RLS Policies pour client_confirmations
ALTER TABLE public.client_confirmations ENABLE ROW LEVEL SECURITY;

-- Policy: Les clients peuvent voir leurs confirmations
CREATE POLICY "Clients can view their confirmations"
  ON public.client_confirmations
  FOR SELECT
  USING (
    client_user_id = auth.uid()
    OR projet_id IN (
      SELECT id FROM public.projets
      WHERE client_id IN (
        SELECT client_id FROM public.client_users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Les clients peuvent créer leurs confirmations
CREATE POLICY "Clients can create their confirmations"
  ON public.client_confirmations
  FOR INSERT
  WITH CHECK (
    projet_id IN (
      SELECT id FROM public.projets
      WHERE client_id IN (
        SELECT client_id FROM public.client_users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Les utilisateurs atelier peuvent voir toutes les confirmations de leur atelier
CREATE POLICY "Atelier users can view confirmations from their atelier"
  ON public.client_confirmations
  FOR SELECT
  USING (
    projet_id IN (
      SELECT id FROM public.projets
      WHERE atelier_id IN (
        SELECT atelier_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Fonction helper pour vérifier si un client a un compte portail
CREATE OR REPLACE FUNCTION client_has_portal_account(p_client_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_users WHERE client_id = p_client_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE public.client_users IS 'Comptes clients pour accès portail (authentification séparée des ateliers)';
COMMENT ON TABLE public.client_confirmations IS 'Confirmations de récupération/livraison par les clients';
