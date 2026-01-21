-- Migration: Ajout des tokens publics pour accès sans compte
-- Permet aux clients d'accéder à leurs projets/devis via un lien unique

-- Fonction pour générer un token unique sécurisé
CREATE OR REPLACE FUNCTION generate_public_token()
RETURNS TEXT AS $$
BEGIN
  -- Génère un token de 32 caractères alphanumériques
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Ajouter le token public aux devis
ALTER TABLE devis 
ADD COLUMN IF NOT EXISTS public_token VARCHAR(64) UNIQUE;

-- Générer des tokens pour les devis existants
UPDATE devis 
SET public_token = encode(gen_random_bytes(24), 'base64')
WHERE public_token IS NULL;

-- Créer un index pour recherche rapide par token
CREATE INDEX IF NOT EXISTS idx_devis_public_token ON devis(public_token);

-- Ajouter le token public aux projets
ALTER TABLE projets 
ADD COLUMN IF NOT EXISTS public_token VARCHAR(64) UNIQUE;

-- Générer des tokens pour les projets existants
UPDATE projets 
SET public_token = encode(gen_random_bytes(24), 'base64')
WHERE public_token IS NULL;

-- Créer un index pour recherche rapide par token
CREATE INDEX IF NOT EXISTS idx_projets_public_token ON projets(public_token);

-- Trigger pour générer automatiquement le token à la création d'un devis
CREATE OR REPLACE FUNCTION set_devis_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(24), 'base64');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_devis_public_token ON devis;
CREATE TRIGGER trigger_set_devis_public_token
  BEFORE INSERT ON devis
  FOR EACH ROW
  EXECUTE FUNCTION set_devis_public_token();

-- Trigger pour générer automatiquement le token à la création d'un projet
CREATE OR REPLACE FUNCTION set_projet_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(24), 'base64');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_projet_public_token ON projets;
CREATE TRIGGER trigger_set_projet_public_token
  BEFORE INSERT ON projets
  FOR EACH ROW
  EXECUTE FUNCTION set_projet_public_token();

-- Table pour stocker les invitations de création de compte
CREATE TABLE IF NOT EXISTS client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  atelier_id UUID REFERENCES ateliers(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64'),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_invitations_token ON client_invitations(token);
CREATE INDEX IF NOT EXISTS idx_client_invitations_email ON client_invitations(email);

-- Politique RLS pour permettre l'accès public aux devis via token
CREATE POLICY "Public access devis by token" ON devis
  FOR SELECT
  USING (public_token IS NOT NULL);

-- Politique RLS pour permettre l'accès public aux projets via token  
CREATE POLICY "Public access projets by token" ON projets
  FOR SELECT
  USING (public_token IS NOT NULL);
