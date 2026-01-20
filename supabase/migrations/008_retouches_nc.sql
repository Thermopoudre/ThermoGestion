-- Migration 008 : Retouches / Non-conformités (NC)
-- Permet de déclarer et suivre les retouches sur les projets

-- Table des types de défauts (paramétrable par atelier)
CREATE TABLE IF NOT EXISTS public.defaut_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'qualite', 'finition', 'dimension', 'autre'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, name)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_defaut_types_atelier ON public.defaut_types(atelier_id);

-- RLS Policies pour defaut_types
ALTER TABLE public.defaut_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage defaut types from their atelier"
  ON public.defaut_types
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_defaut_types_updated_at
  BEFORE UPDATE ON public.defaut_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table des retouches/NC
CREATE TABLE IF NOT EXISTS public.retouches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  defaut_type_id UUID REFERENCES public.defaut_types(id) ON DELETE SET NULL,
  step_index INTEGER, -- Étape où la NC a été détectée
  description TEXT NOT NULL,
  photo_url TEXT, -- Photo du défaut
  action_corrective TEXT, -- Action corrective prise
  status TEXT NOT NULL DEFAULT 'declaree' CHECK (status IN ('declaree', 'en_cours', 'resolue', 'annulee')),
  delai_induit_jours INTEGER, -- Délai induit par la retouche (en jours)
  created_by UUID REFERENCES public.users(id),
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_retouches_atelier ON public.retouches(atelier_id);
CREATE INDEX IF NOT EXISTS idx_retouches_projet ON public.retouches(projet_id);
CREATE INDEX IF NOT EXISTS idx_retouches_status ON public.retouches(status);
CREATE INDEX IF NOT EXISTS idx_retouches_created ON public.retouches(created_at);

-- RLS Policies pour retouches
ALTER TABLE public.retouches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage retouches from their atelier"
  ON public.retouches
  FOR ALL
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger pour updated_at
CREATE TRIGGER update_retouches_updated_at
  BEFORE UPDATE ON public.retouches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour calculer le taux de NC par période
CREATE OR REPLACE FUNCTION calculate_nc_rate(
  p_atelier_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_projets INTEGER,
  projets_avec_nc INTEGER,
  taux_nc DECIMAL(5, 2),
  total_retouches INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH projets_periode AS (
    SELECT COUNT(DISTINCT p.id) as total
    FROM public.projets p
    WHERE p.atelier_id = p_atelier_id
      AND p.created_at::DATE BETWEEN p_start_date AND p_end_date
  ),
  projets_nc AS (
    SELECT COUNT(DISTINCT r.projet_id) as avec_nc
    FROM public.retouches r
    WHERE r.atelier_id = p_atelier_id
      AND r.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND r.status != 'annulee'
  ),
  total_retouches_count AS (
    SELECT COUNT(*) as total
    FROM public.retouches r
    WHERE r.atelier_id = p_atelier_id
      AND r.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND r.status != 'annulee'
  )
  SELECT
    pp.total::INTEGER,
    pnc.avec_nc::INTEGER,
    CASE
      WHEN pp.total > 0 THEN (pnc.avec_nc::DECIMAL / pp.total::DECIMAL * 100)
      ELSE 0
    END::DECIMAL(5, 2) as taux_nc,
    trc.total::INTEGER
  FROM projets_periode pp
  CROSS JOIN projets_nc pnc
  CROSS JOIN total_retouches_count trc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les causes principales de retouches
CREATE OR REPLACE FUNCTION get_main_nc_causes(
  p_atelier_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  defaut_type_id UUID,
  defaut_name TEXT,
  count INTEGER,
  percentage DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  WITH retouches_periode AS (
    SELECT r.defaut_type_id, COUNT(*) as cnt
    FROM public.retouches r
    WHERE r.atelier_id = p_atelier_id
      AND r.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND r.status != 'annulee'
    GROUP BY r.defaut_type_id
  ),
  total_retouches AS (
    SELECT COUNT(*) as total
    FROM public.retouches r
    WHERE r.atelier_id = p_atelier_id
      AND r.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND r.status != 'annulee'
  )
  SELECT
    dt.id,
    dt.name,
    rp.cnt::INTEGER,
    CASE
      WHEN tr.total > 0 THEN (rp.cnt::DECIMAL / tr.total::DECIMAL * 100)
      ELSE 0
    END::DECIMAL(5, 2) as percentage
  FROM retouches_periode rp
  JOIN public.defaut_types dt ON dt.id = rp.defaut_type_id
  CROSS JOIN total_retouches tr
  ORDER BY rp.cnt DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE public.defaut_types IS 'Types de défauts paramétrables par atelier';
COMMENT ON TABLE public.retouches IS 'Déclarations de retouches/non-conformités sur projets';
COMMENT ON FUNCTION calculate_nc_rate IS 'Calcule le taux de NC pour une période donnée';
COMMENT ON FUNCTION get_main_nc_causes IS 'Retourne les causes principales de retouches';
