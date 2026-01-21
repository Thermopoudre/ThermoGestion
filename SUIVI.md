# Suivi du projet ThermoGestion

## Objectif
Ce document permet de suivre toutes les modifications, ajouts, suppressions de fichiers et fonctionnalités tout au long du projet.

---

## Historique des modifications

### 21 janvier 2026 - Charte graphique Thermolaquage complète (Site vitrine + Application)

**Objectif :** Appliquer une identité visuelle unique "métier thermolaquage" sur le site vitrine ET l'application.

**Site vitrine - Refonte complète :**
- `site-vitrine/index.html` : Redesign complet page d'accueil
  - Hero avec "Logiciel de gestion pour ateliers de thermolaquage"
  - Workflow visuel 6 étapes (Réception → Préparation → Poudrage → Cuisson → Contrôle QC → Livraison)
  - Fonctionnalités métier spécifiques (catalogue RAL, gestion fours, séries, QC, photos avant/après)
  - Palette couleurs chaudes : gradient orange→rouge (from-orange-500 to-red-600)
  - Icônes thématiques : 🔥 flamme omniprésente

**Application - Charte graphique mise à jour :**
- Navigation : Logo TG gradient orange/rouge + icône 🔥
- Dashboard : Cartes KPI avec icône flamme pour projets
- Boutons : Gradient `from-orange-500 to-red-600` partout
- Mode sombre : Textes accent `text-orange-500` / `text-red-400`
- Graphiques : Palette couleurs chaudes (orange, rouge, jaune, ambre)

**URL déploiement :** https://thermogestion.vercel.app

---

### 21 janvier 2026 - Responsive + Menu mobile

**Objectif :** Appliquer une identité visuelle unique "métier thermolaquage" avec palette orange/rouge évoquant la chaleur du four.

**Fichiers modifiés :**
- `tailwind.config.ts` : Nouvelle palette primary (orange), accent (rouge), heat (jaune)
- `src/app/app/layout.tsx` : Navigation avec charte orange/rouge + icône 🔥
- `src/components/navigation/MobileNav.tsx` : Menu mobile avec header gradient orange/rouge
- `src/app/auth/login/page.tsx` : Page connexion style dark avec accents orange
- `src/app/auth/inscription/page.tsx` : Page inscription style dark avec accents orange
- `src/components/dashboard/KPICards.tsx` : Cartes KPI avec couleurs thermolaquage
- `src/components/dashboard/ChartCA.tsx` : Graphique CA avec courbe orange
- `src/components/dashboard/AlertsPanel.tsx` : Panneau alertes avec dark mode
- `src/components/dashboard/TopPoudres.tsx` : Graphique poudres avec palette chaude
- `src/app/app/dashboard/page.tsx` : Dashboard avec charte complète

**Changements visuels :**
- ✅ **Logo** : Icône 🔥 + gradient orange→rouge
- ✅ **Boutons principaux** : `from-orange-500 to-red-600` (40+ fichiers mis à jour)
- ✅ **Textes accent** : `text-orange-500` / `text-orange-400` (dark mode)
- ✅ **Hover/Focus** : Orange au lieu de bleu
- ✅ **Pages auth** : Style dark moderne avec effets lumineux
- ✅ **Graphiques** : Palette couleurs chaudes (orange, rouge, jaune, ambre)

**URL déploiement :** https://thermogestion.vercel.app

---

### 21 janvier 2026 - Automatisations complètes (Facture, Stock, Workflow)

**Migrations Supabase appliquées :**
- `011_add_missing_columns` : Colonnes factures (items, payment_status, auto_created, etc.)
- `012_stock_mouvements_table` : Table traçabilité mouvements de stock
- `013_facture_numero_function` : Fonction SQL numérotation automatique factures
- `014_email_and_notifications` : Tables email_config, email_queue, push_subscriptions
- `015_automatisation_tracking` : Colonnes auto_facture_created_at, auto_stock_decremented_at
- `016_audit_logs` : Table journal d'audit complet
- `017_poudres_stock_columns` : Colonnes stock_theorique_kg, stock_reel_kg sur poudres

**Fichiers modifiés :**
- `src/lib/automatisations/projet-status.ts` : Logique complète automatisations
  - Création facture automatique quand projet → "Prêt" (selon préférence client)
  - Décrémentation stock poudre quand projet → "En cuisson"
  - Traçabilité mouvements de stock
  - Journal d'audit des changements de statut
- `src/app/api/projets/[id]/status/route.ts` : API changement statut avec automatisations
- `src/components/clients/ClientForm.tsx` : Ajout champ `facture_trigger` (pret/livre/manuel)
- `src/types/database.types.ts` : Ajout types colonnes automatisation

**Automatisations fonctionnelles :**
- ✅ **Facture automatique** : Création quand projet passe à "Prêt" ou "Livré" (selon `facture_trigger` client)
- ✅ **Décrémentation stock** : Stock poudre décrémenté quand projet passe à "En cuisson" (0.5 kg par défaut)
- ✅ **Mouvements de stock** : Traçabilité complète (type, quantité, avant/après, motif)
- ✅ **Journal d'audit** : Tous les changements de statut sont tracés
- ✅ **Protection double exécution** : Flags `auto_facture_created_at`, `auto_stock_decremented_at`

**Tests effectués :**
- ✅ Projet PROJ-2026-0003 : Facture FACT-2026-0001 créée automatiquement (509,76 € TTC)
- ✅ Projet PROJ-2026-0002 : Stock IGP-9005-M décrémenté (15 kg → 14.5 kg)
- ✅ Mouvement de stock enregistré avec motif "Cuisson projet PROJ-2026-0002"

---

### 20 janvier 2026 - Notifications Push + Avis Google + Webhooks Stripe

**Fichiers créés :**
- **Notifications Push** :
  - `supabase/migrations/009_notifications_push.sql` : Tables push_subscriptions, push_notifications
  - `src/lib/notifications/push.ts` : Utilitaires Web Push API
  - `src/lib/notifications/triggers.ts` : Déclencheurs automatiques notifications
  - `src/app/api/push/subscribe/route.ts` : API enregistrement abonnement
  - `src/app/api/push/unsubscribe/route.ts` : API désabonnement
  - `src/app/api/notifications/trigger/route.ts` : API déclenchement notifications
  - `src/components/notifications/PushNotificationButton.tsx` : Bouton activation notifications
  - `public/sw.js` : Service Worker pour notifications
- **Avis Google** :
  - `supabase/migrations/010_avis_google.sql` : Table avis_google, fonction get_projets_ready_for_avis
  - `src/lib/google/avis.ts` : Utilitaires gestion avis Google
  - `src/app/api/avis-google/process/route.ts` : Route cron job traitement avis
- **Webhooks Stripe** :
  - `src/app/api/webhooks/stripe/route.ts` : Route webhook Stripe pour mise à jour auto paiements

**Fichiers modifiés :**
- `src/app/app/layout.tsx` : Ajout bouton notifications push
- `src/components/retouches/DeclarerRetoucheForm.tsx` : Ajout notification push lors déclaration
- `TOKENS_API_REQUIS.md` : Ajout VAPID keys et Stripe webhook secret

**Fonctionnalités ajoutées :**
- ✅ Notifications push navigateur (Web Push API)
- ✅ Abonnements utilisateurs (multi-devices)
- ✅ Notifications automatiques (projet, devis, retouche, facture, statut)
- ✅ Service Worker pour gestion notifications
- ✅ Avis Google workflow J+3 (email automatique après récupération)
- ✅ Relance automatique avis (J+Y configurable)
- ✅ Webhooks Stripe (mise à jour auto statut paiement)
- ✅ Création paiements automatique via webhook
- ✅ Notifications push lors paiement facture

**Décisions techniques :**
- Web Push API (standard navigateur, pas besoin app mobile)
- VAPID keys pour authentification push
- Service Worker pour gestion notifications hors ligne
- Cron job Vercel pour traitement avis Google (quotidien)
- Webhook Stripe sécurisé avec signature

### 20 janvier 2026 - Module Retouches/NC + Fichier Tokens API

**Fichiers créés :**
- **Retouches/NC** :
  - `supabase/migrations/008_retouches_nc.sql` : Tables retouches, defaut_types, fonctions statistiques
  - `src/app/app/retouches/page.tsx` : Liste retouches avec statistiques
  - `src/app/app/retouches/[id]/page.tsx` : Détail retouche
  - `src/app/app/retouches/stats/page.tsx` : Statistiques retouches
  - `src/app/app/projets/[id]/retouches/new/page.tsx` : Déclaration retouche depuis projet
  - `src/components/retouches/RetouchesList.tsx` : Composant liste
  - `src/components/retouches/DeclarerRetoucheForm.tsx` : Formulaire déclaration
  - `src/components/retouches/RetoucheDetail.tsx` : Composant détail
  - `src/components/retouches/RetouchesStats.tsx` : Composant statistiques
- **Documentation** :
  - `TOKENS_API_REQUIS.md` : Fichier global récapitulatif de tous les tokens API nécessaires

**Fichiers modifiés :**
- `src/app/app/layout.tsx` : Ajout lien "Retouches" dans navigation
- `src/app/app/projets/[id]/page.tsx` : Ajout récupération retouches du projet
- `src/components/projets/ProjetDetail.tsx` : Ajout section retouches + bouton déclaration

**Fonctionnalités ajoutées :**
- ✅ Déclaration retouches/NC sur projets
- ✅ Types de défauts paramétrables par atelier
- ✅ Photos retouches (upload avec compression)
- ✅ Suivi statuts (déclarée, en cours, résolue, annulée)
- ✅ Statistiques retouches (taux NC, causes principales)
- ✅ Fonctions SQL pour calculs statistiques
- ✅ Intégration dans page projet (affichage retouches)

**Décisions techniques :**
- Types de défauts paramétrables (table defaut_types)
- Photos retouches stockées dans bucket photos (type 'nc')
- Fonctions SQL pour performance (calculate_nc_rate, get_main_nc_causes)
- Statistiques calculées en temps réel (30 derniers jours par défaut)

### 20 janvier 2026 - Module facturation complet

**Fichiers créés :**
- **Facturation** :
  - `supabase/migrations/007_facturation_améliorations.sql` : Améliorations table factures, table paiements, numérotation auto
  - `src/lib/facturation/types.ts` : Types TypeScript facturation
  - `src/lib/facturation/numerotation.ts` : Utilitaires numérotation automatique
  - `src/lib/facturation/pdf.ts` : Génération PDF factures
  - `src/lib/facturation/exports.ts` : Exports CSV et FEC comptable
  - `src/lib/stripe/payment-links.ts` : Création liens paiement Stripe
  - `src/app/app/factures/page.tsx` : Liste factures
  - `src/app/app/factures/new/page.tsx` : Création facture
  - `src/app/app/factures/[id]/page.tsx` : Détail facture
  - `src/app/app/factures/[id]/pdf/route.ts` : Génération PDF
  - `src/components/factures/FacturesList.tsx` : Composant liste
  - `src/components/factures/CreateFactureForm.tsx` : Formulaire création
  - `src/components/factures/FactureDetail.tsx` : Composant détail
  - `src/app/api/factures/generate-numero/route.ts` : API génération numéro
  - `src/app/api/factures/[id]/mark-paid/route.ts` : API marquer payée
  - `src/app/api/factures/[id]/payment-link/route.ts` : API création lien Stripe
  - `src/app/api/factures/export/csv/route.ts` : Export CSV
  - `src/app/api/factures/export/fec/route.ts` : Export FEC comptable

**Fichiers modifiés :**
- `src/app/app/layout.tsx` : Ajout lien "Factures" dans navigation
- `package.json` : Ajout dépendance `stripe`

**Fonctionnalités ajoutées :**
- ✅ Création factures (acompte, solde, complète)
- ✅ Numérotation automatique (format paramétrable)
- ✅ Génération PDF factures
- ✅ Intégration Stripe (liens de paiement)
- ✅ Traçabilité paiements (table paiements)
- ✅ Exports comptabilité (CSV, FEC XML)
- ✅ Gestion statuts (brouillon, envoyée, payée, remboursée)

**Décisions techniques :**
- Numérotation via fonction SQL `generate_facture_numero()` pour atomicité
- Format FEC simplifié (structure de base, à adapter selon plan comptable)
- Stripe Payment Links (simple, pas besoin frontend Stripe)
- Exports via routes API (téléchargement direct)

### 20 janvier 2026 - Implémentation 3 étapes prioritaires (Email, Portail client, Séries)

**Fichiers créés :**
- **Email** :
  - `supabase/migrations/005_email_config.sql` : Configuration email (OAuth tokens, queue)
  - `src/lib/email/types.ts` : Types TypeScript email
  - `src/lib/email/resend.ts` : Utilitaires Resend
  - `src/lib/email/smtp.ts` : Utilitaires SMTP
  - `src/lib/email/queue.ts` : Gestion queue emails
  - `src/lib/email/sender.ts` : Service principal envoi
  - `src/lib/email/templates.ts` : Génération templates
  - `src/templates/email/devis-nouveau-client.html` : Template email nouveau client
  - `src/templates/email/devis-client-existant.html` : Template email client existant
  - `src/app/api/email/send/route.ts` : API envoi email
  - `src/app/api/email/queue/process/route.ts` : API traitement queue
  - `src/app/api/devis/[id]/send-email/route.ts` : API envoi devis
- **Portail client** :
  - `supabase/migrations/006_portail_client.sql` : Tables client_users et confirmations
  - `src/app/client/middleware.ts` : Protection routes client
  - `src/app/client/auth/login/page.tsx` : Connexion client
  - `src/app/client/auth/inscription/page.tsx` : Inscription client
  - `src/app/client/projets/page.tsx` : Liste projets client
  - `src/app/client/projets/[id]/page.tsx` : Détail projet client
  - `src/components/client/ProjetsClientList.tsx` : Composant liste projets
  - `src/components/client/ProjetClientDetail.tsx` : Composant détail projet
- **Séries** :
  - `src/app/app/series/page.tsx` : Page séries (recommandations + existantes)
  - `src/app/app/series/new/page.tsx` : Création série
  - `src/app/app/series/[id]/page.tsx` : Détail série
  - `src/components/series/SeriesRecommandees.tsx` : Vue recommandations
  - `src/components/series/CreateSerieForm.tsx` : Formulaire création
  - `src/components/series/SerieDetail.tsx` : Détail série avec actions

**Fichiers modifiés :**
- `src/components/devis/SendDevis.tsx` : Intégration envoi email réel
- `src/app/app/layout.tsx` : Ajout lien "Séries" dans navigation
- `package.json` : Ajout dépendances (resend, nodemailer, @types/nodemailer)

**Fonctionnalités ajoutées :**
- ✅ Envoi email réel avec Resend/SMTP
- ✅ Queue d'envoi asynchrone
- ✅ Templates emails HTML responsive
- ✅ Portail client complet (authentification + vue projets)
- ✅ Séries recommandées (regroupement automatique par poudre)
- ✅ Création et gestion séries (batch)

**Décisions techniques :**
- Utilisation Resend pour Vercel Serverless (plus simple que Bull+Redis)
- Queue dans Supabase (table email_queue) pour éviter dépendance Redis
- Authentification client séparée (table client_users) pour isolation
- Regroupement strict par poudre exacte (référence + finition + type + couches)

### 20 janvier 2026 - Correction footer, création pages manquantes et logo

**Fichiers créés :**
- `public/logo.svg` : Logo complet ThermoGestion (200x200px) avec lettres TG stylisées et élément décoratif flamme
- `public/logo-icon.svg` : Icône logo (40x40px) pour headers et footers
- `src/components/site-vitrine/Footer.tsx` : Composant Footer réutilisable (non utilisé pour l'instant, pages HTML statiques)
- `site-vitrine/contact.html` : Page contact complète avec formulaire et informations
- `site-vitrine/temoignages.html` : Page témoignages avec 6 témoignages clients
- `site-vitrine/aide.html` : Page centre d'aide avec documentation, FAQ, support
- `src/app/contact/page.tsx` : Route Next.js pour page contact
- `src/app/temoignages/page.tsx` : Route Next.js pour page témoignages
- `src/app/aide/page.tsx` : Route Next.js pour page aide

**Fichiers modifiés :**
- `site-vitrine/index.html` : Remplacement logo texte par SVG, correction footer avec infos complètes
- `site-vitrine/cgu.html` : Footer complet ajouté, logo SVG intégré
- `site-vitrine/cgv.html` : Footer complet ajouté, logo SVG intégré
- `site-vitrine/confidentialite.html` : Footer complet ajouté, logo SVG intégré
- `site-vitrine/mentions-legales.html` : Footer complet ajouté, logo SVG intégré
- `site-vitrine/cookies.html` : Footer complet ajouté, logo SVG intégré
- `site-vitrine/fonctionnalites.html` : Logo SVG intégré
- `site-vitrine/tarifs.html` : Logo SVG intégré

**Problèmes résolus :**
- ✅ Footer légal disparaissait sur certaines pages → Footer complet ajouté partout
- ✅ Pages contact, témoignages et aide manquantes → Créées avec contenu complet
- ✅ Logo manquant → Logo SVG professionnel créé (TG stylisé avec gradient bleu/cyan)

**Fonctionnalités ajoutées :**
- ✅ Logo SVG ThermoGestion (version complète et icône)
- ✅ Page Contact avec formulaire et informations complètes
- ✅ Page Témoignages avec 6 témoignages clients fictifs
- ✅ Page Aide avec sections documentation, vidéos, FAQ, support, intégrations, changelog
- ✅ Footer uniforme sur toutes les pages avec navigation, contact, liens légaux

**Détails techniques :**
- Logo SVG avec gradient bleu (#2563eb) vers cyan (#06b6d4)
- Lettres TG stylisées avec élément décoratif flamme (représentant thermolaquage)
- Footer responsive avec 4 colonnes (logo/description, navigation, contact, légal)
- Toutes les pages légales ont maintenant le même footer complet
- Logo intégré dans tous les headers via `<img src="/logo-icon.svg">`

### 20 janvier 2026 - Système de templates de devis personnalisables

**Fichiers créés :**
- `supabase/migrations/004_devis_templates.sql` : Migration pour table templates avec 4 templates système
- `src/lib/devis-templates.ts` : Utilitaires génération HTML/CSS et variables dynamiques
- `src/app/app/devis/templates/page.tsx` : Page liste des templates
- `src/app/app/devis/templates/new/page.tsx` : Page création template
- `src/app/app/devis/templates/[id]/edit/page.tsx` : Page édition template
- `src/components/devis/TemplatesList.tsx` : Composant liste templates avec actions
- `src/components/devis/TemplateForm.tsx` : Formulaire création/édition template
- `src/app/api/init-templates/route.ts` : API pour initialiser templates ateliers existants
- `DEPLOIEMENT_VERCEL.md` : Guide complet déploiement et test sur Vercel
- `INIT_TEMPLATES.md` : Guide initialisation templates pour ateliers existants

**Fichiers modifiés :**
- `src/app/app/devis/[id]/pdf/route.ts` : Utilise maintenant les templates personnalisables
- `src/app/app/layout.tsx` : Ajout lien "Templates" dans navigation

**Fonctionnalités ajoutées :**
- ✅ Table `devis_templates` avec configuration JSONB
- ✅ 4 templates système (Moderne, Classique, Minimaliste, Premium)
- ✅ Système variables dynamiques ({nom_client}, {date_devis}, {montant_ttc}, etc.)
- ✅ Génération HTML/CSS personnalisée selon configuration
- ✅ Interface gestion templates (liste, création, édition)
- ✅ Définir template par défaut
- ✅ Supprimer templates personnalisés (pas système)
- ✅ RLS policies pour isolation multi-tenant
- ✅ Fonction SQL `create_default_devis_templates()` pour initialisation auto

**Décisions techniques :**
- Configuration par zones (header, body, footer, layout)
- Personnalisation couleurs (primary, secondary, accent)
- Styles tableau (bordered, striped, minimal)
- Templates système non modifiables
- Templates personnalisés créables par atelier

### [Date] - Analyse initiale et amélioration du PLAN.md

### [Date] - Affinage complet du PLAN.md avec réponses utilisateur

**Fichiers modifiés :**
- `PLAN.md` : Version 1.3 (finalisé - prêt production)

**Modifications apportées - Finalisation :**
- **Backoffice éditeur SaaS**: accès exclusif gestionnaire, dashboard complet gestionnaire admin, logs audit modifications prix/quota, email auto si modification prix
- **Photos**: quota par défaut **20 GB par atelier**, dashboard gestionnaire admin, suppression automatique photos anciennes projets à 90%
- **Templates devis**: React JSON Forms / Formik+Yup / custom (zones configurables), pas de marketplace templates
- **Calendrier véhicules de prêt**: calendrier custom + sync bidirectionnelle Google Calendar/Outlook, vue hebdomadaire principale (V2)
- **KPIs dashboards**: liste complète (CA/mois, taux transformation, délais, retards, poudres, NC, financier)
- **Avis Google**: API Google My Business avec tracking, workflow automatique J+3 (paramétrable), relance auto configurable, pas d'autres plateformes
- **Exports comptabilité**: CSV, FEC comptable (archivage auto 10 ans, export mensuel auto vers espace sécurisé optionnel), API Pennylane
- **Notifications**: push uniquement atelier (web push natif gratuit), clients finaux par email uniquement
- **Signature électronique**: intégration simple (image signature), obligatoire (pas de refus), validation "signé électroniquement" avec horodatage, journal signatures (qui, quand, IP) pour traçabilité légale
- **Multi-langue**: V2 avec traduction automatique (anglais, espagnol, italien), choix langues actives par atelier
- **Module Jantes**: structure base dans MVP, développement complet V2 avec architecture préparée
- **Essai gratuit**: notifications conversion J+7/J+15/J+25, onboarding guidé (tutoriels, tips)
- **FEC comptable**: archivage automatique 10 ans (durée légale France), export mensuel automatique vers espace sécurisé optionnel

**Fichiers créés :**
- `METHODETRAVAIL.md` : Méthode de travail et checklist
- `SUIVI.md` : Ce document (suivi des modifications)

**Décisions prises :**
- **Backoffice éditeur**: accès exclusif gestionnaire (toi uniquement)
- **Quota storage photos**: 20 GB par défaut par atelier
- **Suppression auto photos**: déclenchement à 90% du quota (photos projets anciens uniquement)
- **Dashboard gestionnaire admin**: vue complète avec toutes infos (ateliers, storage, prix, monitoring)
- **Logs audit**: toutes modifications prix/quota tracées (qui, quand, quoi modifié)
- **Email auto**: notification automatique atelier si modification prix
- **Push notifications**: web push natif gratuit (pas service tiers), uniquement atelier
- **Clients finaux**: notifications par email uniquement (pas push)
- **Signature électronique**: obligatoire (pas de refus possible), horodatage obligatoire, journal signatures (qui, quand, IP)
- **Avis Google**: API Google My Business avec tracking (pas juste lien direct), pas d'autres plateformes
- **Form builder**: React JSON Forms / Formik+Yup / custom OK, pas de marketplace templates
- **Multi-langue**: anglais, espagnol, italien (V2), choix langues actives par atelier
- **Module Jantes**: structure base MVP, développement complet V2
- **Essai gratuit**: notifications J+7/J+15/J+25 + onboarding guidé
- **FEC comptable**: archivage auto 10 ans + export mensuel auto optionnel

**Stack technique :**
- Supabase + Vercel + Next.js + Tailwind CSS
- Multi-tenancy avec RLS Supabase (obligatoire)
- 2FA obligatoire pour Owners/Admins
- Emails via OAuth Gmail/Outlook (gratuit)
- Plans Lite/Pro avec utilisateurs illimités
- Responsive obligatoire (desktop/tablet/mobile)
- Mode offline prioritaire pour mode atelier (tablette)
- WCAG 2.1 AA requis (conformité légale)

**Questions résolues :**
- ✅ Prix plans Lite/Pro: géré via backoffice éditeur (paramétrable temps réel), accès exclusif gestionnaire
- ✅ Limites storage photos: 20 GB par défaut, dashboard gestionnaire admin, suppression auto 90%
- ✅ Form builder devis: React JSON Forms / Formik+Yup / custom, pas de marketplace
- ✅ Calendrier véhicules: custom + sync Google/Outlook, vue hebdomadaire (V2)
- ✅ Avis Google: API Google My Business avec tracking, J+3 paramétrable, relance auto
- ✅ KPIs: liste complète définie
- ✅ Exports: CSV, FEC (archivage 10 ans + export mensuel auto), API Pennylane
- ✅ Module Jantes: structure base MVP, développement complet V2
- ✅ Push notifications: web push natif, uniquement atelier
- ✅ Signature électronique: obligatoire, horodatage, journal signatures
- ✅ Multi-langue: anglais, espagnol, italien (V2), choix langues actives
- ✅ Essai gratuit: notifications J+7/J+15/J+25 + onboarding guidé
- ✅ Backoffice éditeur: accès exclusif gestionnaire, logs audit, email auto si modification prix

---

## Fichiers du projet

### Documentation
- `PLAN.md` : Cahier des charges fonctionnel (v1.3 - finalisé)
- `METHODETRAVAIL.md` : Méthode de travail
- `SUIVI.md` : Ce fichier (suivi modifications)

### Code source
*(À compléter au fur et à mesure du développement)*

---

## Fonctionnalités implémentées

*(À compléter lors du développement)*

### MVP
- [ ] Compte atelier + rôles
- [ ] CRM basique
- [ ] Devis live + PDF + emails nouveau/existant + signature électronique (obligatoire, horodatage)
- [ ] Projets + étapes + photos (quota 20 GB, suppression auto 90%)
- [ ] Étiquettes (numéro + option QR) + impression PDF
- [ ] Catalogue poudres + import Thermopoudre + concurrent
- [ ] Stock théorique + pesée (tare par marque/format) + historique
- [ ] Séries strictes (batch) basiques
- [ ] Journal d'audit
- [ ] Structure base module Jantes (BDD préparée pour V2)

### V1
- [ ] Portail client final
- [ ] Inventaire partiel planifié + suggestions quotidiennes "à peser"
- [ ] Retouches/NC + stats
- [ ] Avis Google J+3 (API Google My Business avec tracking)
- [ ] Notifications push (atelier uniquement, web push natif) + emails
- [ ] Signature électronique complète (obligatoire, horodatage, journal signatures)
- [ ] Paiement client final: Stripe payment links + acompte/solde + statuts
- [ ] Factures client final + exports (CSV, FEC comptable avec archivage auto 10 ans, API Pennylane)
- [ ] Dashboard gestionnaire admin complet

### V2
- [ ] ThermoGestion Jantes complet
- [ ] Paiement SEPA GoCardless (B2B) + option PayPal
- [ ] Reporting avancé + backoffice éditeur complet
- [ ] Contrat prêt véhicule PDF + signature (option)
- [ ] Multi-langue (anglais, espagnol, italien, choix langues actives par atelier)
- [ ] Calendrier véhicules de prêt (custom + sync Google/Outlook, vue hebdomadaire)

---

## Notes importantes

### Techniques
- Multi-tenancy strict avec RLS Supabase
- Isolation données testée obligatoirement
- Mode offline prioritaire pour tablette atelier
- Compression photos automatique (qualité préservée, stockage + affichage haute qualité)
- Quota storage photos: 20 GB par défaut, suppression auto 90%
- Web push natif gratuit (pas service tiers) pour notifications atelier

### Métier
- Regroupement séries strict (même poudre exacte)
- Optimisation four avec contraintes crochet/marge
- Templates devis 100% personnalisables (zones configurables)
- Facturation électronique conforme
- Signature électronique obligatoire (pas de refus possible)
- Avis Google avec API tracking (pas juste lien direct)

### Légales
- Conformité RGPD complète
- WCAG 2.1 AA requis
- Facturation électronique France/EU
- FEC comptable: archivage auto 10 ans (durée légale France)
- Journal signatures: traçabilité légale (qui, quand, IP)

### Gestionnaire admin
- Accès exclusif gestionnaire (toi uniquement)
- Dashboard complet (ateliers, storage, prix, monitoring)
- Logs audit toutes modifications prix/quota
- Email automatique atelier si modification prix
- Gestion storage: suivi usage, alertes 80%/90%, suppression auto 90%

---

### [DATE_ACTUELLE] - Site vitrine et documents légaux

**Fichiers créés :**

#### Site vitrine (`/site-vitrine/`)
- `index.html` : Page d'accueil avec hero, fonctionnalités, avantages, CTA
- `fonctionnalites.html` : Page fonctionnalités détaillées (8 sections principales + Module Jantes)
- `tarifs.html` : Page tarifs avec Plan Lite/Pro, FAQ tarifs, CTA essai gratuit

#### Documents légaux (templates complets)
- `cgu.html` : Conditions Générales d'Utilisation (18 sections complètes)
- `cgv.html` : Conditions Générales de Vente (16 sections complètes)
- `confidentialite.html` : Politique de confidentialité RGPD (13 sections complètes, 8 droits utilisateur)
- `mentions-legales.html` : Mentions légales (9 sections)
- `cookies.html` : Politique cookies (8 sections, 4 catégories cookies)

#### Fichiers utilitaires
- `INFORMATIONS_SOCIETE.md` : Template à compléter avec toutes les infos nécessaires pour documents légaux
- `RESUME_SITE_VITRINE.md` : Résumé complet de ce qui a été créé, checklist, étapes de déploiement

**Modifications apportées :**

#### PLAN.md
- **SLA compensation** : Mise à jour compensation si SLA non respecté → **10% crédit facture** (tous plans)
  - Compensation proportionnelle (ex: 99.3% au lieu de 99.5% = 40% du crédit)
  - Crédit appliqué automatiquement sur prochaine facture

#### Design site vitrine
- **Style** : Bleu/noir moderne avec effets visuels (inspiré du fichier `moto-deco-site.html`)
- **Couleurs** : Gradients bleu-600 → cyan-500, noir background
- **Framework** : Tailwind CSS (CDN)
- **Effets** : Animations pulse, hover effects, gradients animés
- **Responsive** : Desktop, tablet, mobile

**Décisions prises :**
- **SLA compensation** : 10% crédit facture (tous plans) au lieu de 5-10% différencié
- **Design site** : Style moderne bleu/noir avec effets (comme moto-deco-site.html)
- **Documents légaux** : Templates complets avec placeholders à remplacer
- **Révision avocat** : Obligatoire avant mise en ligne (mentionnée dans tous les documents)
- **Domaines** : thermogestion.fr (site vitrine), status.thermogestion.fr (status page)

**Notes importantes :**

#### Site vitrine
- Toutes les pages utilisent le même header/footer cohérent
- Navigation principale : Accueil, Fonctionnalités, Tarifs, Témoignages, Aide, Contact
- Footer avec liens légaux sur toutes les pages
- CTA "Essai gratuit 30 jours" présent sur toutes les pages principales
- Responsive testé structure (à finaliser avec contenu réel)

#### Documents légaux
- **Tous les documents contiennent des placeholders** `[NOM_SOCIETE]`, `[SIRET]`, etc. à remplacer
- **Révision avocat obligatoire** : Mention explicite dans tous les documents
- **Conformité RGPD** : Politique confidentialité conforme RGPD (8 droits utilisateur détaillés)
- **Conformité consommation** : CGV avec droit de rétractation 14 jours, médiation consommation
- **Placeholders à compléter** : Voir `INFORMATIONS_SOCIETE.md` pour liste complète

#### Actions nécessaires avant mise en ligne
1. **Compléter informations société** : Ouvrir `INFORMATIONS_SOCIETE.md` et remplir tous les champs
2. **Remplacer placeholders** : Dans tous les documents légaux (recherche/remplacement global)
3. **Faire réviser par avocat** : Spécialisé numérique + RGPD + consommation
4. **Personnaliser contenu** : Tarifs exacts, descriptions si besoin, coordonnées contact
5. **Tester site** : Localement puis en production (liens, responsive, formulaires)
6. **Déployer** : Vercel/Netlify recommandé (HTTPS automatique, déploiement gratuit)
7. **Configurer domaines** : thermogestion.fr, status.thermogestion.fr

**Stack technique site vitrine :**
- HTML5 + Tailwind CSS (CDN)
- Design moderne avec gradients, animations, effets visuels
- Responsive (mobile-first)
- Prêt pour intégration analytics (Google Analytics)
- Prêt pour banner cookies (RGPD)

---

**Dernière mise à jour :** [DATE_ACTUELLE]
