-- Migration 020 : Relances automatiques et multi-utilisateurs

-- =========================================
-- 1. COLONNES POUR LES RELANCES
-- =========================================

-- Factures
ALTER TABLE public.factures
ADD COLUMN IF NOT EXISTS relance_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_relance_at TIMESTAMPTZ;

-- Devis
ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS relance_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_relance_at TIMESTAMPTZ;

-- =========================================
-- 2. SYSTÈME MULTI-UTILISATEURS / RÔLES
-- =========================================

-- Table des rôles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rôles par défaut
-- Permissions possibles:
-- clients: read, write, delete
-- projets: read, write, delete, status_change
-- devis: read, write, delete, send, sign
-- factures: read, write, delete, send, mark_paid
-- poudres: read, write, delete, stock
-- stats: read
-- settings: read, write
-- users: read, write, invite

-- Ajouter la colonne role_id sur users si elle n'existe pas
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id),
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- RLS pour roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view roles from their atelier"
  ON public.roles
  FOR SELECT
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Only owners can manage roles"
  ON public.roles
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid() AND is_owner = TRUE
    )
  );

-- =========================================
-- 3. TABLE INVITATIONS
-- =========================================

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID REFERENCES public.roles(id),
  invited_by UUID REFERENCES public.users(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS pour invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view invitations from their atelier"
  ON public.invitations
  FOR SELECT
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Owners can manage invitations"
  ON public.invitations
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid() AND is_owner = TRUE
    )
  );

-- =========================================
-- 4. HISTORIQUE D'ACTIVITÉ
-- =========================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- client, projet, devis, facture, poudre
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_activity_log_atelier ON public.activity_log(atelier_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

-- RLS pour activity_log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view activity from their atelier"
  ON public.activity_log
  FOR SELECT
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can create activity in their atelier"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- =========================================
-- 5. FONCTION POUR CRÉER LES RÔLES PAR DÉFAUT
-- =========================================

CREATE OR REPLACE FUNCTION create_default_roles(p_atelier_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Rôle Admin
  INSERT INTO public.roles (atelier_id, name, permissions, is_default)
  VALUES (
    p_atelier_id,
    'Administrateur',
    '{
      "clients": ["read", "write", "delete"],
      "projets": ["read", "write", "delete", "status_change"],
      "devis": ["read", "write", "delete", "send", "sign"],
      "factures": ["read", "write", "delete", "send", "mark_paid"],
      "poudres": ["read", "write", "delete", "stock"],
      "stats": ["read"],
      "settings": ["read", "write"],
      "users": ["read", "write", "invite"]
    }'::jsonb,
    FALSE
  );

  -- Rôle Commercial
  INSERT INTO public.roles (atelier_id, name, permissions, is_default)
  VALUES (
    p_atelier_id,
    'Commercial',
    '{
      "clients": ["read", "write"],
      "projets": ["read"],
      "devis": ["read", "write", "send"],
      "factures": ["read"],
      "poudres": ["read"],
      "stats": ["read"]
    }'::jsonb,
    FALSE
  );

  -- Rôle Opérateur
  INSERT INTO public.roles (atelier_id, name, permissions, is_default)
  VALUES (
    p_atelier_id,
    'Opérateur',
    '{
      "clients": ["read"],
      "projets": ["read", "status_change"],
      "devis": ["read"],
      "factures": ["read"],
      "poudres": ["read", "stock"]
    }'::jsonb,
    TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
