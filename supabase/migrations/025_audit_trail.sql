-- Migration: Audit trail (historique des modifications)
-- Date: 2026-01-21

-- Table d'audit pour tracker les modifications
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atelier_id UUID NOT NULL REFERENCES ateliers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[], -- Liste des champs modifiés
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_atelier ON audit_logs(atelier_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique: les utilisateurs peuvent voir les logs de leur atelier
DROP POLICY IF EXISTS "Users can view their atelier audit logs" ON audit_logs;
CREATE POLICY "Users can view their atelier audit logs" ON audit_logs
  FOR SELECT
  USING (
    atelier_id IN (SELECT atelier_id FROM users WHERE id = auth.uid())
  );

-- Fonction générique pour l'audit
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  old_row JSONB := NULL;
  new_row JSONB := NULL;
  changed TEXT[] := '{}';
  atelier UUID;
  user_uuid UUID;
  key TEXT;
BEGIN
  -- Récupérer l'atelier_id
  IF TG_OP = 'DELETE' THEN
    IF OLD ? 'atelier_id' THEN
      atelier := (OLD->>'atelier_id')::UUID;
    END IF;
    old_row := to_jsonb(OLD);
  ELSE
    IF NEW ? 'atelier_id' THEN
      atelier := (NEW->>'atelier_id')::UUID;
    END IF;
    new_row := to_jsonb(NEW);
    
    IF TG_OP = 'UPDATE' THEN
      old_row := to_jsonb(OLD);
      -- Détecter les champs modifiés
      FOR key IN SELECT jsonb_object_keys(new_row) LOOP
        IF old_row->key IS DISTINCT FROM new_row->key THEN
          changed := array_append(changed, key);
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  -- Récupérer l'utilisateur courant
  user_uuid := auth.uid();
  
  -- Si pas d'atelier trouvé, ne pas logger
  IF atelier IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Ne pas logger si aucun changement réel (pour les UPDATE)
  IF TG_OP = 'UPDATE' AND array_length(changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Insérer le log
  INSERT INTO audit_logs (atelier_id, user_id, table_name, record_id, action, old_data, new_data, changed_fields)
  VALUES (
    atelier,
    user_uuid,
    TG_TABLE_NAME,
    COALESCE((NEW->>'id')::UUID, (OLD->>'id')::UUID),
    TG_OP,
    old_row,
    new_row,
    CASE WHEN array_length(changed, 1) > 0 THEN changed ELSE NULL END
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer les triggers pour les tables principales
-- Devis
DROP TRIGGER IF EXISTS audit_devis ON devis;
CREATE TRIGGER audit_devis
AFTER INSERT OR UPDATE OR DELETE ON devis
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Projets
DROP TRIGGER IF EXISTS audit_projets ON projets;
CREATE TRIGGER audit_projets
AFTER INSERT OR UPDATE OR DELETE ON projets
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Factures
DROP TRIGGER IF EXISTS audit_factures ON factures;
CREATE TRIGGER audit_factures
AFTER INSERT OR UPDATE OR DELETE ON factures
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Clients
DROP TRIGGER IF EXISTS audit_clients ON clients;
CREATE TRIGGER audit_clients
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Poudres
DROP TRIGGER IF EXISTS audit_poudres ON poudres;
CREATE TRIGGER audit_poudres
AFTER INSERT OR UPDATE OR DELETE ON poudres
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Commentaires
COMMENT ON TABLE audit_logs IS 'Historique des modifications sur les données';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Liste des champs modifiés (pour les UPDATE)';
