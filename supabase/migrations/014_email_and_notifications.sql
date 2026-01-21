-- Migration 014 : Email queue et notifications push
-- Appliquée via MCP le 2026-01-21

-- Table email_config pour la configuration email par atelier
CREATE TABLE IF NOT EXISTS public.email_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID UNIQUE NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend', 'smtp', 'gmail_oauth', 'outlook_oauth')),
  api_key TEXT,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  sender_name TEXT,
  sender_email TEXT,
  reply_to TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table email_queue pour les emails en attente
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table push_subscriptions pour les notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_atelier ON public.email_queue(atelier_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_atelier ON public.push_subscriptions(atelier_id);

-- RLS pour email_config
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage email config from their atelier" ON public.email_config;
CREATE POLICY "Users can manage email config from their atelier"
  ON public.email_config FOR ALL
  USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- RLS pour email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage email queue from their atelier" ON public.email_queue;
CREATE POLICY "Users can manage email queue from their atelier"
  ON public.email_queue FOR ALL
  USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- RLS pour push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());
