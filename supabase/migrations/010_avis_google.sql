-- Migration 010 : Avis Google (workflow J+3)
-- Système de demande d'avis Google My Business après récupération projet

-- Table pour les demandes d'avis
CREATE TABLE IF NOT EXISTS public.avis_google (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email_sent_at TIMESTAMPTZ, -- Date envoi email demande avis
  email_relance_sent_at TIMESTAMPTZ, -- Date envoi email relance
  avis_received_at TIMESTAMPTZ, -- Date réception avis (via API Google)
  avis_rating INTEGER CHECK (avis_rating >= 1 AND avis_rating <= 5), -- Note 1-5 étoiles
  avis_text TEXT, -- Texte de l'avis
  avis_url TEXT, -- URL de l'avis sur Google
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'email_sent', 'relance_sent', 'avis_received', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_avis_google_atelier ON public.avis_google(atelier_id);
CREATE INDEX IF NOT EXISTS idx_avis_google_projet ON public.avis_google(projet_id);
CREATE INDEX IF NOT EXISTS idx_avis_google_client ON public.avis_google(client_id);
CREATE INDEX IF NOT EXISTS idx_avis_google_status ON public.avis_google(status);
CREATE INDEX IF NOT EXISTS idx_avis_google_created ON public.avis_google(created_at);

-- RLS Policies pour avis_google
ALTER TABLE public.avis_google ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage avis from their atelier"
  ON public.avis_google
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Table pour la configuration avis par atelier
ALTER TABLE public.ateliers
  ADD COLUMN IF NOT EXISTS avis_google_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS avis_google_delay_days INTEGER DEFAULT 3, -- J+X (défaut: J+3)
  ADD COLUMN IF NOT EXISTS avis_google_relance_days INTEGER DEFAULT 7, -- Relance J+Y (défaut: J+7)
  ADD COLUMN IF NOT EXISTS avis_google_location_id TEXT, -- Google My Business Location ID
  ADD COLUMN IF NOT EXISTS avis_google_api_key TEXT; -- API Key Google My Business

-- Trigger pour updated_at
CREATE TRIGGER update_avis_google_updated_at
  BEFORE UPDATE ON public.avis_google
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir les projets prêts pour demande avis (J+X après récupération)
CREATE OR REPLACE FUNCTION get_projets_ready_for_avis(
  p_atelier_id UUID,
  p_delay_days INTEGER DEFAULT 3
)
RETURNS TABLE (
  projet_id UUID,
  projet_numero TEXT,
  projet_name TEXT,
  client_id UUID,
  client_email TEXT,
  date_livre TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.numero,
    p.name,
    p.client_id,
    c.email,
    p.date_livre
  FROM public.projets p
  JOIN public.clients c ON c.id = p.client_id
  LEFT JOIN public.avis_google ag ON ag.projet_id = p.id
  WHERE p.atelier_id = p_atelier_id
    AND p.status = 'livre'
    AND p.date_livre IS NOT NULL
    AND p.date_livre::DATE <= CURRENT_DATE - INTERVAL '1 day' * p_delay_days
    AND (ag.id IS NULL OR ag.status = 'pending')
    AND c.email IS NOT NULL
  ORDER BY p.date_livre ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE public.avis_google IS 'Demandes d''avis Google My Business après récupération projet';
COMMENT ON FUNCTION get_projets_ready_for_avis IS 'Retourne les projets prêts pour demande avis (J+X après récupération)';
