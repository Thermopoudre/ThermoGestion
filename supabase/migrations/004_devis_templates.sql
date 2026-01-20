-- Migration 004 : Templates devis personnalisables
-- Permet aux ateliers de créer et personnaliser leurs templates de devis

-- Table des templates de devis
CREATE TABLE public.devis_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false, -- Templates système (non modifiables)
  template_type TEXT NOT NULL DEFAULT 'moderne' CHECK (template_type IN ('moderne', 'classique', 'minimaliste', 'premium', 'custom')),
  
  -- Configuration du template (JSONB)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure config:
  -- {
  --   "header": { "logo_url": "", "show_logo": true, "show_atelier_info": true, "layout": "left|right|center" },
  --   "colors": { "primary": "#2563eb", "secondary": "#64748b", "accent": "#0ea5e9" },
  --   "body": { "show_client_info": true, "table_style": "bordered|striped|minimal", "column_widths": {} },
  --   "footer": { "show_cgv": true, "cgv_text": "", "show_signature": true, "custom_text": "" },
  --   "layout": { "page_size": "A4", "margins": {}, "font_family": "Arial", "font_size": 12 }
  -- }
  
  -- HTML/CSS du template (optionnel, pour templates custom avancés)
  html_template TEXT,
  css_template TEXT,
  
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atelier_id, name)
);

-- Index pour performance
CREATE INDEX idx_devis_templates_atelier ON public.devis_templates(atelier_id);
CREATE INDEX idx_devis_templates_type ON public.devis_templates(template_type);
CREATE INDEX idx_devis_templates_default ON public.devis_templates(atelier_id, is_default) WHERE is_default = true;

-- RLS Policies pour devis_templates
ALTER TABLE public.devis_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir les templates de leur atelier
CREATE POLICY "Users can view templates from their atelier"
  ON public.devis_templates
  FOR SELECT
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Les utilisateurs peuvent créer des templates pour leur atelier
CREATE POLICY "Users can create templates for their atelier"
  ON public.devis_templates
  FOR INSERT
  WITH CHECK (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Policy: Les utilisateurs peuvent modifier les templates de leur atelier (sauf templates système)
CREATE POLICY "Users can update templates from their atelier"
  ON public.devis_templates
  FOR UPDATE
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
    AND is_system = false
  );

-- Policy: Les utilisateurs peuvent supprimer les templates de leur atelier (sauf templates système)
CREATE POLICY "Users can delete templates from their atelier"
  ON public.devis_templates
  FOR DELETE
  USING (
    atelier_id IN (
      SELECT atelier_id FROM public.users WHERE id = auth.uid()
    )
    AND is_system = false
  );

-- Trigger pour updated_at
CREATE TRIGGER update_devis_templates_updated_at
  BEFORE UPDATE ON public.devis_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Foreign key pour devis.template_id
ALTER TABLE public.devis
  ADD CONSTRAINT fk_devis_template
  FOREIGN KEY (template_id) REFERENCES public.devis_templates(id) ON DELETE SET NULL;

-- Fonction pour créer les templates système par défaut lors de la création d'un atelier
-- (sera appelée via trigger ou manuellement)
CREATE OR REPLACE FUNCTION create_default_devis_templates(p_atelier_id UUID)
RETURNS void AS $$
BEGIN
  -- Template Moderne (par défaut)
  INSERT INTO public.devis_templates (
    atelier_id,
    name,
    description,
    is_default,
    is_system,
    template_type,
    config
  ) VALUES (
    p_atelier_id,
    'Moderne',
    'Template moderne avec design épuré et couleurs vives',
    true,
    true,
    'moderne',
    '{
      "header": {
        "show_logo": true,
        "show_atelier_info": true,
        "layout": "left"
      },
      "colors": {
        "primary": "#2563eb",
        "secondary": "#64748b",
        "accent": "#0ea5e9"
      },
      "body": {
        "show_client_info": true,
        "table_style": "striped",
        "column_widths": {}
      },
      "footer": {
        "show_cgv": true,
        "cgv_text": "Devis valable 30 jours. Conditions générales de vente disponibles sur demande.",
        "show_signature": true,
        "custom_text": ""
      },
      "layout": {
        "page_size": "A4",
        "margins": {"top": 40, "right": 40, "bottom": 40, "left": 40},
        "font_family": "Arial, sans-serif",
        "font_size": 12
      }
    }'::jsonb
  );

  -- Template Classique
  INSERT INTO public.devis_templates (
    atelier_id,
    name,
    description,
    is_default,
    is_system,
    template_type,
    config
  ) VALUES (
    p_atelier_id,
    'Classique',
    'Template classique professionnel avec bordures et structure traditionnelle',
    false,
    true,
    'classique',
    '{
      "header": {
        "show_logo": true,
        "show_atelier_info": true,
        "layout": "center"
      },
      "colors": {
        "primary": "#1f2937",
        "secondary": "#4b5563",
        "accent": "#6b7280"
      },
      "body": {
        "show_client_info": true,
        "table_style": "bordered",
        "column_widths": {}
      },
      "footer": {
        "show_cgv": true,
        "cgv_text": "Devis valable 30 jours. Conditions générales de vente disponibles sur demande.",
        "show_signature": true,
        "custom_text": ""
      },
      "layout": {
        "page_size": "A4",
        "margins": {"top": 30, "right": 30, "bottom": 30, "left": 30},
        "font_family": "Times New Roman, serif",
        "font_size": 11
      }
    }'::jsonb
  );

  -- Template Minimaliste
  INSERT INTO public.devis_templates (
    atelier_id,
    name,
    description,
    is_default,
    is_system,
    template_type,
    config
  ) VALUES (
    p_atelier_id,
    'Minimaliste',
    'Template épuré et minimaliste, idéal pour un look moderne',
    false,
    true,
    'minimaliste',
    '{
      "header": {
        "show_logo": false,
        "show_atelier_info": true,
        "layout": "left"
      },
      "colors": {
        "primary": "#000000",
        "secondary": "#6b7280",
        "accent": "#9ca3af"
      },
      "body": {
        "show_client_info": true,
        "table_style": "minimal",
        "column_widths": {}
      },
      "footer": {
        "show_cgv": false,
        "cgv_text": "",
        "show_signature": true,
        "custom_text": ""
      },
      "layout": {
        "page_size": "A4",
        "margins": {"top": 60, "right": 60, "bottom": 60, "left": 60},
        "font_family": "Helvetica, Arial, sans-serif",
        "font_size": 11
      }
    }'::jsonb
  );

  -- Template Premium
  INSERT INTO public.devis_templates (
    atelier_id,
    name,
    description,
    is_default,
    is_system,
    template_type,
    config
  ) VALUES (
    p_atelier_id,
    'Premium',
    'Template premium avec design soigné et mise en page élégante',
    false,
    true,
    'premium',
    '{
      "header": {
        "show_logo": true,
        "show_atelier_info": true,
        "layout": "right"
      },
      "colors": {
        "primary": "#1e40af",
        "secondary": "#3b82f6",
        "accent": "#60a5fa"
      },
      "body": {
        "show_client_info": true,
        "table_style": "striped",
        "column_widths": {}
      },
      "footer": {
        "show_cgv": true,
        "cgv_text": "Devis valable 30 jours. Conditions générales de vente disponibles sur demande.",
        "show_signature": true,
        "custom_text": ""
      },
      "layout": {
        "page_size": "A4",
        "margins": {"top": 50, "right": 50, "bottom": 50, "left": 50},
        "font_family": "Georgia, serif",
        "font_size": 12
      }
    }'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer automatiquement les templates par défaut lors de la création d'un atelier
-- (Note: Ce trigger sera créé après la création de la fonction)
-- On le fait manuellement pour les ateliers existants, ou via l'application
