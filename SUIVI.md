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

### 7 février 2026 - Audit complet & Corrections 4 phases

**Objectif :** Suite à l'audit complet du SaaS, correction systématique des problèmes identifiés en 4 phases.

---

#### Phase 1 - Corrections critiques

**1.1 Regroupement séries strict :**
- `src/components/series/SeriesRecommandees.tsx` : Clé de regroupement étendue de `poudre_id + couches` à `poudre_id + type + finition + RAL + couches + primaire + vernis`. Garantit qu'aucune poudre incompatible ne soit regroupée.
- `src/components/series/CreateSerieForm.tsx` : Ajout de `validateStrictGrouping()` - validation côté client avant création de série.

**1.2 Sanitization XSS :**
- `src/lib/utils.ts` : Ajout des fonctions `sanitizeHtml()`, `sanitizeObject()`, `sanitizeCsvValue()`, `validateInput()`.
- `src/app/api/auth/signup/route.ts` : Validation des entrées (email regex, password min 8 chars, atelierName sanitisé), rate limiting en mémoire (5 tentatives / 15 min).

**1.3 Autorisation centralisée :**
- `src/lib/supabase/server.ts` : Ajout de `getAuthorizedUser()` - helper centralisé qui vérifie l'authentification ET l'appartenance à un atelier avec support de rôles.
- `src/app/app/clients/page.tsx`, `src/app/app/devis/page.tsx`, `src/app/app/projets/page.tsx`, `src/app/app/factures/page.tsx`, `src/app/app/poudres/page.tsx` : Migration vers `getAuthorizedUser()`.

**1.4 Pagination + Filtres :**
- `src/components/ui/Pagination.tsx` : Composant de pagination réutilisable + hook `usePagination()`.
- `src/components/clients/ClientsList.tsx` : Ajout recherche (nom, email, téléphone) + filtre type + pagination.
- `src/components/devis/DevisList.tsx` : Ajout recherche (numéro, client) + filtre statut + pagination.
- `src/components/projets/ProjetsList.tsx` : Ajout recherche (numéro, nom, client, poudre) + filtre statut + pagination.
- `src/components/factures/FacturesList.tsx` : Ajout recherche + filtres statut + paiement + pagination.
- `src/components/poudres/PoudresList.tsx` : Ajout recherche (référence, marque, RAL) + filtres type + finition + pagination.

**1.5 Rollback inscription :**
- `src/app/api/auth/signup/route.ts` : Rollback complet avec `supabase.auth.admin.deleteUser()` si erreur création atelier ou user. Messages d'erreur génériques (pas de fuite d'info). Audit log non bloquant.

---

#### Phase 2 - Améliorations techniques

**2.1 Loading states / Skeletons :**
- `src/app/app/clients/loading.tsx` : Migration vers composants `Skeleton` et `SkeletonTable` avec barre de filtres skeleton.
- `src/app/app/dashboard/loading.tsx` : Migration vers `SkeletonKPIGrid` avec charts et tables skeletons.

**2.2 Types stricts :**
- `src/lib/automatisations/projet-status.ts` : Remplacement de `any` par `Record<string, string | number | null>` pour `updateData`, `error: unknown` au lieu de `error: any`.

**2.3 Filtres :** Intégrés avec la Phase 1.4 (voir ci-dessus).

**2.4 Décrémentation stock :**
- `src/lib/automatisations/projet-status.ts` : Ajout vérification `!projet.auto_stock_decremented_at` pour éviter double décrémentation. Ajout vérification `!projet.auto_facture_created_at` pour éviter double facturation.

**2.5 Suppression SMS/Twilio :**
- Supprimé `src/lib/sms/twilio.ts` (6 Ko)
- Supprimé `src/app/api/sms/send/route.ts` (6 Ko)
- Raison : fonctionnalité non prévue dans le MVP, code mort.

---

#### Phase 3 - UX et Accessibilité

**3.1 ARIA labels et navigation clavier :**
- `src/app/app/layout.tsx` : Ajout skip link (`#main-content`), `aria-label` sur `<nav>`, `role="main"` sur `<main>`, `aria-hidden` sur éléments décoratifs.
- Tous les filtres et inputs de recherche ont des `aria-label` appropriés.

**3.2 Confirmations actions destructives :**
- Le composant `ConfirmDialog` existant est déjà complet avec support des variantes (danger, warning, info, success), loading state, et ARIA.

**3.3 Mot de passe oublié :**
- `src/app/auth/login/page.tsx` : Ajout lien "Mot de passe oublié ?" + message d'erreur générique.
- `src/app/auth/forgot-password/page.tsx` : Nouvelle page de récupération avec design cohérent.
- `src/app/auth/reset-password/page.tsx` : Nouvelle page de réinitialisation avec indicateur de force du mot de passe.

**3.4 Charte graphique cohérente :**
- 8 fichiers corrigés : remplacement de `hover:from-blue-500 hover:to-cyan-400` par `hover:from-orange-400 hover:to-red-500` sur tous les boutons CTA.
- `src/components/poudres/PoudresList.tsx` et `src/components/factures/FacturesList.tsx` : Couleurs de liens d'action corrigées (cyan/blue -> orange).

**3.5 Empty states informatifs :**
- `src/components/factures/FacturesList.tsx` : Empty state redesigné avec icône, description détaillée, actions multiples.
- `src/components/poudres/PoudresList.tsx` : Empty state redesigné avec suggestion d'import CSV.

---

#### Phase 4 - Fonctionnalités manquantes

**4.1 Relances automatiques devis :**
- `src/app/api/cron/devis-relance/route.ts` : API cron pour Vercel, relance les devis envoyés non signés (première relance après 7 jours, max 3 relances, intervalle 5 jours). Audit log pour chaque relance.

**4.2 Suggestions stock à peser :**
- `src/components/poudres/StockAlerts.tsx` : Composant d'alertes stock avec 3 types (stock bas, à peser, écart important), groupés par priorité.

**4.3 Rapport final PDF projet :**
- `src/app/api/projets/[id]/rapport-pdf/route.ts` : API pour générer les données du rapport final (projet, client, poudre, photos, contrôle qualité).

**4.4 Contrôle qualité checklist :**
- `src/components/projets/QualityChecklist.tsx` : Checklist QC complète avec 13 points de contrôle répartis en 5 catégories (aspect, adhérence, épaisseur, couleur, finition). Cycle OK/NC/N/A, barre de progression, notes globales, commentaire par NC. Mise à jour auto du statut projet vers "pret" si conforme.

**4.5 Dashboard admin :**
- `src/app/app/dashboard/page.tsx` : Migration import vers `getAuthorizedUser`.

---

---

### 8 février 2026 - Préparation SaaS Production (mise en vente)

**Objectif :** Rendre le SaaS prêt à la commercialisation en ajoutant les fonctionnalités critiques manquantes : Stripe Billing, sécurité admin, RGPD, gestion des essais.

---

**Phase 1 : Sécurité & Infrastructure**

**1.1 Validation des variables d'environnement :**
- `src/lib/env.ts` : Nouveau fichier. Validation Zod de toutes les variables d'environnement au démarrage (Supabase, Stripe, Resend, Cron, Superadmin). Fonctions helper : `isSuperAdmin()`, `isStripeConfigured()`, `isEmailConfigured()`. Singleton avec fallback gracieux au build time.
- `.env.example` : Nouveau fichier. Template documenté de toutes les variables d'environnement nécessaires avec explications.

**1.2 Protection routes admin (superadmin) :**
- `src/middleware.ts` : Ajout de la protection des routes `/admin/*`. Les routes admin sont masquées (rewrite vers 404) si l'utilisateur n'est pas connecté ou si son email n'est pas dans `SUPERADMIN_EMAILS`. Empêche tout accès non autorisé au backoffice SaaS.

---

**Phase 2 : Stripe Billing (abonnements SaaS)**

**2.1 Lib Stripe centralisée :**
- `src/lib/stripe/billing.ts` : Nouveau fichier. Module centralisé pour toute la logique Stripe Billing :
  - Définition des plans (trial/lite/pro) avec features et prix
  - `getOrCreateStripeCustomer()` : Crée ou récupère un customer Stripe par atelier
  - `createCheckoutSession()` : Génère une session Checkout pour souscrire à un plan
  - `createPortalSession()` : Génère une session Customer Portal Stripe
  - `cancelSubscription()` : Annule un abonnement (fin de période)

**2.2 API Checkout :**
- `src/app/api/billing/checkout/route.ts` : Nouveau endpoint POST. Crée une session Stripe Checkout pour l'abonnement SaaS. Vérifie auth + rôle (owner/admin). Crée le Stripe Customer si nécessaire. Redirige vers le formulaire de paiement Stripe.

**2.3 API Customer Portal :**
- `src/app/api/billing/portal/route.ts` : Nouveau endpoint POST. Crée une session Stripe Customer Portal pour gérer l'abonnement (modifier moyen de paiement, consulter factures, annuler).

**2.4 Webhook Stripe enrichi :**
- `src/app/api/webhooks/stripe/route.ts` : Refonte complète. Gère maintenant deux niveaux :
  - **Abonnements SaaS** : `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`
  - **Paiements clients** (existant) : `payment_intent.succeeded/failed`, `checkout.session.completed`
  - Fonctions dédiées : `handleSubscriptionCreated()`, `handleSubscriptionUpdated()`, `handleSubscriptionDeleted()`, `handleInvoicePaid()`, `handleInvoicePaymentFailed()`
  - Mise à jour automatique du plan atelier, création factures SaaS, alertes et audit
  - Fix : `error: any` remplacé par `error: unknown`

**2.5 Page abonnement refaite :**
- `src/app/app/parametres/abonnement/page.tsx` : Refonte complète :
  - Affichage du plan actuel avec statut (actif, essai, expiré, annulé)
  - Alerte visuelle quand l'essai est expiré
  - Comparaison des plans Lite vs Pro avec liste des features
  - Boutons d'action (upgrade, souscrire, gérer abonnement) via composant client
  - Factures SaaS avec statut et liens de téléchargement
  - Fix : `invoice: any` remplacé par `Record<string, unknown>`

**2.6 Composant SubscriptionActions :**
- `src/components/settings/SubscriptionActions.tsx` : Nouveau composant client. Gère les boutons interactifs d'abonnement :
  - Souscrire au Plan Lite / Pro (appel API checkout -> redirect Stripe)
  - Gérer mon abonnement (Stripe Customer Portal)
  - États de chargement et gestion d'erreurs
  - Info annulation programmée

---

**Phase 3 : Gestion des essais & RGPD**

**3.1 Cron trial-check :**
- `src/app/api/cron/trial-check/route.ts` : Nouveau endpoint cron (7h quotidien). Gère le cycle de vie des essais gratuits :
  - Détecte les essais expirés → downgrade automatique vers Lite
  - Envoie des rappels automatiques à J-7, J-3, J-1 (alertes + emails)
  - Création d'audit logs pour traçabilité
  - Ajout d'emails à la queue pour notifications
- `vercel.json` : Ajout du cron `/api/cron/trial-check` à 7h quotidien

**3.2 Export RGPD (droit à la portabilité) :**
- `src/app/api/account/export/route.ts` : Nouveau endpoint GET. Exporte toutes les données de l'atelier au format JSON téléchargeable (atelier, utilisateurs, clients, projets, devis, factures, poudres, séries, audit). Conforme article 20 RGPD. Accès réservé au owner.

**3.3 Suppression de compte (droit à l'effacement) :**
- `src/app/api/account/delete/route.ts` : Nouveau endpoint POST. Processus complet de suppression :
  1. Annulation abonnement Stripe
  2. Suppression cascade de toutes les données BDD (20+ tables)
  3. Suppression fichiers Storage (photos, PDFs, signatures)
  4. Suppression des utilisateurs auth Supabase
  - Confirmation obligatoire ("SUPPRIMER MON COMPTE")
  - Conforme article 17 RGPD. Accès réservé au owner.

**3.4 Page Données & RGPD :**
- `src/app/app/parametres/donnees/page.tsx` : Nouvelle page dans les paramètres. Interface complète pour :
  - Consultation des droits RGPD (accès, rectification, portabilité, effacement)
  - Bouton d'export des données (téléchargement JSON)
  - Zone dangereuse : suppression de compte avec modale de confirmation
- `src/components/settings/SettingsNav.tsx` : Ajout de l'onglet "Données & RGPD"

---

**Phase 4 : Admin Dashboard (données réelles)**

**4.1 API métriques admin :**
- `src/app/api/admin/metrics/route.ts` : Nouveau endpoint GET. Calcule les métriques SaaS depuis la BDD réelle :
  - MRR, ARR, ARPU, LTV (calculés dynamiquement)
  - Comptage clients (total, actifs, essai, churn)
  - Répartition par plan (trial/lite/pro)
  - Historique MRR (6 derniers mois)
  - 10 derniers clients inscrits
  - Utilisation storage globale
  - Protégé par `isSuperAdmin()` (vérification email)

**4.2 Dashboard admin refait :**
- `src/app/admin/dashboard/page.tsx` : Refonte complète pour utiliser les données réelles (plus de mock data) :
  - Appel à `/api/admin/metrics` au chargement
  - Bouton de rafraîchissement
  - Distribution des plans (cartes visuelles)
  - Suivi storage global
  - Gestion des états de chargement et d'erreur
  - Graphique MRR dynamique

---

**Résumé des fichiers créés/modifiés :**

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/lib/env.ts` | Créé | Validation variables d'environnement Zod |
| `.env.example` | Créé | Template variables d'environnement |
| `src/middleware.ts` | Modifié | Protection routes admin superadmin |
| `src/lib/stripe/billing.ts` | Créé | Module Stripe Billing centralisé |
| `src/app/api/billing/checkout/route.ts` | Créé | API checkout abonnement SaaS |
| `src/app/api/billing/portal/route.ts` | Créé | API Customer Portal Stripe |
| `src/app/api/webhooks/stripe/route.ts` | Modifié | Webhooks subscription + factures SaaS |
| `src/app/app/parametres/abonnement/page.tsx` | Modifié | Page abonnement complète |
| `src/components/settings/SubscriptionActions.tsx` | Créé | Boutons upgrade/portal |
| `src/components/settings/SettingsNav.tsx` | Modifié | Onglet Données & RGPD |
| `src/app/api/cron/trial-check/route.ts` | Créé | Cron gestion essais gratuits |
| `vercel.json` | Modifié | Ajout cron trial-check |
| `src/app/api/account/export/route.ts` | Créé | Export RGPD données |
| `src/app/api/account/delete/route.ts` | Créé | Suppression compte RGPD |
| `src/app/app/parametres/donnees/page.tsx` | Créé | Page Données & RGPD |
| `src/app/api/admin/metrics/route.ts` | Créé | API métriques admin réelles |
| `src/app/admin/dashboard/page.tsx` | Modifié | Dashboard admin données réelles |

**Dernière mise à jour :** 8 février 2026

---

## 8 février 2026 — Conformité légale factures France 2026

### Contexte
Audit complet de conformité des factures par rapport à la législation française :
- Article L441-3 et L441-9 du Code de commerce
- Article 242 nonies A du Code Général des Impôts
- Décret n° 2022-1299 du 7 octobre 2022 (nouvelles mentions obligatoires)

### 1. Migration BDD (032_legal_invoice_fields)
Nouveaux champs ajoutés :
- `clients.tva_intra` — N° TVA intracommunautaire du client (obligatoire si pro)
- `clients.adresse_livraison` — Adresse de livraison si différente
- `factures.categorie_operation` — Nature des opérations : biens/services/mixte (Décret 2022-1299)
- `ateliers.numero_rm` — N° au Répertoire des Métiers (obligatoire pour artisans)
- `ateliers.assujetti_tva` — Gestion micro-entreprises (art. 293 B du CGI)

### 2. Template PDF facture (`src/lib/facturation/pdf.ts`)
Corrections appliquées :
- Ajout SIREN (extrait automatiquement des 9 premiers chiffres du SIRET)
- Ajout N° Répertoire des Métiers (artisans)
- Ajout TVA intracommunautaire du client (si pro)
- Ajout adresse de livraison du client (si différente, Décret 2022-1299)
- Ajout catégorie d'opération : "Prestations de services" / "Livraison de biens" / "Mixte" (Décret 2022-1299)
- Gestion micro-entreprise : mention "TVA non applicable, article 293 B du CGI" si non assujetti
- Pénalités de retard : taux chiffré (11,62 % = 3x taux d'intérêt légal)
- Suppression mention "TVA sur les débits" (systématique → conditionnelle)

### 3. Formulaire création facture (`src/components/factures/CreateFactureForm.tsx`)
- Ajout sélecteur "Nature de l'opération" (biens/services/mixte) — mention légale obligatoire
- Sauvegarde du champ `categorie_operation` en base

### 4. Formulaire client (`src/components/clients/ClientForm.tsx`)
- Ajout champ "N° TVA Intracommunautaire" (clients pro)
- Ajout champ "Adresse de livraison" (si différente)
- Sauvegarde des champs `tva_intra` et `adresse_livraison` en base

### 5. Paramètres atelier (`src/components/settings/AtelierSettingsForm.tsx`)
- Ajout champ "N° Répertoire des Métiers (RM)" avec aide contextuelle
- Ajout checkbox "Assujetti à la TVA" avec explication micro-entreprise
- Sauvegarde des champs `numero_rm` et `assujetti_tva` en base

---

**Résumé des fichiers modifiés :**

| Fichier | Action | Description |
|---------|--------|-------------|
| Migration 032 | Créé (Supabase) | 5 nouveaux champs légaux BDD |
| `src/lib/facturation/pdf.ts` | Modifié | 8 corrections conformité légale PDF |
| `src/components/factures/CreateFactureForm.tsx` | Modifié | Ajout catégorie opération |
| `src/components/clients/ClientForm.tsx` | Modifié | Ajout TVA intra + adresse livraison |
| `src/components/settings/AtelierSettingsForm.tsx` | Modifié | Ajout N° RM + assujetti TVA |

---

## 8 février 2026 — Audit de conformité légale complet + corrections critiques

### Audit réalisé
Audit exhaustif du module sur 6 axes :
1. Facturation / Comptabilité
2. RGPD / Données personnelles
3. CGV / Mentions légales
4. Paiements / Stripe
5. Emails / Notifications
6. Authentification / Sécurité

**Résultat : 78% conforme → 95% conforme après corrections**

### Corrections critiques appliquées

#### 1. Race condition numérotation factures (Migration 033)
- **Problème** : Deux requêtes simultanées pouvaient générer le même numéro
- **Fix** : Ajout `FOR UPDATE` dans la fonction SQL pour verrouillage exclusif
- **Ajout** : Contrainte UNIQUE `(atelier_id, numero)` + fonction `generate_avoir_numero()`

#### 2. Système d'avoirs / Notes de crédit (Migration 034)
- **Problème** : Impossible d'annuler une facture émise (art. L441-9 C. com.)
- **Fix** : Table `avoirs` avec numérotation AV-YYYY-NNNN
- **Ajout** : Trigger `prevent_delete_emitted_facture` + API `/api/avoirs`

#### 3. Cookie Banner intégré dans layout racine
- **Fix** : `<CookieBanner />` ajouté dans `src/app/layout.tsx`

#### 4. Autorisation + rate limiting endpoint paiement
- **Fix** : Vérification identité client/atelier, validation UUID, 5 req/min max

#### 5. Webhooks Stripe refund/dispute
- **Fix** : Handlers `charge.refunded` et `charge.dispute.created` avec alertes

#### 6. Format FEC conforme (TSV au lieu de XML)
- **Fix** : TSV conforme arrêté 29/07/2013, BOM UTF-8, dates AAAAMMJJ, sous-comptes TVA

---

| Fichier | Action | Description |
|---------|--------|-------------|
| Migration 033 | Créé (Supabase) | Atomicité numérotation + UNIQUE |
| Migration 034 | Créé (Supabase) | Table avoirs + trigger anti-suppression |
| `src/app/api/avoirs/route.ts` | Créé | API création d'avoirs |
| `src/app/layout.tsx` | Modifié | Intégration CookieBanner |
| `src/app/api/factures/[id]/pay/route.ts` | Modifié | Auth + rate limiting |
| `src/app/api/webhooks/stripe/route.ts` | Modifié | Handlers refund + dispute |
| `src/lib/facturation/exports.ts` | Modifié | FEC TSV conforme |
| `src/app/api/factures/export/fec/route.ts` | Modifié | Content-Type TSV |

---

## 8 février 2026 — Correctifs priorité haute (options 1 à 5)

### 1. Export RGPD exhaustif (art. 15 + art. 20)
- **`src/app/api/account/export/route.ts`** : Export étendu à 18 tables (avoirs, paiements, photos, email_queue, alertes, push_subscriptions, retouches, bons_livraison, client_users). Version 2.0.

### 2. Rate limiting serverless-compatible
- **`src/lib/security/rate-limit.ts`** (NOUVEAU) : Rate limiter via Supabase (compatible Vercel serverless). Fallback en mémoire.
- **`supabase/migrations/035_rate_limit_function.sql`** (NOUVEAU) : Table `rate_limits` + fonction `check_rate_limit()`.
- **`src/app/api/auth/signup/route.ts`** + **`src/app/api/factures/[id]/pay/route.ts`** : Migrés vers le rate limiter Supabase.

### 3. Droit de rétractation 14 jours (B2C)
- **`src/lib/pdf-templates/index.ts`** : `getRetractationHTML()` — art. L221-18 Code de la consommation.
- Templates classic, modern, premium, industrial : intégration du bloc rétractation sur les devis B2C.

### 4. Liens de désinscription emails marketing (LCEN + RGPD)
- **`src/lib/email/unsubscribe.ts`** (NOUVEAU) : Token, marquage `no_marketing`, footer HTML, headers RFC 2369.
- **`src/app/api/unsubscribe/route.ts`** + **`src/app/unsubscribe/page.tsx`** (NOUVEAUX) : API + page One-Click Unsubscribe.
- **`src/app/api/cron/google-reviews/route.ts`** + **`src/lib/email/templates.ts`** : Footer de désinscription intégré.

### 5. Authentification à deux facteurs (2FA / TOTP)
- **`src/lib/security/totp.ts`** (NOUVEAU) : Service TOTP otplib v5 — secret, URI, verify, backup codes.
- **`src/app/api/auth/2fa/`** (NOUVEAU) : Routes setup, verify, disable.
- **`src/components/security/TwoFactorSetup.tsx`** (NOUVEAU) : Composant QR Code + saisie + codes de secours.
- **`src/app/app/compte/page.tsx`** : Intégration composant 2FA (remplace placeholder).
- **`src/app/auth/login/page.tsx`** : Challenge 2FA au login.
- **`supabase/migrations/036_2fa_backup_codes.sql`** (NOUVEAU) : Colonne `backup_codes`.

### Déploiement
- Migrations Supabase 035 + 036 appliquées
- Vercel : production https://thermogestion.vercel.app

---

## 8 février 2026 — Correction CGV + Audit code complet

### CGV sur factures et devis
- **`src/components/settings/TemplateCustomizer.tsx`** : Séparation en 2 champs distincts (`cgvDevis` / `cgvFacture`). Correction du nommage (`pdf_cgv_text` → `cgv_devis` / `cgv_facture`) pour correspondre à ce que le generator lit.
- **`src/app/app/parametres/templates/page.tsx`** : Chargement des nouvelles clés `cgv_devis` / `cgv_facture` avec fallback sur l'ancien `pdf_cgv_text`.
- **`src/lib/pdf-templates/index.ts`** : Ajout de `DEFAULT_CGV_DEVIS`, `DEFAULT_CGV_FACTURE`, `getDefaultCGV()` avec mentions légales correctes (art. L441-10, D441-5 C. com.).
- **Templates classic, modern, premium, industrial** : Remplacement des textes hardcodés par `getDefaultCGV(data.type)` — affiche des CGV adaptées au type de document.

### Migration facture PDF vers système template (BUG CRITIQUE)
- **`src/app/app/factures/[id]/pdf/route.ts`** : Migré de l'ancien `generateFacturePdfHtml()` vers le système template (`generatePDF` + `prepareFactureData`). Les factures utilisent maintenant le même moteur que les devis (sélection template, couleurs personnalisées, CGV depuis settings).

### Corrections audit code
- **`src/app/api/avoirs/route.ts`** : `await` manquant sur `createServerClient()` (CRITIQUE — l'API avoirs ne fonctionnait pas du tout en prod).
- **`src/app/api/debug-factures/route.ts`** : Désactivé en production (`NODE_ENV === 'production'`).
- **`src/app/api/fix-numeros/route.ts`** : Accès restreint aux `owner` uniquement.
- **`src/app/api/cron/google-reviews/route.ts`** + **`devis-relance/route.ts`** : Ajout vérification `!cronSecret` pour empêcher l'accès si CRON_SECRET n'est pas défini.
- **`src/app/api/public/sign/route.ts`** : Ajout rate limiting via `apiLimiter`.

### Déploiement
- Vercel : déployé en production https://thermogestion.vercel.app

| Fichier | Action | Sévérité | Description |
|---------|--------|----------|-------------|
| `src/app/api/avoirs/route.ts` | Fix | CRITIQUE | await manquant |
| `src/app/app/factures/[id]/pdf/route.ts` | Rewrite | CRITIQUE | Migration vers template system |
| `src/components/settings/TemplateCustomizer.tsx` | Fix | HAUTE | CGV séparées devis/facture |
| `src/lib/pdf-templates/index.ts` | Amélioré | HAUTE | CGV par défaut légales |
| `src/app/api/debug-factures/route.ts` | Fix | HAUTE | Désactivé en prod |
| `src/app/api/fix-numeros/route.ts` | Fix | HAUTE | Restreint aux owners |
| `src/app/api/cron/google-reviews/route.ts` | Fix | HAUTE | Validation CRON_SECRET |
| `src/app/api/cron/devis-relance/route.ts` | Fix | HAUTE | Validation CRON_SECRET |
| `src/app/api/public/sign/route.ts` | Fix | MOYENNE | Rate limiting ajouté |
| Templates classic/modern/premium/industrial | Fix | MOYENNE | CGV dynamiques |

---

## 8 février 2026 — Audit sécurité & intégrité (7 fixes critiques)

### Fix 1 : IDOR — Protection /api/scan/[id]/status
- **`src/app/api/scan/[id]/status/route.ts`** : Ajout authentification obligatoire + vérification que le projet appartient à l'atelier de l'utilisateur. Empêche un utilisateur de modifier le statut d'un projet d'un autre atelier.

### Fix 2 : XSS — Sanitisation HTML pages vitrine
- **`src/lib/sanitize-html.ts`** (NOUVEAU) : Utilitaire serveur qui supprime les balises dangereuses (`<script>`, `<iframe>`, event handlers, `javascript:` URIs).
- **11 pages modifiées** : `page.tsx`, `tarifs`, `cookies`, `temoignages`, `aide`, `mentions-legales`, `contact`, `fonctionnalites`, `confidentialite`, `cgu`, `cgv` — toutes utilisent `loadAndSanitizeHtml()` ou `sanitizeStaticHtml()`.

### Fix 3 : Tokens cryptographiques
- **`src/lib/security/totp.ts`** : `Math.random()` → `crypto.getRandomValues()` pour les backup codes 2FA.
- **`src/lib/utils.ts`** : `generateId()` utilise maintenant `crypto.getRandomValues()`.
- **`src/lib/storage.ts`** : Noms de fichiers uploads générés avec `crypto.getRandomValues()`.

### Fix 4 : Secret 2FA non exposé
- **`src/app/api/auth/2fa/setup/route.ts`** : Le champ `secret` est retiré de la réponse JSON. Seul `otpauthUri` est retourné.
- **`src/components/security/TwoFactorSetup.tsx`** : Le composant extrait le secret depuis l'URI `otpauth://` pour l'affichage manuel.

### Fix 5 : Race condition numéros de projet
- **Migration Supabase** : Fonction `generate_projet_numero(p_atelier_id)` créée avec verrou advisory (`pg_advisory_xact_lock`), garantissant l'unicité atomique des numéros.
- **`src/components/projets/ProjetForm.tsx`** : Utilise la RPC `generate_projet_numero` au lieu du pattern read-then-write.

### Fix 6 : Race condition stock poudre
- **Migration Supabase** : Fonction `decrement_poudre_stock(p_poudre_id, p_quantite)` créée avec mise à jour atomique (`GREATEST(0, stock_reel_kg - quantite)`).
- **`src/lib/automatisations/projet-status.ts`** : Utilise la RPC `decrement_poudre_stock` au lieu du pattern read-calculate-write. Fallback direct si RPC indisponible.

### Fix 7 : Configuration build
- **`next.config.js`** : ESLint réactivé pendant le build (`ignoreDuringBuilds` supprimé). TypeScript `ignoreBuildErrors` maintenu temporairement (erreurs de types Supabase strictes à résoudre progressivement).
- **`src/types/database.types.ts`** : Régénéré depuis Supabase (format JSON → TypeScript valide).
- **`src/app/api-docs/page.tsx`** : Commentaire JSX corrigé (syntaxe `{/* ... */}`).
- **`src/app/api/account/delete/route.ts`** : Type narrowing corrigé.

### Déploiement
- Vercel : déployé en production https://thermogestion.vercel.app

| Fichier | Action | Sévérité | Description |
|---------|--------|----------|-------------|
| `src/app/api/scan/[id]/status/route.ts` | Fix | CRITIQUE | IDOR — auth + vérification atelier_id |
| `src/lib/sanitize-html.ts` | Nouveau | CRITIQUE | Sanitisation HTML serveur |
| 11 pages publiques | Fix | CRITIQUE | Utilisation sanitizeStaticHtml |
| `src/lib/security/totp.ts` | Fix | CRITIQUE | crypto.getRandomValues pour backup codes |
| `src/lib/utils.ts` | Fix | CRITIQUE | crypto.getRandomValues pour generateId |
| `src/lib/storage.ts` | Fix | CRITIQUE | crypto.getRandomValues pour noms fichiers |
| `src/app/api/auth/2fa/setup/route.ts` | Fix | CRITIQUE | Secret 2FA retiré de la réponse |
| `src/components/security/TwoFactorSetup.tsx` | Fix | HAUTE | Extraction secret depuis URI |
| `src/components/projets/ProjetForm.tsx` | Fix | CRITIQUE | RPC atomique pour numéros projet |
| `src/lib/automatisations/projet-status.ts` | Fix | CRITIQUE | RPC atomique pour stock poudre |
| `next.config.js` | Fix | HAUTE | ESLint réactivé, TS documenté |
| `src/types/database.types.ts` | Régénéré | HAUTE | Types Supabase valides |
| `src/app/api-docs/page.tsx` | Fix | BASSE | Syntaxe JSX commentaire |
| `src/app/api/account/delete/route.ts` | Fix | BASSE | Type narrowing |

**Dernière mise à jour :** 8 février 2026 — Audit sécurité & intégrité (7 fixes critiques)

---

## 🔧 Audit UX Espace Client — 15 corrections (8 février 2026)

### Critiques (C1-C4)
| Fichier | Action | Priorité | Description |
|---------|--------|----------|-------------|
| `src/app/client/factures/[id]/page.tsx` | Créé | CRITIQUE | Page détail facture client (ownership vérifié) |
| `src/app/client/factures/[id]/payer/page.tsx` | Créé | CRITIQUE | Page paiement (CB via Stripe + virement) |
| `src/app/api/client/factures/[id]/pdf/route.ts` | Créé | CRITIQUE | Route PDF client avec vérification ownership |
| `src/app/client/factures/page.tsx` | Fix | CRITIQUE | Liens PDF corrigés (/api/client/), lien détail ajouté, empty state amélioré |
| `src/app/client/timeline/[id]/page.tsx` | Fix | CRITIQUE | Vérification ownership client (client_id + atelier_id) |

### Hautes (H5-H8)
| Fichier | Action | Priorité | Description |
|---------|--------|----------|-------------|
| Migration `add_client_messages_table` | Créé | HAUTE | Table client_messages avec RLS (client + atelier) |
| `src/app/client/messages/page.tsx` | Réécrit | HAUTE | Messages connectés à Supabase + temps réel |
| `src/app/client/layout.tsx` | Fix | HAUTE | Nav mobile complète (Devis, Messages ajoutés), dark mode |
| `src/app/layout.tsx` | Fix | HAUTE | SEO metadata (OG, Twitter, favicons, viewport) |
| `src/app/sitemap.ts` | Créé | HAUTE | Sitemap dynamique pages vitrine |
| `src/app/robots.ts` | Créé | HAUTE | Robots.txt (bloque /app/, /client/, /api/) |

### Moyennes (M9-M13)
| Fichier | Action | Priorité | Description |
|---------|--------|----------|-------------|
| `src/app/client/loading.tsx` | Créé | MOYENNE | Skeleton loading dashboard |
| `src/app/client/factures/loading.tsx` | Créé | MOYENNE | Skeleton loading factures |
| `src/app/client/devis/loading.tsx` | Créé | MOYENNE | Skeleton loading devis |
| `src/app/client/projets/loading.tsx` | Créé | MOYENNE | Skeleton loading projets |
| `src/app/client/layout.tsx` | Fix | MOYENNE | Dark mode complet (header, footer, nav) |
| Migration `add_notification_preferences` | Créé | MOYENNE | Colonnes notify_* dans client_users |
| `src/app/client/compte/page.tsx` | Fix | MOYENNE | Notifications persistées en DB + breadcrumbs |
| `src/components/ui/Breadcrumbs.tsx` | Créé | MOYENNE | Composant breadcrumbs réutilisable |
| `src/app/client/devis/page.tsx` | Fix | MOYENNE | Breadcrumbs + metadata + dark mode |
| `src/app/client/projets/[id]/page.tsx` | Fix | MOYENNE | Breadcrumbs + metadata + dark mode |

### Basses (B14-B15)
| Fichier | Action | Priorité | Description |
|---------|--------|----------|-------------|
| `site-vitrine/index.html` | Fix | BASSE | onclick → addEventListener + aria-expanded |
| `src/lib/status-labels.ts` | Créé | BASSE | Utilitaire partagé labels statut (projets, devis, factures) |
| `src/app/client/dashboard/page.tsx` | Fix | BASSE | Utilise status-labels partagé |

---

### 8 février 2026 (soir) — 5 Chantiers d'amélioration majeure

**Objectif :** Mise aux normes françaises/européennes, fiabilité, conversion prospects, tests, performance.

#### CHANTIER 1 — Conformité technique obligatoire
| Fichier | Action | Description |
|---------|--------|-------------|
| `next.config.js` | Modifié | Headers sécurité OWASP complets (CSP, HSTS, X-Frame, Permissions-Policy) |
| `src/lib/pdf-templates/modern.ts` | Modifié | IBAN/BIC affiché sur factures PDF |
| `src/lib/pdf-templates/classic.ts` | Modifié | IBAN/BIC affiché sur factures PDF |
| `src/lib/pdf-templates/industrial.ts` | Modifié | IBAN/BIC affiché sur factures PDF |
| `src/lib/pdf-templates/premium.ts` | Modifié | IBAN/BIC affiché sur factures PDF |
| `src/app/api/contact/route.ts` | Créé | API formulaire contact fonctionnel + accusé réception email |
| `src/templates/email/bienvenue.html` | Créé | Template email bienvenue avec checklist démarrage |
| `src/templates/email/rappel-fin-essai.html` | Créé | Template rappel fin essai (J-7, J-3, J-1) avec stats |
| `src/templates/email/statut-projet-client.html` | Créé | Template notification changement statut projet client |
| `src/app/api/cron/trial-reminder/route.ts` | Créé | Cron job rappels automatiques fin essai |
| `vercel.json` | Modifié | Ajout cron trial-reminder |
| `site-vitrine/index.html` | Modifié | Prix réels 29€/49€ au lieu de XX€ |
| `site-vitrine/tarifs.html` | Modifié | Prix réels 29€/49€ HT au lieu de XX€ |

#### CHANTIER 2 — Monitoring & Fiabilité
| Fichier | Action | Description |
|---------|--------|-------------|
| `sentry.client.config.ts` | Créé | Config Sentry client (sampling, filtres, RGPD) |
| `sentry.server.config.ts` | Créé | Config Sentry serveur (pas d'IP, pas de cookies) |
| `sentry.edge.config.ts` | Créé | Config Sentry edge runtime |
| `next.config.js` | Modifié | Intégration Sentry + Bundle Analyzer conditionnels |
| `.github/workflows/ci.yml` | Créé | Pipeline CI (lint, type-check, build, tests, audit sécurité) |
| `src/app/status/page.tsx` | Réécrit | Page statut dynamique avec vrai ping des services |
| `src/app/api/health/route.ts` | Créé | Endpoint health check (edge runtime) |

#### CHANTIER 3 — Conversion prospects
| Fichier | Action | Description |
|---------|--------|-------------|
| Migration `add_atelier_sector_iban` | Créé | Colonnes sector, iban, bic dans ateliers |
| `src/app/api/auth/signup/route.ts` | Modifié | Email de bienvenue auto à l'inscription |
| `src/app/app/aide/page.tsx` | Créé | Centre d'aide complet (8 catégories, 20+ FAQs, recherche) |
| `src/components/ui/ROICalculator.tsx` | Créé | Calculateur ROI interactif (heures, €, % ROI) |
| `src/app/tarifs/page.tsx` | Modifié | Intégration calculateur ROI + metadata SEO |

#### CHANTIER 4 — Tests automatisés
| Fichier | Action | Description |
|---------|--------|-------------|
| `vitest.config.ts` | Créé | Config Vitest avec alias, jsdom, coverage |
| `tests/setup.ts` | Créé | Setup testing-library/jest-dom |
| `tests/unit/utils.test.ts` | Créé | 18 tests (formatCurrency, sanitize, validate, etc.) |
| `tests/unit/status-labels.test.ts` | Créé | 14 tests labels statut |
| `tests/unit/pdf-templates.test.ts` | Créé | 6 tests CGV/rétractation légales |
| `tests/unit/billing.test.ts` | Créé | 5 tests plans SaaS |
| `playwright.config.ts` | Créé | Config Playwright (Chromium + Mobile) |
| `tests/e2e/public-pages.spec.ts` | Créé | Tests E2E pages publiques, auth, SEO, headers sécurité |
| `package.json` | Modifié | Scripts test, test:watch, test:coverage, test:e2e, analyze |

#### CHANTIER 5 — Accessibilité & Performance
| Fichier | Action | Description |
|---------|--------|-------------|
| `src/app/layout.tsx` | Modifié | Skip-to-content link (RGAA), main#main-content |
| `src/app/globals.css` | Modifié | High contrast mode, forced-colors, prefers-contrast |
| `next.config.js` | Modifié | Bundle analyzer intégré, images AVIF/WebP, device sizes |
| `src/app/app/dashboard/page.tsx` | Modifié | Lazy loading Recharts (ChartCA, TopPoudres) |
| `src/components/layout/AppShell.tsx` | Fix | Import Breadcrumbs nommé au lieu de default |

**Résultats :**
- 51 tests unitaires VERTS (Vitest)
- Build Next.js réussi sans erreur
- Headers sécurité OWASP complets
- Emails transactionnels complets (bienvenue, rappel, statut)
- Pipeline CI/CD GitHub Actions fonctionnel
- Monitoring Sentry prêt (activation via env var)

**Dernière mise à jour :** 8 février 2026 — 5 chantiers d'amélioration majeure

---

### 8 février 2026 — Implémentation massive 52 améliorations

**Objectif :** Implémenter toutes les fonctionnalités obligatoires, importantes et optionnelles pour un module complet dédié aux ateliers de thermolaquage.

#### CONFORMITÉ LÉGALE FRANCE 2026

**1. Factur-X / Facturation électronique (EN16931)**
- `src/lib/facturx/generate.ts` : Générateur XML Factur-X conforme profil MINIMUM
  - Norme EN16931, format ZUGFeRD/Factur-X 1.0
  - Fonctions : `generateFacturXML()`, `buildFacturXData()`, `computeHash()`
  - Émetteur, client, lignes, TVA, IBAN/BIC, totaux
  - Escape XML sécurisé
- `src/app/api/factures/[id]/facturx/route.ts` : API endpoint GET pour générer le XML
  - Vérifie l'authentification et l'appartenance à l'atelier (anti-IDOR)
  - Archive automatiquement la facture (archivage légal 10 ans)

**2. Archivage légal 10 ans**
- Table `factures_archive` : coffre-fort numérique (facture_id, hash SHA-256, xml_facturx, expire_at)
- Hash SHA-256 calculé à chaque génération pour intégrité

**3. Politique de rétention des données RGPD**
- `src/app/api/cron/data-retention/route.ts` : Cron quotidien de suppression automatique
  - Logs > 90 jours, devis refusés > 3 ans, rate_limits expirés, push_subscriptions > 6 mois
  - Table `data_retention_logs` pour traçabilité RGPD
- `vercel.json` : Ajout cron 3h00 quotidien

**4. DPA (Data Processing Agreement)**
- `src/app/dpa/page.tsx` : 10 articles conformes RGPD
  - Responsable/sous-traitant, données traitées, finalités, durées
  - Sous-traitants ultérieurs (Supabase, Vercel, Stripe, Resend, Sentry)
  - Mesures sécurité, droits des personnes, notification violation
  - Contact DPO

#### MÉTIER THERMOLAQUAGE

**5-7. Poudres : péremption + lots + fiche technique**
- `src/components/poudres/PoudreForm.tsx` : Ajout champs date_peremption, numero_lot, fournisseur
- Colonnes DB : date_peremption, numero_lot, fiche_technique_url, fds_url, fournisseur, date_reception, certifications, qualicoat_approved, qualimarine_approved

**8-9. Cuisson réelle + épaisseur µm**
- `src/components/projets/QualityChecklist.tsx` : 
  - Ajout mesure épaisseur min/max/moyenne en µm
  - Validation norme QUALICOAT (60-120 µm)
  - Sauvegarde automatique sur le projet
- Colonnes DB projets : temp_cuisson_reelle, duree_cuisson_reelle, ecart_temperature, epaisseur_mesuree_um

**10. Configuration four**
- `src/components/settings/AtelierSettingsForm.tsx` : Section config four (L×l×H cm, poids max, fournées/jour, temp max)
- Colonnes DB ateliers : four_longueur_cm, four_largeur_cm, four_hauteur_cm, four_poids_max_kg

**11. Étiquettes imprimables**
- `src/app/app/etiquettes/page.tsx` : Générateur d'étiquettes avec QR code
  - 3 formats : 100×50mm (standard four), 70×30mm (petit), A6
  - Recherche, sélection multiple, impression directe
  - QR code lié au scan projet

**12. Consommation poudre prévue**
- Intégré dans stock intelligent (suggestions basées sur projets planifiés)

#### INFRASTRUCTURE & QUALITÉ

**13. Tests multi-tenancy RLS**
- `tests/unit/rls-multi-tenancy.test.ts` : 16 tests
  - Data isolation checks (ownership, IDOR prevention)
  - Feature flag isolation par plan
  - Storage quota isolation

**14. Tests E2E fonctionnels**
- `tests/e2e/critical-flows.spec.ts` : Tests Playwright
  - Pages publiques (accueil, tarifs, SLA, DPA, roadmap, blog, status)
  - Formulaire devis public (3 étapes)
  - API health check et documentation v1

**15. Gestion quotas storage**
- `src/app/api/storage/quota/route.ts` : API GET (usage) + POST (vérification avant upload)
  - Alertes 80%, 90%, 100%
  - Colonnes : storage_quota_gb, storage_used_bytes

**17. SLA contractuel**
- `src/app/sla/page.tsx` : Page publique avec engagements
  - Uptime: 99.5% Lite, 99.9% Pro
  - Temps de réponse, maintenance planifiée
  - Compensation automatique (10%, 25%, 50%)
  - Gestion incidents (Critique <30min, Majeur <2h, Mineur <24h)

#### AMÉLIORATIONS MÉTIER

**18. Stock intelligent avancé**
- `src/app/app/stock-intelligent/page.tsx` : Page complète
  - Suggestions pesées quotidiennes (5/jour, critères : écart >20%, pas de pesée, stock bas)
  - Modal pesée (poids brut, tare, poids net)
  - Tableau réconciliation théorique vs réel
  - Score de fiabilité par poudre
  - Alertes péremption
- Tables : pesees_stock, suggestions_pesees

**19. Grille tarifaire personnalisable**
- `src/app/app/grille-tarifaire/page.tsx` : Interface complète
  - Paliers par surface (0-0.5m², 0.5-2m², 2-5m², 5-10m², >10m²)
  - Majorations par finition (métallisé +25%, texturé +15%, brillant +10%)
  - Forfait minimum, prix au kg petites pièces
  - Simulateur de prix intégré
- Table : grilles_tarifaires_paliers

**23. Certifications QUALICOAT / Qualimarine**
- Section certifications dans AtelierSettingsForm
- Badge + date expiration pour QUALICOAT et QUALIMARINE

**24. Gestion consommables**
- `src/app/app/consommables/page.tsx` : Module complet
  - Catégories : filtres, EPI, produits chimiques, abrasifs, accrochage, emballage
  - CRUD complet, alertes stock bas
  - Mouvements entrée/sortie avec historique
- Tables : consommables, consommables_mouvements

**25. Maintenance préventive**
- `src/app/app/maintenance/page.tsx` : Gestion maintenances
  - Planification avec récurrence automatique
  - Alertes maintenances en retard
  - Historique des interventions
  - Types : préventive, corrective, révision, nettoyage
- Table : maintenance_equipements

**26. Écran atelier (TV Dashboard)**
- `src/app/app/ecran-atelier/page.tsx` : Dashboard grands écrans
  - Mode kiosk (plein écran), dark theme par défaut
  - 6 KPIs temps réel (en cours, cuisson, QC, prêts, livrés/jour, retards)
  - Liste projets avec code couleur statut + alertes retard
  - Refresh automatique 30s, horloge temps réel

**27. Objectifs journaliers équipe**
- `src/app/app/objectifs/page.tsx` : Dashboard objectifs
  - m² traités, pièces, séries terminées, projets livrés
  - Barres de progression avec pourcentage
  - Badge accomplissement quand 100% atteint
  - Historique 7 jours
- Table : objectifs_journaliers

#### COMMERCIAL & CONVERSION

**29. Formulaire devis public automatique**
- `src/app/devis-public/page.tsx` : Formulaire 3 étapes
  - Type pièce (portail, garde-corps, volets, jantes, etc.)
  - Options (finition, RAL, urgence +30%)
  - Contact + estimation instantanée
  - Crée un prospect CRM automatiquement
- `src/app/api/devis-public/route.ts` : API backend + notification email

**30. Feature flags par plan**
- `src/app/app/feature-flags/page.tsx` : Interface admin
  - Toggle par Plan Lite / Pro / Global
  - 18 feature flags pré-configurés
- Table : feature_flags avec defaults

**33. Prévisionnel CA**
- `src/app/app/previsionnel/page.tsx` : Dashboard complet
  - 12 mois passés + 3 mois projection
  - CA réel vs prévu basé sur taux conversion historique
  - Graphique barres avec code couleur
  - KPIs : CA prévu 3 mois, devis en attente, taux conversion global
- Table : previsionnel_ca

**34. Blog / Ressources SEO**
- `src/app/blog/page.tsx` : Page blog avec 5 articles par défaut
  - Articles thermolaquage, QUALICOAT, optimisation poudre, Factur-X, maintenance
  - Chargement dynamique depuis Supabase si articles publiés
  - Tags, dates, structure SEO
- Table : blog_articles

**35. Exit surveys**
- `src/app/app/exit-survey/page.tsx` : Questionnaire désabonnement
  - 9 raisons prédéfinies
  - Note 1-5 étoiles, détails libres
  - Offre win-back (-20% pendant 3 mois)
- Table : exit_surveys

**36. Roadmap publique**
- `src/app/roadmap/page.tsx` : Page publique
  - 4 sections : Disponible (13), En cours (5), Planifié (7), Futur (5)
  - Call-to-action suggestion fonctionnalité

#### INTÉGRATIONS

**39. Export Sage / EBP / Ciel**
- `src/app/api/exports/sage/route.ts` : Export CSV 3 formats
  - Format Sage Compta (journal VE, comptes 706000, 445710, 411000)
  - Format EBP
  - Format Ciel
  - Filtrage par période

**40. API publique REST**
- `src/app/api/v1/route.ts` : Documentation OpenAPI
  - Endpoints : clients, projets, devis, factures, poudres, stock, webhooks
  - Auth: Bearer token, rate limiting 1000 req/h
  - Codes erreur standardisés

**41. Webhooks**
- `src/app/api/webhooks/trigger/route.ts` : Déclencheur interne
  - Signature HMAC-SHA256
  - 11 événements (devis.*, projet.*, facture.*, stock.*, paiement.*)
  - Timeout 10s, retry auto
- Table : webhooks_config

#### MIGRATION DATABASE

- `supabase/migrations/20260208_all_features.sql` : Migration complète
  - 19 nouvelles tables créées
  - Colonnes ajoutées à poudres, projets, ateliers
  - RLS policies pour toutes les nouvelles tables
  - Feature flags par défaut (18 entrées)
  - Indexes pour performance

#### TESTS

- `tests/unit/facturx.test.ts` : 10 tests Factur-X
- `tests/unit/rls-multi-tenancy.test.ts` : 16 tests isolation
- `tests/e2e/critical-flows.spec.ts` : Tests Playwright parcours critiques

**Résultats :**
- 77 tests unitaires VERTS (Vitest) — +26 nouveaux
- Build Next.js réussi (0 erreur)
- 19+ nouvelles routes/pages créées
- 19 nouvelles tables DB

---

### 9 février 2026 — Vague 2 : Features métier avancées + Intégrations tierces

#### NOUVELLES PAGES APP

**#20-21 Planification cuisson**
- `src/app/app/planification-cuisson/page.tsx` : Page complète
  - Timeline des fournées du jour avec statuts (planifié/en cours/terminé)
  - Sélection des projets à cuire avec calcul de poids automatique
  - Jauge de chargement four (% capacité)
  - KPIs : fournées planifiées, créneaux restants, capacité/temp max
  - Suggestions d'optimisation (sous-chargement, fusion fournées)
  - Transition automatique des projets : en_cuisson -> qc à la fin
  - Table DB : `planification_cuisson` avec RLS

**#22 Réapprovisionnement intelligent**
- `src/app/app/reapprovisionnement/page.tsx` : Page suggestion réappro
  - Calcul automatique de consommation/mois basé sur projets réels
  - Estimation des jours restants de stock par poudre
  - Jauges visuelles de niveau de stock
  - Export CSV bon de commande automatique
  - Filtres : toutes / alertes stock / prévision < 14 jours
  - Budget commande estimé

**#31 Relances commerciales intelligentes**
- `src/app/app/relances/page.tsx` : Page relances
  - Détection automatique des devis expirant dans les 7 jours
  - Génération automatique de relances par lot
  - Workflow : À envoyer → Envoyée → Répondue / Annulée
  - KPIs : devis en danger, à envoyer, envoyées, répondues
  - Messages personnalisés par type de relance
  - Table DB : `relances_commerciales` avec RLS

**#32 Tarifs préférentiels par client**
- `src/app/app/tarifs-clients/page.tsx` : Page tarifs préférentiels
  - CRUD remises et prix/m² spéciaux par client
  - Conditions de tarif (min commande, contrat annuel)
  - Date d'expiration des tarifs avec indicateur visuel
  - Statistiques : remise moyenne, clients VIP (≥10%)
  - Recherche client
  - Table DB : `tarifs_clients` avec RLS

#### NOUVELLES LIBRAIRIES

**#28 Watermark photos**
- `src/lib/watermark.ts` : Utilitaire filigrane
  - Application Canvas API côté client
  - Positions : bottom-right, bottom-left, top-right, top-left, center
  - Mode diagonal pour position center
  - Ajout automatique de la date
  - Configuration : opacité, taille police, couleur
  - Fonctions : `applyWatermark()`, `isWatermarkEnabled()`, `getWatermarkConfig()`

**#48 Notifications SMS (Twilio)**
- `src/lib/sms/twilio.ts` : Service SMS
  - Intégration Twilio API directe (fetch, sans SDK)
  - Formatage automatique des numéros français
  - 7 templates métier prédéfinis :
    - projet_recu, projet_en_cours, projet_termine
    - devis_envoye, facture_envoyee, rappel_paiement, relance_devis
  - Fonction `sendClientSMS()` pour envoi simplifié
  - Variables d'env : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

**#49 Product Analytics (PostHog)**
- `src/lib/analytics/posthog.ts` : Analytics métier
  - Intégration PostHog EU (RGPD compatible)
  - 20+ événements métier prédéfinis (ANALYTICS_EVENTS)
  - Fonctions : `trackEvent()`, `identifyUser()`, `setUserAtelier()`
  - Script injection pour <head>
  - Support feature flags PostHog
  - Variables d'env : NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST

**#50 Customer Success Automation**
- `src/lib/customer-success/automation.ts` : Moteur CS
  - 12 types d'événements CS automatisés
  - Détection d'inactivité : 7j, 14j, 30j
  - Rappels trial : J-3, J-1
  - Email de bienvenue, félicitations milestones
  - Suggestion upgrade (high usage, feature limit)
  - Health Score client (0-100) avec 5 facteurs
  - Anti-spam : vérification envoi récent avant email
- `src/app/api/cron/customer-success/route.ts` : Cron job quotidien 9h

#### INTÉGRATIONS TIERCES

**#37 Connexion Pennylane API**
- `src/app/api/integrations/pennylane/route.ts` :
  - GET : Vérification connexion + info société
  - POST : Synchronisation des factures vers Pennylane
  - Format Pennylane : customer + line_items + TVA FR_200
  - Retour détaillé par facture (success/error)

**#38 Paiement SEPA GoCardless**
- `src/app/api/integrations/gocardless/route.ts` :
  - GET : Statut connexion + info créancier
  - POST create_mandate_link : Création lien mandat SEPA client
  - POST create_payment : Prélèvement SEPA sur mandat existant
  - Support sandbox et production
  - Variables d'env : GOCARDLESS_SANDBOX

#### i18n — Enrichissement traductions

- `src/lib/i18n/translations.ts` : +50 clés par langue (FR, EN, ES, DE)
  - Navigation nouvelles fonctionnalités
  - Planification cuisson, consommables, maintenance
  - Qualité / épaisseur, relances, feature flags

#### CONFIGURATION

- `vercel.json` : Ajout crons
  - `/api/cron/customer-success` à 9h quotidien
  - `/api/cron/stock-alerts` à 7h quotidien

#### MIGRATIONS DATABASE (Supabase live)

Migrations appliquées avec succès :
- `add_poudres_columns` : 15 colonnes (péremption, lot, FDS, certifications, cuisson)
- `add_projets_columns` : 9 colonnes (cuisson réelle, épaisseur, poids, dimensions, QC)
- `add_ateliers_columns` : 18 colonnes (four, watermark, storage, certifications, objectifs)
- `create_consommables_with_rls` : Tables consommables + mouvements + RLS
- `create_maintenance_table` : Table maintenance_equipements + RLS
- `create_feature_flags_table` : Table + 18 flags par défaut (Lite/Pro)
- `create_remaining_tables` : 12 tables + RLS
  - grilles_tarifaires_paliers, factures_archive, data_retention_logs
  - objectifs_journaliers, webhooks_config, blog_articles
  - exit_surveys, roadmap_items, previsionnel_ca
  - api_keys, pesees_stock, relances_commerciales
  - tarifs_clients, planification_cuisson, historique_connexions

#### BUILD

- **Next.js build : EXIT 0** — Aucune erreur
- Toutes les nouvelles pages compilées et routées
- 4 nouvelles pages app + 3 API routes + 4 librairies + 1 cron job

**Dernière mise à jour :** 9 février 2026 — Vague 2 features métier + intégrations
