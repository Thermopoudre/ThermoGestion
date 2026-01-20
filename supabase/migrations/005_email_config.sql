-- Migration 005 : Configuration email pour ateliers
-- Permet aux ateliers de configurer leur méthode d'envoi email (OAuth Gmail/Outlook ou SMTP)

-- Ajout de la configuration email dans settings JSONB des ateliers
-- Structure settings.email_config:
-- {
--   "provider": "resend" | "smtp" | "gmail_oauth" | "outlook_oauth",
--   "resend_api_key": "...", (si provider = resend)
--   "smtp_host": "...", (si provider = smtp)
--   "smtp_port": 587,
--   "smtp_user": "...",
--   "smtp_password": "...",
--   "smtp_secure": true,
--   "from_email": "contact@atelier.fr",
--   "from_name": "Nom Atelier",
--   "gmail_oauth": { ... }, (si provider = gmail_oauth)
--   "outlook_oauth": { ... } (si provider = outlook_oauth)
-- }

-- Table pour stocker les tokens OAuth (si OAuth utilisé)
CREATE TABLE IF NOT EXISTS public.email_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, provider)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_email_oauth_tokens_atelier ON public.email_oauth_tokens(atelier_id);

-- RLS Policies pour email_oauth_tokens
ALTER TABLE public.email_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage email tokens for their atelier"
  ON public.email_oauth_tokens
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_email_oauth_tokens_updated_at
  BEFORE UPDATE ON public.email_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table pour queue d'envoi emails (alternative simple à Bull+Redis pour Serverless)
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{ filename, url, content }]
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_email_queue_atelier ON public.email_queue(atelier_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON public.email_queue(created_at);

-- RLS Policies pour email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email queue from their atelier"
  ON public.email_queue
  FOR SELECT
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create email queue for their atelier"
  ON public.email_queue
  FOR INSERT
  WITH CHECK (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Fonction pour traiter la queue (sera appelée par cron job ou API route)
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS void AS $$
DECLARE
  email_record RECORD;
BEGIN
  -- Récupérer les emails en attente (limite 10 par batch)
  FOR email_record IN
    SELECT * FROM public.email_queue
    WHERE status = 'pending'
      AND retry_count < max_retries
    ORDER BY created_at ASC
    LIMIT 10
  LOOP
    -- Mettre à jour le statut à 'sending'
    UPDATE public.email_queue
    SET status = 'sending', updated_at = NOW()
    WHERE id = email_record.id;
    
    -- Le traitement réel sera fait par l'API route Next.js
    -- Cette fonction marque juste les emails à traiter
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire
COMMENT ON TABLE public.email_oauth_tokens IS 'Stockage des tokens OAuth pour Gmail/Outlook';
COMMENT ON TABLE public.email_queue IS 'Queue d''envoi emails pour traitement asynchrone';
