-- Migration 029: Toutes les nouvelles fonctionnalités
-- Calculateur prix, QR Code, SMS, Batching, Poudres avancées, Racks, Qualité, Certifications, Pointage, Planning, Catalogue, Tarifs, CRM, Versions, IA, Écran atelier

-- ============================================
-- 1. CALCULATEUR DE PRIX AUTOMATIQUE
-- ============================================

-- Table des grilles tarifaires
CREATE TABLE IF NOT EXISTS public.grilles_tarifaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    nom TEXT NOT NULL DEFAULT 'Grille standard',
    is_default BOOLEAN DEFAULT false,
    -- Tarifs de base au m²
    prix_base_m2 DECIMAL(10,2) DEFAULT 15.00,
    -- Paliers de surface (dégressivité)
    palier_1_max_m2 DECIMAL(10,2) DEFAULT 2.00,
    palier_1_coef DECIMAL(5,2) DEFAULT 1.50, -- +50% pour < 2m²
    palier_2_max_m2 DECIMAL(10,2) DEFAULT 5.00,
    palier_2_coef DECIMAL(5,2) DEFAULT 1.20, -- +20% pour 2-5m²
    palier_3_max_m2 DECIMAL(10,2) DEFAULT 10.00,
    palier_3_coef DECIMAL(5,2) DEFAULT 1.00, -- Prix normal
    palier_4_coef DECIMAL(5,2) DEFAULT 0.85, -- -15% pour > 10m²
    -- Complexité
    complexite_simple_coef DECIMAL(5,2) DEFAULT 1.00,
    complexite_moyenne_coef DECIMAL(5,2) DEFAULT 1.30,
    complexite_complexe_coef DECIMAL(5,2) DEFAULT 1.60,
    -- Finitions
    finition_mat_coef DECIMAL(5,2) DEFAULT 1.00,
    finition_satine_coef DECIMAL(5,2) DEFAULT 1.05,
    finition_brillant_coef DECIMAL(5,2) DEFAULT 1.10,
    finition_texture_coef DECIMAL(5,2) DEFAULT 1.25,
    finition_metallise_coef DECIMAL(5,2) DEFAULT 1.35,
    -- Couches
    prix_couche_sup DECIMAL(10,2) DEFAULT 8.00, -- par couche supplémentaire
    -- Minimum
    forfait_minimum DECIMAL(10,2) DEFAULT 50.00,
    -- Préparation
    prix_sablage_m2 DECIMAL(10,2) DEFAULT 12.00,
    prix_degraissage_m2 DECIMAL(10,2) DEFAULT 5.00,
    prix_primaire_m2 DECIMAL(10,2) DEFAULT 8.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarifs spécifiques par client
CREATE TABLE IF NOT EXISTS public.tarifs_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    grille_id UUID REFERENCES public.grilles_tarifaires(id) ON DELETE SET NULL,
    remise_globale_pct DECIMAL(5,2) DEFAULT 0,
    conditions_paiement TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(atelier_id, client_id)
);

-- ============================================
-- 2. GESTION AVANCÉE DES POUDRES
-- ============================================

-- Ajouter colonnes avancées aux poudres
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS date_peremption DATE;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS numero_lot TEXT;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS fournisseur TEXT;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS fiche_technique_url TEXT;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS fds_url TEXT; -- Fiche de Données Sécurité
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS date_reception DATE;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS certifications TEXT[]; -- Array de certifications
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS qualicoat_approved BOOLEAN DEFAULT false;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS qualimarine_approved BOOLEAN DEFAULT false;
ALTER TABLE public.poudres ADD COLUMN IF NOT EXISTS stock_min_kg DECIMAL(10,2) DEFAULT 5.00;

-- ============================================
-- 3. GESTION DES RACKS / PALONNIERS
-- ============================================

CREATE TABLE IF NOT EXISTS public.racks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    nom TEXT,
    type TEXT DEFAULT 'standard', -- standard, cremaillere, palonnier
    longueur_cm INTEGER,
    largeur_cm INTEGER,
    hauteur_cm INTEGER,
    capacite_kg INTEGER DEFAULT 100,
    nb_crochets INTEGER DEFAULT 20,
    status TEXT DEFAULT 'disponible', -- disponible, en_utilisation, maintenance
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Association rack-projet
CREATE TABLE IF NOT EXISTS public.projet_racks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
    rack_id UUID NOT NULL REFERENCES public.racks(id) ON DELETE CASCADE,
    photo_chargement_url TEXT,
    date_chargement TIMESTAMPTZ DEFAULT NOW(),
    date_dechargement TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CHECKLIST QUALITÉ & NON-CONFORMITÉS
-- ============================================

CREATE TABLE IF NOT EXISTS public.controles_qualite (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
    controleur_id UUID REFERENCES public.users(id),
    date_controle TIMESTAMPTZ DEFAULT NOW(),
    etape TEXT NOT NULL, -- preparation, poudrage, cuisson, final
    -- Checks
    epaisseur_ok BOOLEAN,
    epaisseur_mesure INTEGER, -- en microns
    adherence_ok BOOLEAN,
    aspect_visuel_ok BOOLEAN,
    teinte_conforme BOOLEAN,
    brillance_ok BOOLEAN,
    -- Résultat global
    resultat TEXT DEFAULT 'en_attente', -- en_attente, conforme, non_conforme, a_retoucher
    commentaires TEXT,
    photos TEXT[], -- URLs des photos
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Types de défauts prédéfinis
CREATE TABLE IF NOT EXISTS public.types_defauts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    nom TEXT NOT NULL,
    description TEXT,
    gravite TEXT DEFAULT 'mineur', -- mineur, majeur, critique
    action_corrective TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Défauts constatés (amélioration de la table retouches existante)
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS type_defaut_id UUID REFERENCES public.types_defauts(id);
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS gravite TEXT DEFAULT 'mineur';
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS photos_avant TEXT[];
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS photos_apres TEXT[];
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS cout_estime DECIMAL(10,2);
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS temps_estime_min INTEGER;
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS temps_reel_min INTEGER;
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS valide_par UUID REFERENCES public.users(id);
ALTER TABLE public.retouches ADD COLUMN IF NOT EXISTS date_validation TIMESTAMPTZ;

-- ============================================
-- 5. CERTIFICATIONS QUALICOAT / QUALIMARINE
-- ============================================

CREATE TABLE IF NOT EXISTS public.certifications_atelier (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- qualicoat, qualimarine, iso9001, etc.
    numero_certification TEXT,
    date_obtention DATE,
    date_expiration DATE,
    document_url TEXT,
    is_active BOOLEAN DEFAULT true,
    rappel_renouvellement_jours INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter certification projet
ALTER TABLE public.projets ADD COLUMN IF NOT EXISTS certification_requise TEXT; -- qualicoat, qualimarine, standard
ALTER TABLE public.projets ADD COLUMN IF NOT EXISTS parametres_cuisson JSONB; -- {temp_min, temp_max, duree_min, duree_max}

-- ============================================
-- 6. POINTAGE TEMPS PAR PROJET
-- ============================================

CREATE TABLE IF NOT EXISTS public.pointages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    etape TEXT NOT NULL, -- preparation, sablage, poudrage, cuisson, controle, emballage
    date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_fin TIMESTAMPTZ,
    duree_minutes INTEGER, -- calculé automatiquement
    pause_minutes INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter temps aux projets
ALTER TABLE public.projets ADD COLUMN IF NOT EXISTS temps_estime_min INTEGER;
ALTER TABLE public.projets ADD COLUMN IF NOT EXISTS temps_reel_min INTEGER;

-- ============================================
-- 7. PLANNING FOUR & CABINE
-- ============================================

CREATE TABLE IF NOT EXISTS public.equipements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- four, cabine, tunnel
    nom TEXT NOT NULL,
    -- Dimensions
    longueur_cm INTEGER,
    largeur_cm INTEGER,
    hauteur_cm INTEGER,
    -- Capacités
    capacite_kg INTEGER,
    temp_max INTEGER, -- température max
    -- Planning
    disponible BOOLEAN DEFAULT true,
    horaires_ouverture TEXT, -- JSON des horaires
    -- Maintenance
    prochaine_maintenance DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reservations_equipement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipement_id UUID NOT NULL REFERENCES public.equipements(id) ON DELETE CASCADE,
    projet_id UUID REFERENCES public.projets(id) ON DELETE SET NULL,
    date_debut TIMESTAMPTZ NOT NULL,
    date_fin TIMESTAMPTZ NOT NULL,
    temperature INTEGER, -- pour les fours
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CATALOGUE DE PRESTATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.prestations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    nom TEXT NOT NULL,
    description TEXT,
    categorie TEXT, -- thermolaquage, sablage, traitement, transport
    unite TEXT DEFAULT 'm2', -- m2, kg, piece, forfait
    prix_unitaire_ht DECIMAL(10,2) NOT NULL,
    tva_rate DECIMAL(5,2) DEFAULT 20,
    duree_estimee_min INTEGER,
    is_active BOOLEAN DEFAULT true,
    ordre_affichage INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CRM AVANCÉ
-- ============================================

-- Historique des interactions
CREATE TABLE IF NOT EXISTS public.interactions_client (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    type TEXT NOT NULL, -- appel, email, visite, reunion, autre
    date_interaction TIMESTAMPTZ DEFAULT NOW(),
    sujet TEXT,
    contenu TEXT,
    duree_minutes INTEGER,
    resultat TEXT, -- positif, neutre, negatif
    relance_prevue DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunités commerciales
CREATE TABLE IF NOT EXISTS public.opportunites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    titre TEXT NOT NULL,
    description TEXT,
    montant_estime DECIMAL(10,2),
    probabilite INTEGER DEFAULT 50, -- pourcentage
    statut TEXT DEFAULT 'prospection', -- prospection, qualification, proposition, negociation, gagne, perdu
    date_cloture_prevue DATE,
    source TEXT, -- site_web, recommandation, appel, salon, autre
    devis_id UUID REFERENCES public.devis(id),
    responsable_id UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Améliorer clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS categorie TEXT DEFAULT 'standard'; -- prospect, standard, vip, inactif
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source_acquisition TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date_premier_contact DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS date_dernier_contact DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ca_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nb_projets INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS score_fidelite INTEGER DEFAULT 0; -- 0-100
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferences_contact TEXT; -- email, telephone, sms
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS horaires_contact TEXT;

-- ============================================
-- 10. DEVIS MULTI-VERSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.devis_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    items JSONB NOT NULL,
    total_ht DECIMAL(10,2) NOT NULL,
    total_ttc DECIMAL(10,2) NOT NULL,
    notes TEXT,
    motif_modification TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS version_actuelle INTEGER DEFAULT 1;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS devis_parent_id UUID REFERENCES public.devis(id);

-- ============================================
-- 11. SMS NOTIFICATIONS (Config Twilio)
-- ============================================

-- Config SMS dans ateliers
ALTER TABLE public.ateliers ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.ateliers ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT;
ALTER TABLE public.ateliers ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT;
ALTER TABLE public.ateliers ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT;
ALTER TABLE public.ateliers ADD COLUMN IF NOT EXISTS sms_templates JSONB DEFAULT '{}';

-- Log des SMS envoyés
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    projet_id UUID REFERENCES public.projets(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT, -- status_update, rappel, promo
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
    twilio_sid TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Préférences SMS client
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sms_optin BOOLEAN DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sms_notifications JSONB DEFAULT '{"status_update": true, "rappel": true, "promo": false}';

-- ============================================
-- 12. IA PRÉDICTIVE
-- ============================================

-- Historique des prédictions
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- delai, anomalie, stock
    entite_type TEXT, -- projet, poudre, client
    entite_id UUID,
    prediction_value JSONB NOT NULL,
    confidence DECIMAL(5,2),
    modele_version TEXT,
    was_correct BOOLEAN, -- pour feedback
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statistiques pour IA
CREATE TABLE IF NOT EXISTS public.stats_projets_historique (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
    mois DATE NOT NULL,
    nb_projets INTEGER DEFAULT 0,
    surface_totale_m2 DECIMAL(12,2) DEFAULT 0,
    temps_moyen_min INTEGER,
    taux_retouche DECIMAL(5,2),
    delai_moyen_jours INTEGER,
    ca_total DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(atelier_id, mois)
);

-- ============================================
-- 13. QR CODE (ajout token unique aux projets)
-- ============================================

ALTER TABLE public.projets ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE;
ALTER TABLE public.projets ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ;

-- Fonction pour générer token QR
CREATE OR REPLACE FUNCTION generate_projet_qr_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_token IS NULL THEN
        NEW.qr_token := encode(gen_random_bytes(16), 'hex');
        NEW.qr_generated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer QR token
DROP TRIGGER IF EXISTS trigger_generate_qr_token ON public.projets;
CREATE TRIGGER trigger_generate_qr_token
    BEFORE INSERT ON public.projets
    FOR EACH ROW
    EXECUTE FUNCTION generate_projet_qr_token();

-- Mettre à jour les projets existants
UPDATE public.projets 
SET qr_token = encode(gen_random_bytes(16), 'hex'),
    qr_generated_at = NOW()
WHERE qr_token IS NULL;

-- ============================================
-- 14. ÉCRAN ATELIER
-- ============================================

-- Configuration écran atelier
ALTER TABLE public.ateliers ADD COLUMN IF NOT EXISTS ecran_atelier_config JSONB DEFAULT '{
    "afficher_projets_jour": true,
    "afficher_alertes": true,
    "afficher_stats": true,
    "refresh_interval_sec": 30,
    "theme": "dark"
}';

-- ============================================
-- INDEXES POUR PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_pointages_projet ON public.pointages(projet_id);
CREATE INDEX IF NOT EXISTS idx_pointages_user ON public.pointages(user_id);
CREATE INDEX IF NOT EXISTS idx_pointages_date ON public.pointages(date_debut);

CREATE INDEX IF NOT EXISTS idx_controles_projet ON public.controles_qualite(projet_id);
CREATE INDEX IF NOT EXISTS idx_controles_date ON public.controles_qualite(date_controle);

CREATE INDEX IF NOT EXISTS idx_interactions_client ON public.interactions_client(client_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON public.interactions_client(date_interaction);

CREATE INDEX IF NOT EXISTS idx_opportunites_client ON public.opportunites(client_id);
CREATE INDEX IF NOT EXISTS idx_opportunites_statut ON public.opportunites(statut);

CREATE INDEX IF NOT EXISTS idx_reservations_equipement ON public.reservations_equipement(equipement_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON public.reservations_equipement(date_debut, date_fin);

CREATE INDEX IF NOT EXISTS idx_projets_qr_token ON public.projets(qr_token);
CREATE INDEX IF NOT EXISTS idx_projets_certification ON public.projets(certification_requise);

CREATE INDEX IF NOT EXISTS idx_sms_logs_atelier ON public.sms_logs(atelier_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client ON public.sms_logs(client_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Grilles tarifaires
ALTER TABLE public.grilles_tarifaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grilles_tarifaires_policy" ON public.grilles_tarifaires
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Tarifs clients
ALTER TABLE public.tarifs_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarifs_clients_policy" ON public.tarifs_clients
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Racks
ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "racks_policy" ON public.racks
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Projet racks
ALTER TABLE public.projet_racks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projet_racks_policy" ON public.projet_racks
    FOR ALL USING (projet_id IN (SELECT id FROM public.projets WHERE atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())));

-- Contrôles qualité
ALTER TABLE public.controles_qualite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "controles_qualite_policy" ON public.controles_qualite
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Types défauts
ALTER TABLE public.types_defauts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types_defauts_policy" ON public.types_defauts
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Certifications atelier
ALTER TABLE public.certifications_atelier ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certifications_atelier_policy" ON public.certifications_atelier
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Pointages
ALTER TABLE public.pointages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pointages_policy" ON public.pointages
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Équipements
ALTER TABLE public.equipements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipements_policy" ON public.equipements
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Réservations équipement
ALTER TABLE public.reservations_equipement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_equipement_policy" ON public.reservations_equipement
    FOR ALL USING (equipement_id IN (SELECT id FROM public.equipements WHERE atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())));

-- Prestations
ALTER TABLE public.prestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestations_policy" ON public.prestations
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Interactions client
ALTER TABLE public.interactions_client ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions_client_policy" ON public.interactions_client
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Opportunités
ALTER TABLE public.opportunites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunites_policy" ON public.opportunites
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Devis versions
ALTER TABLE public.devis_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devis_versions_policy" ON public.devis_versions
    FOR ALL USING (devis_id IN (SELECT id FROM public.devis WHERE atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid())));

-- SMS logs
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_logs_policy" ON public.sms_logs
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Predictions
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_policy" ON public.predictions
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- Stats projets historique
ALTER TABLE public.stats_projets_historique ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_projets_historique_policy" ON public.stats_projets_historique
    FOR ALL USING (atelier_id IN (SELECT atelier_id FROM public.users WHERE id = auth.uid()));

-- ============================================
-- TRIGGERS UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_grilles_tarifaires_updated_at ON public.grilles_tarifaires;
CREATE TRIGGER update_grilles_tarifaires_updated_at BEFORE UPDATE ON public.grilles_tarifaires FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tarifs_clients_updated_at ON public.tarifs_clients;
CREATE TRIGGER update_tarifs_clients_updated_at BEFORE UPDATE ON public.tarifs_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_racks_updated_at ON public.racks;
CREATE TRIGGER update_racks_updated_at BEFORE UPDATE ON public.racks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_equipements_updated_at ON public.equipements;
CREATE TRIGGER update_equipements_updated_at BEFORE UPDATE ON public.equipements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prestations_updated_at ON public.prestations;
CREATE TRIGGER update_prestations_updated_at BEFORE UPDATE ON public.prestations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunites_updated_at ON public.opportunites;
CREATE TRIGGER update_opportunites_updated_at BEFORE UPDATE ON public.opportunites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Types de défauts par défaut (seront créés pour chaque atelier via l'application)
-- Pas besoin de les insérer ici car chaque atelier aura les siens

COMMENT ON TABLE public.grilles_tarifaires IS 'Grilles tarifaires pour calcul automatique des prix';
COMMENT ON TABLE public.racks IS 'Racks et palonniers pour accrochage des pièces';
COMMENT ON TABLE public.controles_qualite IS 'Contrôles qualité par étape de production';
COMMENT ON TABLE public.pointages IS 'Pointage des temps par projet et par étape';
COMMENT ON TABLE public.equipements IS 'Équipements (fours, cabines) pour planning';
COMMENT ON TABLE public.prestations IS 'Catalogue des prestations avec tarifs';
COMMENT ON TABLE public.interactions_client IS 'Historique CRM des interactions clients';
COMMENT ON TABLE public.opportunites IS 'Pipeline commercial des opportunités';
COMMENT ON TABLE public.sms_logs IS 'Historique des SMS envoyés via Twilio';
COMMENT ON TABLE public.predictions IS 'Prédictions IA pour délais et anomalies';
