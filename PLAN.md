# Cahier des charges fonctionnel (SaaS)  
## ThermoGestion + ThermoGestion Jantes  
Version: v1.3 (finalisé - prêt production)
Stack cible (info de contexte): **Supabase** (DB/Auth/Storage) + **Vercel** (déploiement web).  
Communication: **Email uniquement** (pas de SMS).
Performance attendue: **10-100 projets/jour** selon taille des centres (1 atelier = 1 client SaaS).

---

## 1) Vision produit

### 1.1 Nom & déclinaisons
- **ThermoGestion** (noyau commun): logiciel de gestion pour professionnels du thermolaquage.
- **ThermoGestion Jantes** (module/variation): mêmes bases, avec fonctionnalités dédiées rénovation de jantes.

### 1.2 Objectifs
- Accélérer la création de devis en face du client.
- Assurer une traçabilité "atelier" (étapes, photos, cuisson, couches, QC).
- Optimiser la production via **regroupement strict par poudre identique** (teinte + finition + type + référence).
- Simplifier la gestion des stocks de poudre (théorique vs pesées réelles) sans inventaires "journée complète".
- Professionnaliser l'expérience client (portail + emails automatiques + documents PDF).
- Ajouter la couche **Jantes**: prêt véhicule, fiche jante, process et tarification adaptés.

---

## 2) Périmètre & principes clés

### 2.1 Multi-entreprises (multi-ateliers)
- Un compte = **un atelier** (tenant).
- Chaque atelier a ses réglages, ses clients, ses projets, ses stocks.
- Gestion multi-utilisateurs avec rôles.

### 2.2 Email uniquement
- Tous les scénarios de notifications se font par **email**.
- **OAuth Gmail/Outlook**: l'atelier connecte son compte Gmail ou Outlook pour les envois (gratuit, pas de limite).
- **Autres options possibles**: SMTP classique (serveur mail de l'atelier), SendGrid/Mailgun (si préféré).
- Templates emails en **MJML** ou **HTML** (responsive).
- Queue d'envoi: **Bull + Redis** (ou alternative Serverless) pour garantir la livraison.

### 2.3 Série / regroupement "STRICT"
- Même **poudre exacte** obligatoire:
  - même **référence poudre** (ou ID poudre interne)
  - même type (époxy/polyester/etc.)
  - même finition (mat/satin/brillant/texture/metallic…)
  - mêmes couches + options primaire/vernis
  - cuisson compatible
- Exemple: RAL 7016 brillant ≠ RAL 7016 mat (donc regroupement interdit).

### 2.4 Étiquettes atelier
- Gestion étiquette par **QR Code** ou **numéro de pièce** (adapté aux papiers qui passent au four).
- Scan QR / saisie numéro = accès direct à la pièce/projet en "Mode Atelier".
- **Mode offline**: connexion/synchronisation automatique quand réseau disponible (tablette/phone atelier).

---

## 3) Utilisateurs & rôles

### 3.1 Rôles (atelier)
- **Owner**: tout accès, facturation SaaS, réglages. **2FA obligatoire** (authentification à deux facteurs).
- **Admin**: gestion utilisateurs, réglages, projets, stock, CRM. **2FA recommandé**.
- **Opérateur**: mise à jour étapes, photos, séries, pesées.
- **Compta**: devis/factures/paiements/exports.
- **Client final**: accès portail (lecture + docs + confirmation éventuelle).

### 3.2 Journal d'audit (obligatoire)
Tracer: qui a fait quoi, quand, sur quelles données (modifs critiques):
- statuts/étapes, cuisson, poudre, couches
- ajout/suppression photo
- correction stock, pesée
- création/édition séries (batch)
- génération/envoi devis/facture

---

## 4) Parcours (User Journeys) principaux

### 4.1 Onboarding atelier (Owner/Admin)
1. Créer compte atelier
2. **Consentement RGPD**: validation CGU, politique de confidentialité, traitement des données.
3. Choisir plan: **Lite** ou **Pro** (avec options équipement/fonctionnalités).
4. **Essai gratuit 30 jours en mode Pro complet** avec **onboarding guidé** (tutoriels, tips, notifications J+7, J+15, J+25 pour conversion).
5. Choisir: ThermoGestion (core) + activer ou non ThermoGestion Jantes
6. Paramétrer: marges, taux horaire, taxes, workflows, modèles email, règles stock
7. Configurer email: OAuth Gmail/Outlook ou SMTP
8. Ajouter utilisateurs
9. **Import CSV clients** (optionnel): détection automatique doublons, email d'invitation personnalisé aux clients existants.
10. Importer/ajouter les poudres (Thermopoudre par référence + concurrents)

### 4.2 Devis live -> Projet -> Livraison
1. Rechercher client (ou créer nouveau)
2. Créer devis (dimensions/surface, poudre, couches, cuisson, coûts, marge)
3. Générer PDF avec **signature électronique** (obligatoire, horodatage)
4. Envoyer devis:
   - nouveau client: lien création compte + devis en PJ
   - client existant: "devis dans l'espace" + PJ
5. Devis accepté -> conversion en projet
6. Suivi atelier: étapes + photos + QC + rapport final
7. "Prêt" -> email client
8. Paiement client final (acompte/solde) + facture
9. Statut final: livré/récupéré

### 4.3 Stock intelligent sans inventaire complet
1. Stock théorique décrémenté par projets/séries
2. Le système propose chaque jour une liste courte "à peser"
3. L'atelier pèse (poids brut - tare carton) -> stock réel mis à jour
4. Réconciliation: calcul écart, score fiabilité
5. Planification d'inventaires partiels (période intensive) sans bloquer une journée complète
6. Suggestion de réapprovisionnement

---

## 5) Modules fonctionnels (noyau ThermoGestion)

### 5.1 CRM (Clients)
**Fonctions**
- Fiche client: coordonnées, type (pro/particulier), tags, notes.
- Historique: devis, projets, factures, paiements.
- Journal d'interactions: appels, emails, rendez-vous, notes.
- **Détection doublons**: email, téléphone, nom + prénom (critères paramétrables).
- **Import CSV clients**:
  - Format standardisé (email, nom, prénom, téléphone, adresse, type...).
  - Détection automatique doublons avant import.
  - Email d'invitation automatique personnalisé aux clients importés:
    - Template: "Votre atelier [Nom Atelier] utilise un nouveau système de gestion et facturation..."
    - Lien création compte portail client.
    - Message de bienvenue professionnel.

**Options**
- Export CSV clients
- Relance devis non signé (J+2 / J+7) par email

---

### 5.2 Devis métier (live)
**Entrées**
- Dimensions / surface (mode simple) + option "calcul surface avancé" (plus tard).
- Choix poudre (référence exacte) + finition + type.
- Couches: 1/2/3 + primaire + vernis (options).
- Temps de cuisson recommandé (lié à la poudre) + ajustement si besoin.
- Coûts: poudre (€/kg), main d'œuvre (min + taux), consommables/énergie (option).
- Marge paramétrable: % poudre + % MO + forfait.

**Templates devis 100% personnalisables**
- **4-5 templates préconçus** (moderne, classique, minimaliste, premium...).
- **Éditeur visuel (form builder gratuit, par zones)** pour personnalisation totale:
  - **Solutions**: React JSON Forms, Formik + Yup, ou développement custom simple (zones configurables)
  - **Configuration par zones** (pas drag & drop): zones pré-définies modifiables (en-tête, corps, pied de page, conditions)
  - Logo atelier (upload)
  - Couleurs (palette personnalisée, picker couleur)
  - CGV personnalisées (éditeur texte riche/HTML)
  - Mise en page: zones configurables (largeur colonnes, espacement, position éléments)
  - Conditions de vente, mentions légales (zones dédiées)
  - Champs dynamiques (variables: {nom_client}, {date}, {montant}, etc.)
- Chaque atelier peut créer/sauvegarder plusieurs templates.
- Templates par défaut proposés pour accélérer la configuration.
- **Pas de marketplace templates** (partage entre ateliers non prévu V2).

**Sorties**
- PDF devis (numéro auto, conditions, détails techniques) depuis template choisi.
- **Signature électronique obligatoire**:
  - Image signature simple intégrée
  - Validation "signé électroniquement" avec horodatage dans PDF
  - Client peut signer dans portail (dessin ou upload image), pas de refus possible
  - Journal signatures (qui, quand, IP) pour traçabilité légale
- Statuts: brouillon / envoyé / accepté / refusé.
- Conversion en projet.

**Emails devis**
- Nouveau client:
  - email invitation création compte + devis PDF en PJ
- Client existant:
  - email "devis sur espace client" + PJ

---

### 5.3 Projets & suivi par étapes (atelier)
**Fonctions**
- Projet: dates dépôt, date promise, usage final, priorité.
- Workflow configurable par atelier (étapes).
- Validation étape par opérateur.
- **Photos avant/après + annotations**:
  - **Stockage**: Supabase Storage (S3-compatible).
  - **Quota par défaut**: **20 GB par atelier** à l'inscription (dashboard gestionnaire admin pour suivi).
  - **Compression intelligente**: 
    - **Stockage**: compression optimisée (WebP avec fallback JPG, ~500KB-2MB selon qualité)
    - **Affichage**: version haute qualité générée automatiquement (transformation serveur)
    - **Client + atelier**: affichage haute résolution depuis Supabase (resize à la volée selon viewport)
    - **Original préservé**: sauvegarde version originale + versions optimisées multiples (thumbnail, medium, large)
  - **Taille max recommandée**: 5-10 MB par photo upload (compression réduit à ~500KB-2MB pour stockage).
  - **Gestion automatique**: 
    - **Suppression auto photos**: à partir de **90% du quota**, suppression automatique des photos des projets les plus anciens (photos uniquement, projets conservés)
    - Pas de suppression manuelle (garder traçabilité), archivage optionnel après X mois
  - **Quota storage**: limite configurable par atelier dans backoffice éditeur (gestion coûts).
  - Watermark optionnel (logo atelier, paramétrable).
- Paramètres enregistrés sur le projet:
  - poudre utilisée (réf exacte)
  - couches (1/2/3) + primaire/vernis
  - cuisson (temp/durée)
- Contrôle qualité (checklist paramétrable).
- Génération rapport final PDF (traçabilité complète).

**Email client**
- Email "prêt à récupérer" (avec lien portail, pièces jointes optionnelles: photo haute qualité, rapport).
- **Notifications**: clients finaux par **email uniquement** (pas de push notifications).

---

### 5.4 Retouches / Non-conformités (NC)
**Fonctions**
- Déclarer une NC à une étape:
  - type de défaut (liste paramétrable)
  - photo
  - commentaire
  - action corrective
- Réintégrer le projet dans une étape précédente ou étape "Retouche".
- Statistiques NC: taux, causes, poudre/finition les plus liées, délais induits.

---

### 5.5 Séries (regroupement strict par poudre)
**Fonctions**
- Vue "Séries recommandées":
  - par poudre exacte (référence + finition + type)
  - nombre de projets/pièces
  - urgence (date promise)
  - estimation conso
- **Optimisation taille four**:
  - L'atelier configure sa taille de four (dimensions L × l × H)
  - Le système suggère l'optimisation des pièces dans les séries
  - Prise en compte des contraintes: **pièces ne peuvent pas être collées**, taille crochet, marge de sécurité
  - Visualisation 3D/2D si possible (option V2) ou suggestion texte
- **Planification de cuisson**: suggestion d'ordre de cuisson selon urgence et optimisation espace.
- Création d'une série (batch):
  - ajouter/retirer des projets/pièces
  - impression étiquettes de série
- Lancement série -> mise à jour statuts
- Clôture série -> étape suivante (cuisson/QC selon process)

**Règle clé**
- Interdiction de regroupement si:
  - même RAL mais finition différente
  - référence poudre différente
  - couches/options différentes

---

### 5.6 Catalogue poudres (Thermopoudre + concurrents)
**Fonctions**
- **Module PrestaShop Thermopoudre**: 
  - Site Thermopoudre est sur PrestaShop (pas d'API REST/GraphQL).
  - **Développement module PrestaShop** pour exposer les données poudres (référence, type, RAL, finition, densité, cuisson, formats...).
  - Endpoint API ou webhook depuis le module vers ThermoGestion.
  - Auto-remplissage: saisie référence Thermopoudre -> import automatique des champs.
- Poudres concurrentes: ajout manuel avec mêmes champs.
- Champs poudre:
  - marque, type, RAL, finition
  - densité
  - épaisseur conseillée
  - consommation moyenne au m²
  - paramètres cuisson recommandés
  - formats (kg) + tare carton (kg) par marque/format

---

### 5.7 Stock poudre: théorique + pesées + inventaire partiel
**Fonctions**
- Stock théorique décrémenté:
  - par projet
  - par série (batch)
- Pesée carton:
  - poids brut - tare = poudre restante
  - mise à jour stock réel
  - historique des pesées
- Réconciliation:
  - écart théorie vs réel
  - score de fiabilité par poudre
- Notifications "à peser":
  - basées sur usage récent + aléatoire contrôlé
  - liste courte quotidienne (ex 3 références)
- Inventaire partiel planifiable:
  - choisir période intensive
  - liste ciblée: poudres les plus utilisées + poudres "à risque"
- Suggestions d'achat:
  - prévision rupture selon usage
  - quantités recommandées

---

### 5.8 Portail client final
**Fonctions**
- Liste des projets
- Détail projet:
  - étapes, dates, photos haute qualité (selon réglages atelier)
  - documents: devis, facture, rapport
  - **Signature électronique**: possibilité signer devis/facture (image signature simple, obligatoire)
- Option confirmation récupération/livraison (bouton ou code)
- **Avis Google**: 
  - Email automatique **J+3** après récupération (paramétrable par client atelier)
  - **API Google My Business** (tracking avis laissé, pas juste lien direct)
  - Relance automatique si non donné (date paramétrable en BO par atelier)
  - Workflow: email J+X → relance J+Y si pas d'avis (X et Y configurables)
  - **Pas d'autres plateformes** (Trustpilot, Avis Vérifiés non prévu V2)

---

### 5.9 Reporting & pilotage
**Dashboards (KPIs prioritaires)**

- **Devis**:
  - Taux de transformation devis (devis envoyés → acceptés)
  - Délais acceptation moyen
  - Panier moyen (montant moyen par devis)
  - Nombre devis par période (jour/semaine/mois)

- **Production**:
  - Délais moyens (dépôt → livraison)
  - Retards (nombre projets en retard, %)
  - Throughput (nombre projets livrés/jour/semaine)
  - Taux de remplissage (utilisation capacité)

- **Poudres**:
  - Top teintes/finition (les plus utilisées)
  - Consommation par poudre (kg/mois)
  - Tendance consommation (graphiques évolution)

- **Stock**:
  - Risques rupture (alertes poudres en stock faible)
  - Fiabilité stock (écarts théorie vs réel, score)

- **Qualité**:
  - Taux NC/retouches (% projets avec retouches)
  - Causes principales de retouches (graphiques)
  - Poudres/finitions les plus liées aux retouches

- **Financier**:
  - **CA/mois** (Chiffre d'Affaires mensuel)
  - Paiements (encaissements, délais paiement)
  - Impayés (montant, nombre, ancienneté)
  - Acomptes vs soldes (ratio)
  - Évolution CA (graphiques tendance)

---

## 6) ThermoGestion Jantes (module dédié - V2 avec structure base MVP)

### 6.1 Structure base (MVP)
- **Préparation architecture**: structure BDD de base pour faciliter ajout module Jantes V2
- Tables: jantes, véhicules_prêt (structure préparée, non utilisée MVP/V1)

### 6.2 Fiche jante (métier) - V2
- Marque/modèle/année véhicule (option)
- Taille / infos jante (option)
- État / dommages / notes
- Photos avant/après (spécifiques jante)
- Recette jante (process prérempli)

### 6.3 Tarification pro/particulier - V2
- Grilles prix distinctes
- Acompte recommandé par défaut (paramétrable)
- Options (réparation + finition + vernis etc.)

### 6.4 Véhicules de prêt - V2
- Gestion parc (fiche véhicule)
- **Intégration calendrier double**:
  - **Calendrier custom intégré** dans l'app (vue principale)
  - **Synchronisation bidirectionnelle** avec Google Calendar et/ou Outlook Calendar (option)
  - Création/modification depuis ThermoGestion → sync vers Google/Outlook
  - Modifications Google/Outlook → sync vers ThermoGestion (webhook ou polling)
- **Vue calendrier**: **hebdomadaire** (vue principale recommandée), mensuelle et liste disponibles
- Planning attribution, réservations, disponibilités
- État entrée/sortie + photos
- Dépôt de garantie/caution (suivi)
- Assurance/gestion dommages: **non géré** (hors périmètre, gestion externe).
- (Option V2) contrat PDF + signature

### 6.5 Base teintes jantes (option) - V2
- **Connexion ThermoJantes** (outil à développer séparément):
  - Base de données jantes avec recherche par modèle de voiture pour trouver les jantes.
  - API/endpoint pour intégration avec ThermoGestion Jantes.
  - Mise à jour synchronisée des données.
- Recherche teinte OEM si dataset disponible
- Mapping vers poudres (si possible)
- Lien vers produits Thermopoudre (si mapping)

---

## 7) Paiements (2 niveaux)

### 7.1 Abonnement SaaS (tes clients = ateliers)
**Choix validés**
- **1 abonnement par atelier**
- **1 mois d'essai gratuit** (mode Pro complet pour conversion maximale)
- **Plans**: **Lite** et **Pro** (avec options équipement/fonctionnalités)
- **Utilisateurs illimités** (pas de limite par plan)
- Gestion complète abonnement/factures

**Fonctions nécessaires**
- Plans:
  - **Lite**: fonctionnalités core (devis, projets, stock basique, CRM)
  - **Pro**: core + options avancées (reporting avancé, intégrations, module Jantes, stock intelligent complet...)
  - Options additionnelles: modules spécifiques, fonctionnalités premium
  - Différenciation par fonctionnalités, pas par nombre d'utilisateurs
- Essai gratuit 30 jours en **mode Pro complet** (toutes fonctionnalités) pour attirer client
  - **Notifications conversion**: J+7, J+15, J+25 (emails automatiques pour encourager conversion)
  - **Onboarding guidé**: tutoriels, tips, parcours découverte fonctionnalités
- Upgrade/downgrade (prorata si choisi)
- Factures SaaS (PDF, TVA, infos atelier)
- Relances impayés + suspension accès après X jours (paramétrable)
- Résiliation (fin de période)
- Page "Mon abonnement" (atelier)

**Backoffice éditeur (toi - accès admin exclusif)**
- **Accès**: **uniquement toi** (gestionnaire/admin unique)
- **Onglet Paramètres SaaS** pour gestion complète:
  - **Prix plans**: tarifs Lite/Pro modifiables en temps réel
  - **Durée période essai**: paramétrable (par défaut 30 jours)
  - **Limites storage photos**: quota par atelier modifiable (gestion coûts Supabase)
  - **Fonctionnalités par plan**: activation/désactivation features
  - **Options additionnelles**: ajout/modification options payantes
  - **Historique modifications prix/règles**: logs complets (qui, quand, quoi modifié)
- **Email automatique aux ateliers** si modification prix (notification obligatoire)
- Liste ateliers (filtres, recherche, stats)
- Statut abonnement par atelier
- MRR (Monthly Recurring Revenue), churn, taux conversion
- Support: accès "impersonate" (option V2) pour débogage/support

**Dashboard gestionnaire admin** (vue complète)
- **Vue d'ensemble**:
  - Nombre total ateliers (actifs, essai, suspendus)
  - MRR global, churn mensuel, taux conversion
  - Répartition plans (Lite vs Pro)
- **Gestion storage photos**:
  - **Quota par défaut**: 20 GB par atelier à l'inscription
  - Suivi usage storage par atelier (GB utilisés, %, alertes)
  - Détection ateliers proche limite (80%, 90%)
  - **Suppression auto**: déclenchement automatique à 90% (photos projets anciens)
  - Possibilité ajout stockage supplémentaire si besoin (gestion manuelle)
- **Gestion prix/quota**:
  - Modification prix plans en temps réel
  - Modification quotas storage par atelier
  - Historique toutes modifications (logs audit complets)
- **Monitoring**:
  - Performances système (temps réponse, erreurs)
  - Coûts Supabase/Vercel par atelier (si possible)
  - Alertes critiques (suspensions, impayés, quotas dépassés)

> Implémentation probable: **Stripe Billing** (recommandé pour abonnements).  
> (PayPal possible selon intégration choisie, mais Stripe Billing couvre très bien l'abonnement.)

---

### 7.2 Paiement client final (clients de tes ateliers)
**Choix validés**
- **Lien de paiement Stripe**
- Option PayPal (si souhaité)
- Option prélèvement SEPA **GoCardless**
- Gestion **acompte obligatoire/activable** (validé: oui)

**Fonctions nécessaires**
- Sur devis/projet:
  - montant total
  - acompte (montant fixe ou %)
  - solde
  - statuts: non payé / acompte payé / payé / remboursé
- Lien de paiement:
  - générer lien acompte
  - générer lien solde
  - envoyer par email au client
- Paiement en atelier:
  - saisie manuelle (CB/espèces/virement)
  - justificatif (option)
- **Facture client final**:
  - **Numérotation automatique** (format paramétrable: FACT-YYYY-NNNN, etc.).
  - **TVA France et EU** (gestion taux, TVA récupérable, exonérations).
  - Générée depuis projet/devis
  - **Facturation électronique** (conformité réglementaire France/EU, format UBL/XML si requis).
  - **Signature électronique**: image signature simple intégrée (obligatoire, horodatage, journal signatures).
  - **Connexion Pennylane** (option): 
    - Export/synchronisation comptabilité via API Pennylane
    - Mapping comptes automatique
    - Export FEC comptable (Fichier des Écritures Comptables) pour conformité France
  - **Exports**:
    - **CSV** (format standard pour tableurs)
    - **FEC comptable** (format XML, obligatoire France depuis 2014)
      - **Archivage automatique**: conservation 10 ans (durée légale France)
      - **Export mensuel automatique**: vers espace sécurisé optionnel (S3, Storage externe)
    - **API Pennylane**: synchronisation directe si compte connecté
  - Envoyée + dispo portail
- (Option) remboursement / avoir

---

## 8) Écrans attendus (liste fonctionnelle)
1. Connexion / choix atelier
2. Dashboard (bureau)
3. Mode Atelier (tablette):
   - file du jour
   - scan étiquette (QR/numéro)
   - étapes rapides + photo
   - séries recommandées
4. Clients (liste + fiche)
5. Devis:
   - création / édition / PDF / envoi
6. Projets:
   - liste filtrable
   - fiche projet + pièces + étapes + photos + QC
7. Séries (batch):
   - recommandations
   - fiche série + impression
8. Poudres:
   - catalogue + import Thermopoudre + concurrents
9. Stock:
   - niveaux + pesée + suggestions + inventaire partiel planifié
10. Paiements:
   - encaissements client final (acompte/solde)
11. Factures:
   - SaaS (atelier)
   - clients finaux (atelier)
12. Portail client final:
   - projets + documents
13. Réglages atelier:
   - marges, workflows, emails, stock, paiements, avis Google (délai J+X paramétrable)
14. **Admin éditeur (toi - backoffice SaaS)**:
   - dashboard gestionnaire admin (vue complète: ateliers, storage, prix, monitoring)
   - onglet paramètres SaaS (prix plans, période essai, quotas storage)
   - ateliers, abonnements, support (V2)
   - statistiques globales (MRR, churn, conversion)
   - logs audit modifications prix/quota

---

## 9) Priorisation (MVP -> V1 -> V2)

### MVP (livrable initial)
- Compte atelier + rôles
- CRM basique
- Devis live + PDF + emails nouveau/existant + signature électronique (obligatoire, horodatage)
- Projets + étapes + photos (quota 20 GB, suppression auto à 90%)
- Étiquettes (numéro + option QR) + impression PDF
- Catalogue poudres + import Thermopoudre + concurrent
- Stock théorique + pesée (tare par marque/format) + historique
- Séries strictes (batch) basiques
- Journal d'audit
- **Structure base module Jantes** (BDD préparée pour V2)

### V1 (production solide)
**Application SaaS**
- Portail client final
- Inventaire partiel planifié + suggestions quotidiennes "à peser"
- Retouches/NC + stats
- **Avis Google**: workflow automatique J+3 (API Google My Business, tracking)
- **Notifications push** (atelier uniquement, web push natif) + emails
- **Signature électronique** complète (obligatoire, horodatage, journal signatures)
- Paiement client final: Stripe payment links + acompte/solde + statuts
- Factures client final + exports (CSV, FEC comptable avec archivage auto 10 ans, API Pennylane)
- **Dashboard gestionnaire admin** complet

**Infrastructure & Qualité**
- **Rate limiting**: protection sécurité par utilisateur/atelier
- **Feature flags**: déploiement progressif, A/B testing
- **Data retention**: politique RGPD complète (suppression auto, exports)
- **Changelog public**: transparence évolutions produit
- **Monitoring avancé**: dashboard erreurs, alertes proactives
- **Portabilité données**: export complet atelier (CSV/JSON)

**Site vitrine**
- **Blog / Ressources**: articles métier, guides, SEO
- **Optimisation conversion**: A/B testing, landing pages dédiées

### V2 (extension jantes & premium)
- ThermoGestion Jantes complet:
  - fiche jante, recettes jantes, tarification pro/part
  - véhicules de prêt + planning (calendrier custom + sync Google/Outlook, vue hebdomadaire)
- Paiement SEPA GoCardless (B2B) + option PayPal
- Reporting avancé + backoffice éditeur complet
- Contrat prêt véhicule PDF + signature (option)
- **Multi-langue**: traduction automatique (anglais, espagnol, italien, choix langues actives par atelier)

---

## 10) Critères d'acceptation (exemples "métier")
- Devis:
  - Nouveau client => email création compte + devis PJ
  - Client existant => email espace + devis PJ
  - Signature électronique obligatoire (horodatage, journal)
- Série:
  - Même RAL mais finition différente => impossible de regrouper
- Stock:
  - Pesée met à jour stock réel (brut - tare) + log
  - Système propose une liste courte quotidienne à peser
- Atelier:
  - Scan QR ou saisie numéro pièce => accès direct au bon projet
- Paiement client final:
  - acompte + solde avec statuts cohérents + facture liée
- Audit:
  - toutes actions critiques laissent une trace consultable
- Photos:
  - Quota 20 GB par défaut, suppression auto photos anciennes à 90%
- Prix/quota:
  - Modifications prix/quota => email automatique atelier + log audit

---

## 11) Architecture technique & sécurité

### 11.1 Stack technique
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Frontend**: Framework moderne (Next.js recommandé pour Vercel)
- **Déploiement**: Vercel (Serverless Functions)
- **Design System**: **Tailwind CSS** recommandé (rapide, customisable, moderne, parfait pour SaaS B2B)
- **UI Components**: Shadcn/ui ou Headless UI (accessibles, Tailwind-compatible)
- **Thème**: Mode clair/sombre (switcher utilisateur), personnalisable par atelier (couleurs marque)

### 11.2 Isolation données (Multi-tenancy)
- **Row Level Security (RLS) dans Supabase**: 
  - Chaque ligne de données est isolée par `workspace_id` (tenant_id).
  - Politique RLS garantit qu'un atelier ne voit que ses données.
  - Tests d'isolation obligatoires avant mise en prod (scripts automatisés).
- **Authentification**: Supabase Auth avec JWT tenant-aware.
- **2FA (Authentification à deux facteurs)**: 
  - **Obligatoire** pour Owners et Admins (TOTP via app type Google Authenticator).
  - Optionnel pour autres rôles.

### 11.3 Conformité RGPD
- **Consentement utilisateur**:
  - Validation CGU et politique de confidentialité à l'inscription.
  - Consentement explicite traitement données clients.
- **Droits utilisateurs**:
  - Droit à l'oubli (suppression données client sur demande).
  - Export données (format structuré JSON/CSV).
  - Accès et rectification des données.
- **Portail client**: consentement affichage photos/documents dans portail (paramétrable par atelier).
- **Audit log**: traçabilité des accès/modifications conformes RGPD.
- **DPO (Délégué à la Protection des Données)**: identification si requis (selon taille/activité).

### 11.4 Sauvegardes & résilience
**Recommandations**:
- **Sauvegardes automatiques**: Supabase propose sauvegardes quotidiennes (configurable fréquence).
- **Sauvegarde continue**: Point-in-Time Recovery (PITR) si disponible Supabase.
- **Retention**: 30 jours minimum (recommandé 90 jours pour SaaS).
- **RPO (Recovery Point Objective)**: 24h max (sauvegarde quotidienne).
- **RTO (Recovery Time Objective)**: 4-8h (temps de restauration acceptable).
- **Tests de restauration**: mensuels (vérifier intégrité).
- **Backup supplémentaire**: export mensuel vers S3/Storage externe (optionnel, redondance).
- **FEC comptable**: archivage automatique 10 ans (durée légale France), export mensuel auto vers espace sécurisé optionnel.

### 11.5 Performance & scalabilité
- **Optimisations**:
  - Pagination obligatoire (listes projets, clients, devis).
  - Cache côté serveur (Redis/Supabase Edge Functions cache).
  - Indexation base de données (index sur `workspace_id`, `created_at`, statuts fréquents).
  - Lazy loading images (photos projet).
  - CDN pour assets statiques (Vercel Edge Network).
- **Monitoring**: 
  - Logs Supabase + Vercel Analytics.
  - Alertes performances (temps réponse, erreurs).
- **Scalabilité**: architecture Serverless auto-scalable (Vercel + Supabase).

### 11.6 Support & documentation
- **Système de tickets**: intégration Intercom, Zendesk, ou custom (chat widget).
- **Chat en direct**: optionnelle (Intercom, Crisp, ou chat custom).
- **Documentation utilisateur**: 
  - Guides vidéos/écrans (portail dédié).
  - FAQ interactive.
  - Aide contextuelle (tooltips, modals).

### 11.7 Responsive & offline
- **Responsive obligatoire**: 
  - Desktop (bureau gestion)
  - Tablet (mode atelier, optimisation tactile)
  - Mobile (consultation, notifications)
- **Mode offline**:
  - **Service Worker + IndexedDB** pour stockage local temporaire.
  - Synchronisation automatique quand réseau disponible.
  - Priorité: mode atelier (tablette), photos projets, étapes validation.
  - Gestion conflits (dernière écriture gagne ou merge manuel).

### 11.8 Accessibilité (WCAG 2.1 AA)
**WCAG (Web Content Accessibility Guidelines)**: standards internationaux accessibilité web.
- **Niveau AA requis** pour SaaS B2B (conformité légale France).
- **Critères clés**:
  - Contraste couleurs (ratio 4.5:1 texte).
  - Navigation clavier (tab, entrée, échap).
  - Screen readers (ARIA labels, structure sémantique).
  - Images avec texte alternatif.
  - Formulaires accessibles (labels, erreurs claires).
- **Tests**: audits automatisés (axe-core, Lighthouse) + tests manuels.

---

## 12) Notes importantes / décisions prises
- SMS supprimé (email uniquement)
- Regroupement strict: par poudre exacte (réf + finition + type)
- **Plans**: Lite et Pro (utilisateurs illimités, différenciation par fonctionnalités)
- **Essai gratuit**: 30 jours en mode Pro complet avec onboarding guidé + notifications conversion (J+7, J+15, J+25)
- Paiement client final: Stripe liens + option PayPal + option GoCardless
- Gestion acompte: oui
- **Facturation**: TVA FR/EU, numérotation auto, facturation électronique, connexion Pennylane
- **Templates devis**: 4-5 templates 100% personnalisables (React JSON Forms/Formik+Yup/custom, configuration par zones)
- **Import CSV clients**: détection doublons, email invitation automatique
- **Module PrestaShop Thermopoudre**: développement module pour auto-remplissage poudres
- **Optimisation séries**: taille four configurable, suggestion optimisation (contraintes crochet/marge)
- **Photos**: compression intelligente stockage + affichage haute qualité, **quota 20 GB par défaut**, suppression auto photos anciennes à 90%
- **Emails**: OAuth Gmail/Outlook (gratuit), templates MJML/HTML, queue Bull+Redis
- **Notifications**: **push uniquement atelier** (web push natif), clients finaux par email uniquement
- **2FA**: obligatoire Owners/Admins
- **RGPD**: conformité complète (consentements, droits utilisateurs, DPO si requis)
- **RLS Supabase**: isolation données multi-tenant (tests obligatoires)
- **Sauvegardes**: quotidiennes, retention 30-90 jours, tests mensuels restauration
- **FEC comptable**: archivage auto 10 ans, export mensuel auto vers espace sécurisé optionnel
- **Design System**: Tailwind CSS (recommandé)
- **Responsive obligatoire**: desktop/tablet/mobile
- **Mode offline**: Service Worker + IndexedDB, sync auto
- **Accessibilité**: WCAG 2.1 AA (niveau légal)
- **Support**: tickets + chat + documentation complète
- **Signature électronique**: intégration simple (image signature), **obligatoire**, validation "signé électroniquement" avec horodatage, journal signatures (qui, quand, IP)
- **Avis Google**: workflow automatique J+3 (API Google My Business avec tracking), relance auto configurable
- **Exports**: CSV, FEC comptable (archivage 10 ans), API Pennylane
- **Calendrier véhicules de prêt**: custom + sync Google Calendar/Outlook (vue hebdomadaire) - V2
- **Multi-langue**: V2 avec traduction automatique (anglais, espagnol, italien, choix langues actives par atelier)
- **Backoffice éditeur SaaS**: accès exclusif gestionnaire, dashboard complet, logs audit modifications prix/quota, email auto si modification prix
- **Dashboard gestionnaire admin**: vue complète (ateliers, storage 20 GB par défaut, prix, monitoring)
- **Module Jantes**: structure base dans MVP, développement complet V2
- **ThermoJantes**: connexion avec base données jantes (outil séparé) - V2
- Déploiement: Supabase + Vercel (contexte)
- **Performance**: 10-100 projets/jour par atelier

---

## 13) Multi-langue (V2)

### Stratégie traduction
- **MVP/V1**: français uniquement (priorité marché France)
- **V2**: multi-langue avec traduction automatique
  - **Traduction automatique**: utiliser service type Google Translate API ou DeepL
  - **Langues prioritaires**: anglais, espagnol, **italien** (selon expansion géographique)
  - Interface traduite automatiquement
  - Contenu utilisateur (devis, factures, emails): traduction à la demande ou manuelle selon préférence atelier
  - **Choix langues actives**: chaque atelier peut activer/désactiver langues disponibles (paramétrable)
  - Détection langue préférée client (paramétrable)

### Fonctionnalités V2
- Sélection langue dans paramètres utilisateur
- Traduction emails automatique (selon langue préférée client)
- Documentation multi-langue
- Interface adaptative selon langue sélectionnée

---

## 14) Fonctionnalités avancées confirmées

### Notifications
- **Emails**: OAuth Gmail/Outlook (gratuit), templates MJML/HTML, queue Bull+Redis
- **Push notifications**: **uniquement atelier** (web push natif gratuit, pas service tiers)
  - Nouveau devis, projet prêt, facture disponible, retards, etc.
  - Paramétrables par utilisateur (préférences notifications)
  - **Clients finaux**: notifications par **email uniquement** (pas de push)
  - Combinaison email + push pour meilleure visibilité (atelier)

### Signature électronique
- **Intégration simple**: image signature (pas DocuSign/Yousign)
- **Obligatoire**: client ne peut pas refuser (pas d'option impression/physical)
- Client peut signer directement dans portail (dessin signature ou upload image)
- Atelier peut signer pour client (impression → signature → scan)
- **Validation**: mention "signé électroniquement" avec horodatage dans PDF
- **Journal signatures**: stockage qui, quand, IP pour traçabilité légale (Supabase)
- Stockage signature dans Supabase Storage
- Intégration dans PDF devis/factures

### Exports comptabilité
- **Formats**:
  - **CSV** (format standard, compatible Excel/LibreOffice)
  - **FEC comptable** (Fichier des Écritures Comptables, format XML obligatoire France)
    - **Archivage automatique**: conservation 10 ans (durée légale France)
    - **Export mensuel automatique**: vers espace sécurisé optionnel (S3, Storage externe)
  - **API Pennylane**: synchronisation directe si compte connecté
- Export par période (mois, trimestre, année)
- Filtres: projets, clients, types paiement

---

## 15) Questions résolues / Décisions finales

### ✅ Résolues
1. **Prix plans Lite/Pro**: géré via backoffice éditeur (paramétrable en temps réel), accès exclusif gestionnaire
2. **Limites storage photos**: **20 GB par défaut par atelier**, dashboard gestionnaire admin, suppression auto photos anciennes à 90%
3. **Form builder devis**: React JSON Forms / Formik+Yup / custom (zones configurables), pas de marketplace
4. **Calendrier véhicules de prêt**: calendrier custom + sync Google Calendar/Outlook, vue hebdomadaire principale (V2)
5. **Notification avis Google**: J+3 de base (paramétrable par atelier), API Google My Business avec tracking, pas d'autres plateformes
6. **Statistiques avancées**: KPIs prioritaires définis (CA/mois, taux transformation, délais, retards, poudres, NC, financier)
7. **Export données**: CSV, FEC comptable (archivage 10 ans, export mensuel auto), API Pennylane
8. **V2 vs MVP**: module Jantes → V2 avec structure base dans MVP
9. **Intégrations tierces**: Pennylane (API), ThermoJantes (API), Google Calendar/Outlook (sync)
10. **Photos**: compression stockage + affichage haute qualité, quota 20 GB, suppression auto 90%
11. **Notifications**: push uniquement atelier (web push natif), clients finaux par email
12. **Signature**: intégration simple (image signature), obligatoire, horodatage, journal signatures
13. **Multi-langue**: V2 avec traduction automatique (anglais, espagnol, italien, choix langues actives par atelier)
14. **Backoffice éditeur**: accès exclusif gestionnaire, logs audit modifications, email auto si modification prix
15. **Dashboard gestionnaire admin**: vue complète avec toutes infos (ateliers, storage, prix, monitoring)
16. **Module Jantes**: structure base MVP, développement complet V2
17. **Essai gratuit**: notifications conversion J+7/J+15/J+25, onboarding guidé
18. **FEC comptable**: archivage auto 10 ans, export mensuel auto vers espace sécurisé optionnel

---

## 16) Éléments critiques manquants pour SaaS B2B professionnel

### 16.1 SLA (Service Level Agreement)
**Critique pour confiance B2B**

**Qu'est-ce qu'un SLA ?**
Le SLA (Service Level Agreement) est un **engagement contractuel** entre toi (fournisseur) et tes clients (ateliers) qui définit :
- **Le niveau de service garanti** (disponibilité, performance)
- **Les compensations** si tu ne respectes pas cet engagement
- **La transparence** sur la qualité du service

**Pourquoi c'est important ?**
- Les clients B2B ont besoin de **fiabilité** (leur activité dépend du service)
- Ça rassure et **augmente la confiance** (différenciation concurrentielle)
- Ça te protège **légalement** en définissant tes responsabilités

**Détails SLA ThermoGestion :**
- **Uptime garanti**: 
  - **Plan Lite**: 99.5% (≈ 3h36 de downtime/mois max)
  - **Plan Pro**: 99.9% (≈ 43 min de downtime/mois max)
- **Temps de réponse**: < 2s (95% des requêtes)
- **Maintenance planifiée**: 
  - Fenêtres horaires définies (ex: dimanche 2h-6h)
  - Notification préalable **48h** avant maintenance
  - Maintenance n'interrompt pas SLA (hors fenêtre = temps compté downtime)
- **Compensation si SLA non respecté**: **10% crédit facture** (tous plans)
  - Si uptime < 99.5% (Lite) ou < 99.9% (Pro)
  - Compensation proportionnelle (ex: 99.3% au lieu de 99.5% = 40% du crédit)
  - Crédit appliqué automatiquement sur prochaine facture
- **Page status**: page publique statut service (status.thermogestion.fr)
  - Affichage uptime en temps réel
  - Historique incidents
  - Maintenance planifiée visible
- **Incident management**: procédure gestion incidents, communication transparente
  - Communication incidents critiques aux ateliers (email + app) < 30 min
  - Mise à jour status page en temps réel
  - Post-mortem public si incident majeur (> 1h downtime)

### 16.2 Gestion erreurs & monitoring applicatif
**Essentiel pour qualité service**
- **Error tracking**: Sentry, Rollbar, ou LogRocket pour capture erreurs frontend/backend
- **Logs structurés**: niveaux (error, warn, info, debug), recherche par workspace_id
- **Alertes critiques**: email/SMS gestionnaire si erreurs > seuil (ex: 10 erreurs/min)
- **Dashboard erreurs**: taux erreurs par atelier, types erreurs, tendances
- **Stack traces**: conservation pour debug (anonymisation si données personnelles)
- **Recovery automatique**: retry automatique si erreur temporaire (timeout, réseau)

### 16.3 API publique & Webhooks
**Intégrations tierces & automation** (V2 - plus tard)
- **API REST publique** (V2):
  - Authentification API key par atelier
  - Rate limiting (1000 req/h par défaut, ajustable par plan)
  - Documentation OpenAPI/Swagger
  - Versioning API (/v1/, /v2/)
- **Webhooks** (V2):
  - Événements: devis créé/accepté, projet terminé, paiement reçu, stock bas
  - Sécurité: signature HMAC pour vérification
  - Retry automatique si webhook échoue
  - Logs webhooks (succès/échec)

### 16.4 Feature flags & déploiement progressif
**Déploiement sans risque**
- **Feature flags**: LaunchDarkly, Flagsmith, ou custom (Supabase config)
- **Rollout progressif**: activation fonctionnalités par pourcentage utilisateurs (10% → 50% → 100%)
- **A/B testing**: test fonctionnalités sur groupe utilisateurs
- **Rollback rapide**: désactivation immédiate si problème détecté
- **Feature flags par plan**: activation features selon plan Lite/Pro

### 16.5 Rate limiting & protection
**Sécurité & performance**
- **Rate limiting par utilisateur**: limite requêtes/min (ex: 60 req/min)
- **Rate limiting par atelier**: limite globale par workspace
- **Protection DDoS**: Vercel Edge Network (intégré) + Cloudflare si nécessaire
- **CAPTCHA**: sur formulaires critiques (inscription, connexion après X tentatives)
- **Blocage IP**: temporaire si comportement suspect (tentatives login multiples)

### 16.6 Tests & QA (Quality Assurance)
**Qualité code & fonctionnalités** (Priorité haute - beaucoup de tests auto)

**Tests automatisés (obligatoire MVP)**
- **Tests unitaires**: coverage minimum **70%** (Jest/Vitest)
  - Tests fonctions métier (calculs devis, stock, séries)
  - Tests utilitaires (validation, formatage)
- **Tests d'intégration**: workflows critiques (devis → projet → facture)
  - Tests API endpoints (Supabase Edge Functions)
  - Tests workflows complets (parcours utilisateur métier)
- **Tests E2E**: Playwright/Cypress pour parcours utilisateur complets
  - Inscription → onboarding → création devis → projet → facture
  - Tests multi-navigateurs (Chrome, Firefox, Safari)
  - Tests responsive (desktop, tablet, mobile)
- **Tests multi-tenancy**: vérification isolation données (tests automatisés)
  - **Critique**: tests isolation RLS Supabase
  - Vérifier qu'atelier A ne voit pas données atelier B
  - Tests automatisés avant chaque déploiement
- **Tests de charge**: simulation 100 ateliers simultanés (V1)
- **Tests sécurité**: scans vulnérabilités (Snyk, npm audit)
  - Scan dépendances automatique (CI/CD)
  - Alertes si vulnérabilité critique détectée
- **CI/CD**: pipeline automatique (tests → build → deploy staging → prod)
  - Tests automatiques avant merge PR
  - Build + tests avant déploiement
  - Déploiement staging automatique si tests OK
  - Déploiement prod manuel (validation) ou auto après validation tests

### 16.7 Gestion migrations base de données
**Évolution schéma BDD**
- **Versioning schéma**: migrations numérotées (001_*, 002_*)
- **Rollback migrations**: possibilité annuler migration si problème
- **Zero-downtime migrations**: stratégie déploiement sans interruption service
- **Migration staging**: test migrations sur environnement staging avant prod
- **Backup pré-migration**: sauvegarde automatique avant chaque migration

### 16.8 Documentation développeur/API
**Pour intégrations & maintenance**
- **Documentation API**: OpenAPI/Swagger, exemples code (curl, JavaScript, Python)
- **Changelog public**: historique versions avec breaking changes
- **Documentation technique**: architecture, décisions techniques (ADR)
- **Guide contribution**: si code open-source partiellement ou communauté future
- **Exemples intégrations**: snippets code pour cas d'usage courants

### 16.9 Pricing & limites usage détaillées
**Transparence tarification**
- **Grille tarifaire publique**: affichage prix clair (site vitrine)
- **Calculateur coût**: outil estimation coût selon usage (nb projets, storage)
- **Limites usage claires**: nb projets/mois, storage inclus, limites API
- **Overages**: tarification dépassement quotas (storage, requêtes API)
- **Facturation prévisible**: prévision coût mois suivant selon usage actuel

### 16.10 Churn prevention & rétention
**Réduction désabonnements** (V2)
- **Health score**: score santé atelier (usage, paiements, support)
- **Alertes churn**: détection signaux désabonnement (activité faible, impayés)
- **Retention campaigns**: emails personnalisés si usage en baisse
- **Exit surveys**: questionnaire si désabonnement (comprendre causes)
- **Win-back**: offres promotionnelles pour récupérer clients perdus

### 16.11 Feedback utilisateurs & roadmap
**Écoute clients & transparence**
- **Système feedback**: widget in-app (Feature Requests, Bugs)
- **Vote fonctionnalités**: système de votes utilisateurs pour priorisation
- **Roadmap publique**: page publique avec fonctionnalités en cours/planifiées
- **Updates produits**: newsletter mensuelle nouveautés
- **Communauté**: Discord/Slack optionnel pour échanges utilisateurs (V2)

### 16.12 Documents légaux
**Conformité légale obligatoire** (MVP - à rédiger)

**Documents obligatoires à rédiger** (société existe déjà)
- **CGU (Conditions Générales d'Utilisation)**: règles usage service
  - Droits et obligations utilisateurs
  - Responsabilités fournisseur (toi)
  - Limitation responsabilité
  - Propriété intellectuelle
  - Résiliation (conditions, préavis)
- **CGV (Conditions Générales de Vente)**: tarifs, modalités paiement
  - Plans et prix (modifiables selon backoffice)
  - Modalités paiement (Stripe, abonnement)
  - Essai gratuit (30 jours, conditions)
  - Facturation, échéances
  - Remboursement (si applicable)
- **Politique de confidentialité**: traitement données personnelles (RGPD)
  - Types données collectées
  - Finalités traitement
  - Durée conservation
  - Droits utilisateurs (accès, rectification, suppression, portabilité)
  - Cookies et traçage
  - Transferts hors UE (si applicable)
- **Mentions légales**: SIRET, RCS, siège social, DPO
  - Nom société, SIRET, RCS
  - Siège social
  - Directeur publication
  - Hébergeur (Vercel + Supabase)
  - DPO (si désigné)
- **Politique cookies**: consentement cookies, traçage
  - Types cookies utilisés (essentiels, analytics, marketing)
  - Durée cookies
  - Consentement utilisateur (banner RGPD)
  - Gestion préférences cookies
- **DPA (Data Processing Agreement)**: accord traitement données si clients EU (option V2)

**Note**: Faire réviser par avocat spécialisé numérique avant mise en ligne

### 16.13 Gestion incidents & communication
**Transparence & confiance**
- **Status page**: page publique statut service (status.thermogestion.fr)
- **Incident log**: historique incidents, résolutions
- **Communication proactive**: notifications incidents aux ateliers (email + app)
- **Post-mortem**: analyse incidents critiques (identification causes, actions correctives)
- **SLA incidents**: temps résolution selon criticité (critique: < 2h, majeur: < 24h)

### 16.14 Data retention & politique conservation
**RGPD & conformité** (MVP obligatoire)

**Politique retention données**
- **Projets/complets**: conservation **10 ans** (obligation légale comptabilité France)
- **Devis non acceptés**: conservation **3 ans** (prescription commerciale)
- **Factures**: conservation **10 ans** (obligation légale)
- **Logs applicatifs**: conservation **90 jours** (debug uniquement)
- **Logs audit**: conservation **2 ans** (traçabilité actions critiques)
- **Données clients**: conservation tant que compte actif + **3 ans** après désabonnement
- **FEC comptable**: conservation **10 ans** (déjà défini section 7.2)

**Suppression automatique**
- Données obsolètes supprimées automatiquement (cron job mensuel)
- Notification atelier 30 jours avant suppression données (possibilité export)

**Droits utilisateurs RGPD** (obligatoire)
- **Export données client**: export complet données atelier (JSON/CSV) sur demande
  - Disponible depuis dashboard atelier
  - Export complet < 48h
- **Droit à l'oubli**: suppression complète données client sur demande (**30 jours max**)
  - Demande via dashboard ou email
  - Confirmation suppression par email
- **Archivage données**: données archivées avant suppression (compliance légale)
  - Archivage sécurisé (S3, Storage externe)
  - Accessible uniquement support si besoin légal

### 16.15 Migrations & portabilité données
**Facilité changement solution**

**Gestion migrations base de données** (MVP obligatoire)
- **Versioning schéma**: migrations numérotées (001_*, 002_*)
  - Utiliser Supabase Migrations
  - Chaque modification schéma = nouvelle migration
  - Historique complet migrations dans repo Git
- **Rollback possible**: possibilité annuler migration si problème
  - Scripts rollback pour chaque migration
  - Test rollback sur staging avant prod
- **Zero-downtime migrations**: stratégie déploiement sans interruption service
  - Migrations additives (ajout colonnes nullable) = pas downtime
  - Migrations destructives (suppression colonnes) = planifiées maintenance
  - Migration staging: test migrations sur environnement staging avant prod
  - Backup pré-migration: sauvegarde automatique avant chaque migration

**Portabilité données** (V1)
- **Export complet**: export toutes données atelier (projets, clients, devis, factures)
  - Format CSV/JSON structuré
  - Export depuis dashboard atelier
- **Format standardisé**: CSV/JSON structuré pour import autre solution
- **Import données**: facilité import depuis Excel/CSV concurrents
- **Documentation migration**: guide étape par étape export/import
- **Support migration**: assistance personnalisée si migration complexe (option payante)

### 16.16 Environnements & CI/CD
**Qualité déploiements** (MVP obligatoire)

**Environnements**
- **Development**: local (développeurs)
  - Setup local avec Supabase CLI
  - Base données locale ou Supabase dev
- **Staging**: test avant prod (identique prod)
  - Environnement Supabase séparé (staging)
  - Vercel preview deployment (staging.thermogestion.fr)
  - Tests QA avant prod
- **Production**: environnement client
  - Supabase production
  - Vercel production (app.thermogestion.fr)

**CI/CD pipeline** (GitHub Actions ou Vercel Git Integration)
- **À chaque commit/PR**:
  - Tests automatiques (unitaires, intégration)
  - Linter (ESLint, Prettier)
  - Scan sécurité dépendances
- **À chaque merge**:
  - Build automatique
  - Tests E2E automatiques
  - Déploiement staging automatique si tests OK
- **Déploiement production**:
  - Déploiement manuel après validation tests staging
  - Ou automatique si tous tests passent + validation manuelle
- **Blue-green deployment**: bascule sans downtime (option V2)

### 16.17 Security monitoring & compliance
**Sécurité renforcée**
- **Security scanning**: scans vulnérabilités automatiques (code, dépendances)
- **Penetration testing**: tests intrusion annuels (option externe)
- **Compliance certifications**: ISO 27001, SOC 2 (si clients enterprise - V2)
- **Security audit logs**: logs accès sensibles (connexions, exports données, modifications critiques)
- **Intrusion detection**: détection comportements suspects (tentatives accès non autorisés)

### 16.18 Customer success & onboarding
**Accompagnement clients**
- **Customer success manager**: suivi clients Pro (option V2)
- **Onboarding personnalisé**: session découverte avec nouveau client (option)
- **Checkpoints**: suivi adoption 30j, 90j après inscription
- **Formation**: webinaires mensuels, guides vidéos, documentation interactive
- **Success metrics**: tracking adoption fonctionnalités (usage dashboard, taux utilisation)

### 16.19 Analytics & tracking usage
**Compréhension usage produit**
- **Product analytics**: Mixpanel, Amplitude, ou PostHog (anonymisé RGPD-compliant)
- **Funnel analysis**: parcours utilisateurs (inscription → activation → conversion)
- **Feature usage**: fonctionnalités les plus/moins utilisées
- **Session recordings**: enregistrements sessions utilisateurs (opt-in, anonymisé) pour UX
- **Heatmaps**: clics/chaleur interface pour amélioration UX
- **Cohort analysis**: analyse rétention par cohorte inscription

### 16.20 Gestion versions & changelog
**Communication évolutions**
- **Versioning sémantique**: v1.0.0 (major.minor.patch)
- **Changelog public**: historique versions avec nouveautés, fixes, breaking changes
- **Release notes**: notes de version par email aux ateliers (newsletter mensuelle)
- **Breaking changes**: communication préalable 30 jours avant changement majeur
- **Deprecation**: annonce fonctionnalités dépréciées 90 jours avant suppression

### 16.21 Backup & disaster recovery
**Continuité service**
- **Backup automatique**: quotidien base données (Supabase intégré)
- **Backup stockage**: photos, documents (Supabase Storage)
- **RTO (Recovery Time Objective)**: < 4h (déjà défini section 11.4)
- **RPO (Recovery Point Objective)**: < 24h (déjà défini section 11.4)
- **Disaster recovery plan**: procédure complète restauration en cas sinistre
- **Backup géographiquement distants**: réplication multi-régions (option V2)

### 16.22 Communication marketing & acquisition
**Croissance utilisateurs**
- **Site vitrine**: landing page professionnelle (thermogestion.fr)
- **SEO**: optimisation référencement naturel (blog articles, guides)
- **Content marketing**: blog ressources métier thermolaquage (V2)
- **Démos**: vidéos démo produit, démo live sur demande
- **Témoignages clients**: cas clients, avis clients (trustpilot optionnel V2)
- **Affiliation**: programme affiliation pour recommandation (option V2)

---

## 17) Site vitrine / Front office (Marketing & Acquisition)

### 17.1 Objectif
**Site professionnel pour attirer clients (thermogestion.fr)**
- Hébergement: **Vercel** (même stack que app)
- Déploiement: **Supabase** pour CMS/blog si besoin
- Objectif: conversion visiteurs → essai gratuit 30 jours

### 17.2 Pages nécessaires (structure complète)

**1. Landing page / Home** (`/`)
- Hero section: valeur ajoutée principale + CTA "Essai gratuit 30 jours"
- Bénéfices clés (3-4 points forts)
- Stats/étiquettes: "Déjà X ateliers nous font confiance" (si applicable)
- Logos clients/témoignages (option V2)
- CTA répété: "Démarrer l'essai gratuit"
- Section "Pourquoi ThermoGestion ?" (3-4 raisons)

**2. Fonctionnalités** (`/fonctionnalites`)
- Liste détaillée toutes fonctionnalités:
  - **Gestion devis**: création rapide, templates personnalisables, PDF pro
  - **Suivi projets**: étapes, photos, traçabilité complète
  - **Gestion stock**: stock intelligent, pesées, inventaires partiels
  - **Regroupement séries**: optimisation production par poudre identique
  - **CRM clients**: gestion clients, historique, relances
  - **Portail client**: espace client, suivi projets, documents
  - **Facturation**: devis, factures, paiements, exports comptabilité
  - **Reporting**: dashboards, KPIs, statistiques
  - **Module Jantes**: gestion jantes, véhicules de prêt (option)
- Chaque fonctionnalité: titre, description courte, icône/visuel
- Comparaison Lite vs Pro (tableau)

**3. Pricing / Tarifs** (`/tarifs`)
- **Plan Lite**: prix, fonctionnalités incluses, CTA "Commencer"
- **Plan Pro**: prix, fonctionnalités incluses, CTA "Commencer"
- **Essai gratuit 30 jours**: mise en avant (aucune CB requise)
- Comparaison plans (tableau détaillé)
- FAQ pricing (questions fréquentes: facturation, changement plan, remboursement)
- Garantie satisfait ou remboursé ? (à définir)
- Témoignages clients Pro (option)

**4. Cas clients / Témoignages** (`/temoignages`)
- Cas clients détaillés (ateliers utilisateurs)
- Témoignages vidéo (option V2)
- Stats résultats (gain temps, productivité, etc.)
- Logos clients (si autorisation)
- Formulaire contact cas client (pour nouveaux témoignages)

**5. Documentation / Aide** (`/aide` ou `/documentation`)
- Guides utilisateur (vidéos/articles)
- FAQ complète (questions fréquentes)
- Vidéos tutoriels (YouTube/Vimeo intégrés)
- Documentation interactive
- Contact support

**6. Blog / Ressources** (`/blog`) (V2 recommandé)
- Articles métier thermolaquage
- Guides pratiques
- Actualités produit
- Tips & astuces
- SEO: optimisation référencement naturel

**7. À propos / Qui sommes-nous** (`/a-propos`)
- Histoire ThermoGestion
- Mission/Vision
- Équipe (option)
- Contact
- Partenaires (si applicable)

**8. Contact** (`/contact`)
- Formulaire contact
- Email support
- Coordonnées (si siège social)
- Chat support (option - Crisp/Intercom)

**9. Connexion / Login** (`/connexion`)
- Redirection vers app.thermogestion.fr (app principale)
- Lien "Mot de passe oublié"

**10. Inscription / Essai gratuit** (`/inscription`)
- Formulaire inscription atelier
- Informations requises: nom atelier, email Owner, téléphone
- Validation email (double opt-in)
- Redirection onboarding après validation

**11. Pages légales** (obligatoires)
- **CGU** (`/cgu`): Conditions Générales d'Utilisation
- **CGV** (`/cgv`): Conditions Générales de Vente
- **Politique de confidentialité** (`/confidentialite`): RGPD
- **Mentions légales** (`/mentions-legales`): SIRET, RCS, etc.
- **Politique cookies** (`/cookies`): gestion cookies
- **Politique remboursement** (`/remboursement`) (si applicable)

**12. Page Status** (`/status` ou status.thermogestion.fr)
- Statut service en temps réel
- Uptime garanti (99.5% / 99.9%)
- Historique incidents
- Maintenance planifiée
- Métriques (temps réponse, disponibilité)
- RSS feed status (option)

### 17.3 Design & UX site vitrine
- **Design moderne**: professionnel, épuré, B2B
- **Responsive**: mobile, tablet, desktop
- **Performance**: < 3s chargement (Lighthouse 90+)
- **SEO**: optimisation référencement naturel
  - Meta tags, Open Graph
  - Sitemap XML
  - Robots.txt
  - Schema.org markup (organisation, produit)
- **Calls-to-Action**: CTAs clairs et répétés ("Essai gratuit", "Commencer")
- **Tracking**: Google Analytics (RGPD-compliant), tracking conversions
- **A/B testing**: test différents CTAs, headlines (option V2)

### 17.4 Stack technique site vitrine
- **Framework**: Next.js (même stack app pour cohérence)
- **Hébergement**: Vercel (déploiement automatique Git)
- **CMS**: Supabase (articles blog) ou Markdown files (simplicité)
- **Styling**: Tailwind CSS (cohérence avec app)
- **Formulaires**: React Hook Form + validation
- **Contact form**: email via API route Vercel ou service tiers (SendGrid, etc.)

### 17.5 Intégrations marketing
- **Google Analytics**: tracking visiteurs (RGPD-compliant)
- **Google Tag Manager**: gestion tags marketing (option)
- **Facebook Pixel**: tracking conversions (option, V2)
- **LinkedIn Insight Tag**: B2B marketing (option V2)
- **Email marketing**: Mailchimp/Brevo pour newsletter (option)
- **Chat support**: Crisp/Intercom widget (option)

### 17.6 Conversion optimization
- **Landing pages**: pages dédiées selon source trafic (Google Ads, SEO, etc.)
- **Popups**: capture emails (exit intent, après X secondes) - option
- **Social proof**: témoignages, logos clients, stats
- **Urgence**: "X ateliers ont rejoint cette semaine" (option)
- **Trust badges**: sécurité (SSL, RGPD), paiement (Stripe)

---

## 18) Priorisation éléments manquants (mise à jour)

### 🔴 Critique (MVP - obligatoire)
1. **✅ SLA & Status page**: essentiel confiance B2B (section 16.1)
   - Uptime garanti: 99.5% Lite / 99.9% Pro
   - Status page: status.thermogestion.fr
   - Compensation définie
2. **✅ Gestion erreurs & monitoring**: Sentry/LogRocket pour qualité (section 16.2)
3. **✅ Tests & QA**: tests automatisés minimum (section 16.6)
   - Coverage 70%, tests multi-tenancy critiques
4. **✅ Documents légaux**: CGU, CGV, politique confidentialité (section 16.12)
   - À rédiger (société existe déjà)
5. **✅ Gestion migrations BDD**: versioning schéma obligatoire (section 16.15)
   - Zero-downtime migrations
6. **✅ Site vitrine complet**: marketing & acquisition (section 17)
   - Toutes pages nécessaires (landing, fonctionnalités, pricing, etc.)
   - Hébergement Vercel + Supabase

### 🟠 Important (V1)
1. **Rate limiting**: protection sécurité (section 16.5)
2. **Feature flags**: déploiement progressif (section 16.4)
3. **CI/CD**: pipeline automatique (section 16.16)
4. **Changelog public**: transparence évolutions (section 16.20)
5. **Data retention**: politique RGPD détaillée (section 16.14)

### 🟢 Nice-to-have (V2)
1. **API publique & Webhooks**: intégrations tierces (section 16.3)
2. **Customer success**: accompagnement premium (section 16.18)
3. **Product analytics**: optimisation produit (section 16.19)
4. **Roadmap publique**: transparence évolution (section 16.11)
5. **Programme affiliation**: croissance marketing (section 16.22)

---

**Dernière mise à jour**: Version 1.4 (enrichi éléments SaaS critiques)

Fin du document.
