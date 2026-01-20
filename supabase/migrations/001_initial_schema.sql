-- Migration initiale : Schéma de base ThermoGestion
-- Multi-tenancy avec Row Level Security (RLS)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABLES PRINCIPALES
-- ============================================

-- Ateliers (tenants)
CREATE TABLE public.ateliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  siret TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'lite' CHECK (plan IN ('lite', 'pro')),
  trial_ends_at TIMESTAMPTZ,
  storage_quota_gb INTEGER NOT NULL DEFAULT 20,
  storage_used_gb DECIMAL(10, 2) NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Utilisateurs atelier (extension de auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('owner', 'admin', 'operator', 'compta')),
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, email)
);

-- Clients finaux
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  type TEXT NOT NULL DEFAULT 'particulier' CHECK (type IN ('particulier', 'professionnel')),
  siret TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, email)
);

-- Catalogue poudres
CREATE TABLE public.poudres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  marque TEXT NOT NULL,
  reference TEXT NOT NULL,
  type TEXT NOT NULL, -- epoxy, polyester, etc.
  ral TEXT,
  finition TEXT NOT NULL, -- mat, satin, brillant, texture, metallic
  densite DECIMAL(10, 2),
  epaisseur_conseillee DECIMAL(10, 2),
  consommation_m2 DECIMAL(10, 2),
  temp_cuisson INTEGER,
  duree_cuisson INTEGER,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'thermopoudre', 'concurrent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, marque, reference, finition)
);

-- Stock poudres
CREATE TABLE public.stock_poudres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  poudre_id UUID NOT NULL REFERENCES public.poudres(id) ON DELETE CASCADE,
  stock_theorique_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock_reel_kg DECIMAL(10, 2),
  tare_carton_kg DECIMAL(10, 2),
  dernier_pesee_at TIMESTAMPTZ,
  historique_pesees JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, poudre_id)
);

-- Devis
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'converted')),
  total_ht DECIMAL(10, 2) NOT NULL,
  total_ttc DECIMAL(10, 2) NOT NULL,
  tva_rate DECIMAL(5, 2) NOT NULL DEFAULT 20,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_id UUID,
  pdf_url TEXT,
  signed_at TIMESTAMPTZ,
  signed_by TEXT,
  signed_ip TEXT,
  signature_data JSONB,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, numero)
);

-- Projets
CREATE TABLE public.projets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  devis_id UUID REFERENCES public.devis(id),
  numero TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_cours' CHECK (status IN ('devis', 'en_cours', 'en_cuisson', 'qc', 'pret', 'livre', 'annule')),
  workflow_config JSONB DEFAULT '[]'::jsonb,
  current_step INTEGER DEFAULT 0,
  pieces JSONB DEFAULT '[]'::jsonb,
  poudre_id UUID REFERENCES public.poudres(id),
  couches INTEGER NOT NULL DEFAULT 1,
  temp_cuisson INTEGER,
  duree_cuisson INTEGER,
  date_depot DATE,
  date_promise DATE,
  date_livre DATE,
  photos_count INTEGER DEFAULT 0,
  photos_size_mb DECIMAL(10, 2) DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, numero)
);

-- Photos projets
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('avant', 'apres', 'etape', 'nc', 'autre')),
  step_index INTEGER,
  size_bytes BIGINT NOT NULL,
  metadata JSONB,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Séries (batch)
CREATE TABLE public.series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  poudre_id UUID NOT NULL REFERENCES public.poudres(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  projets_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'en_cours', 'en_cuisson', 'terminee')),
  date_creation DATE NOT NULL DEFAULT CURRENT_DATE,
  date_cuisson DATE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, numero)
);

-- Factures
CREATE TABLE public.factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  projet_id UUID REFERENCES public.projets(id),
  numero TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('acompte', 'solde', 'complete')),
  total_ht DECIMAL(10, 2) NOT NULL,
  total_ttc DECIMAL(10, 2) NOT NULL,
  tva_rate DECIMAL(5, 2) NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyee', 'payee', 'remboursee')),
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  fec_exported BOOLEAN DEFAULT false,
  fec_exported_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, numero)
);

-- Journal d'audit
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX idx_users_atelier_id ON public.users(atelier_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_clients_atelier_id ON public.clients(atelier_id);
CREATE INDEX idx_clients_email ON public.clients(atelier_id, email);
CREATE INDEX idx_poudres_atelier_id ON public.poudres(atelier_id);
CREATE INDEX idx_stock_poudres_atelier_id ON public.stock_poudres(atelier_id);
CREATE INDEX idx_devis_atelier_id ON public.devis(atelier_id);
CREATE INDEX idx_devis_client_id ON public.devis(client_id);
CREATE INDEX idx_projets_atelier_id ON public.projets(atelier_id);
CREATE INDEX idx_projets_client_id ON public.projets(client_id);
CREATE INDEX idx_photos_atelier_id ON public.photos(atelier_id);
CREATE INDEX idx_photos_projet_id ON public.photos(projet_id);
CREATE INDEX idx_series_atelier_id ON public.series(atelier_id);
CREATE INDEX idx_factures_atelier_id ON public.factures(atelier_id);
CREATE INDEX idx_audit_logs_atelier_id ON public.audit_logs(atelier_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.ateliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poudres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_poudres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Fonction helper pour obtenir atelier_id de l'utilisateur
CREATE OR REPLACE FUNCTION public.get_user_atelier_id()
RETURNS UUID AS $$
  SELECT atelier_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies pour users
CREATE POLICY "Users can view their own atelier"
  ON public.users FOR SELECT
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- Policies pour ateliers
CREATE POLICY "Users can view their own atelier"
  ON public.ateliers FOR SELECT
  USING (id = public.get_user_atelier_id());

-- Policies pour clients (exemple - à compléter)
CREATE POLICY "Users can manage clients in their atelier"
  ON public.clients FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

-- Policies pour toutes les autres tables (même principe)
CREATE POLICY "Users can manage poudres in their atelier"
  ON public.poudres FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can manage stock in their atelier"
  ON public.stock_poudres FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can manage devis in their atelier"
  ON public.devis FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can manage projets in their atelier"
  ON public.projets FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can manage photos in their atelier"
  ON public.photos FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can manage series in their atelier"
  ON public.series FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can manage factures in their atelier"
  ON public.factures FOR ALL
  USING (atelier_id = public.get_user_atelier_id());

CREATE POLICY "Users can view audit logs in their atelier"
  ON public.audit_logs FOR SELECT
  USING (atelier_id = public.get_user_atelier_id());

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ateliers_updated_at BEFORE UPDATE ON public.ateliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_poudres_updated_at BEFORE UPDATE ON public.poudres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_poudres_updated_at BEFORE UPDATE ON public.stock_poudres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projets_updated_at BEFORE UPDATE ON public.projets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_series_updated_at BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
