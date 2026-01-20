# Suivi du projet ThermoGestion

## Objectif
Ce document permet de suivre toutes les modifications, ajouts, suppressions de fichiers et fonctionnalités tout au long du projet.

---

## Historique des modifications

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
