-- Migration 009 : Notifications Push (Web Push)
-- Système de notifications push pour les ateliers

-- Table pour les abonnements push (subscriptions)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- URL endpoint du service push
  p256dh TEXT NOT NULL, -- Clé publique
  auth TEXT NOT NULL, -- Secret d'authentification
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint) -- Un utilisateur peut avoir plusieurs devices, mais pas le même endpoint
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_atelier ON public.push_subscriptions(atelier_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- RLS Policies pour push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    user_id = auth.uid()
  );

-- Table pour l'historique des notifications envoyées
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL = notification globale atelier
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT, -- URL icône
  badge TEXT, -- URL badge
  data JSONB, -- Données additionnelles (lien, action, etc.)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_atelier ON public.push_notifications(atelier_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON public.push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON public.push_notifications(status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created ON public.push_notifications(created_at);

-- RLS Policies pour push_notifications
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their push notifications"
  ON public.push_notifications
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())
  );

-- Trigger pour updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Commentaires
COMMENT ON TABLE public.push_subscriptions IS 'Abonnements push des utilisateurs (Web Push API)';
COMMENT ON TABLE public.push_notifications IS 'Historique des notifications push envoyées';
