# 🚀 Plan d'action - Continuation du projet ThermoGestion

**Date** : 20 janvier 2026  
**État actuel** : MVP à ~90% fonctionnel  
**Prochaine étape** : Finalisation MVP puis V1

---

## 📊 État actuel du projet

### ✅ Ce qui est fait (MVP ~90%)

#### Infrastructure
- ✅ Projet Next.js + Supabase + Vercel configuré
- ✅ Base de données complète (11 tables + RLS)
- ✅ Authentification multi-tenant
- ✅ Site vitrine complet (pages, footer, logo)

#### Fonctionnalités core
- ✅ Dashboard avec statistiques
- ✅ CRM Clients (CRUD + import CSV)
- ✅ Catalogue Poudres (CRUD + import CSV + stock)
- ✅ Module Devis (création, calcul auto, PDF, signature électronique)
- ✅ **Templates devis personnalisables** (4 templates système + création/édition)
- ✅ Module Projets (workflow, photos, compression)
- ✅ Gestion stock (théorique + pesées)

---

## 🎯 Prochaines étapes prioritaires

### Phase 1 : Finalisation MVP (1-2 semaines)

#### 1.1 Envoi email réel ⚠️ CRITIQUE
**Priorité** : 🔴 Haute  
**Complexité** : Moyenne  
**Temps estimé** : 3-5 jours

**À faire** :
- [ ] Intégration OAuth Gmail/Outlook (ou SMTP)
- [ ] Templates emails (MJML/HTML responsive)
- [ ] Queue d'envoi (Bull + Redis ou alternative Serverless)
- [ ] Envoi devis par email (nouveau client vs existant)
- [ ] Envoi notifications projets (prêt, étapes, etc.)

**Fichiers à créer/modifier** :
- `src/lib/email/` : Utilitaires email
- `src/app/api/email/` : Routes API envoi
- Templates emails dans `src/templates/email/`

---

#### 1.2 Portail client final ⚠️ CRITIQUE
**Priorité** : 🔴 Haute  
**Complexité** : Moyenne  
**Temps estimé** : 5-7 jours

**À faire** :
- [ ] Authentification client (séparée de l'atelier)
- [ ] Vue liste projets client
- [ ] Détail projet (étapes, photos haute qualité, documents)
- [ ] Signature électronique devis/facture
- [ ] Confirmation récupération/livraison
- [ ] Téléchargement documents (devis, factures, rapports)

**Fichiers à créer** :
- `src/app/client/` : Routes portail client
- `src/components/client/` : Composants portail
- Migration BDD : table `client_users` pour authentification clients

---

#### 1.3 Séries (batch/regroupement) ⚠️ IMPORTANT
**Priorité** : 🟠 Haute  
**Complexité** : Moyenne-Élevée  
**Temps estimé** : 5-7 jours

**À faire** :
- [ ] Vue "Séries recommandées" (regroupement par poudre exacte)
- [ ] Règles strictes (même référence + finition + type)
- [ ] Création série (batch) avec projets/pièces
- [ ] Optimisation taille four (suggestion)
- [ ] Impression étiquettes série
- [ ] Lancement/clôture série

**Fichiers à créer** :
- `src/app/app/series/` : Routes séries
- `src/components/series/` : Composants séries
- Migration BDD : table `series` (déjà dans schéma initial ?)

---

### Phase 2 : V1 - Production solide (2-3 semaines)

#### 2.1 Facturation client final
**Priorité** : 🟠 Haute  
**Complexité** : Élevée  
**Temps estimé** : 7-10 jours

**À faire** :
- [ ] Module facturation (acompte + solde)
- [ ] Génération factures PDF
- [ ] Numérotation automatique (format paramétrable)
- [ ] Paiement Stripe (liens de paiement)
- [ ] Exports comptabilité (CSV, FEC comptable)
- [ ] Archivage FEC (10 ans, export mensuel auto)
- [ ] Connexion Pennylane (option)

**Fichiers à créer** :
- `src/app/app/factures/` : Routes factures
- `src/components/factures/` : Composants factures
- `src/lib/facturation/` : Utilitaires facturation
- Migration BDD : table `factures` (déjà dans schéma ?)

---

#### 2.2 Retouches / Non-conformités (NC)
**Priorité** : 🟠 Moyenne  
**Complexité** : Moyenne  
**Temps estimé** : 3-5 jours

**À faire** :
- [ ] Déclaration NC (type, photo, commentaire)
- [ ] Réintégration projet dans étape précédente
- [ ] Statistiques NC (taux, causes, poudres liées)
- [ ] Dashboard qualité

**Fichiers à créer** :
- `src/app/app/nc/` : Routes NC
- `src/components/nc/` : Composants NC
- Migration BDD : table `non_conformites` (déjà dans schéma ?)

---

#### 2.3 Notifications push (atelier uniquement)
**Priorité** : 🟠 Moyenne  
**Complexité** : Moyenne  
**Temps estimé** : 3-4 jours

**À faire** :
- [ ] Web Push natif (Service Worker)
- [ ] Notifications : nouveau devis, projet prêt, facture, retards
- [ ] Préférences utilisateur (paramétrage notifications)
- [ ] Pas de push pour clients finaux (email uniquement)

**Fichiers à créer** :
- `public/sw.js` : Service Worker
- `src/lib/notifications/` : Utilitaires push
- `src/app/api/notifications/` : Routes API push

---

#### 2.4 Avis Google (API Google My Business)
**Priorité** : 🟠 Moyenne  
**Complexité** : Moyenne  
**Temps estimé** : 4-5 jours

**À faire** :
- [ ] Email automatique J+3 après récupération (paramétrable)
- [ ] Intégration API Google My Business
- [ ] Tracking avis laissés
- [ ] Relance automatique si pas d'avis (paramétrable)

**Fichiers à créer** :
- `src/lib/google-business/` : Utilitaires Google My Business
- `src/app/api/google-business/` : Routes API
- Migration BDD : table `avis_google` (tracking)

---

### Phase 3 : V2 - Extensions (plus tard)

- Module Jantes complet
- Calendrier véhicules de prêt
- Multi-langue
- Dashboard gestionnaire admin
- API publique & Webhooks

---

## 🎯 Recommandation : Ordre d'implémentation

### Option A : Finaliser MVP d'abord (recommandé)
1. **Envoi email réel** (3-5 jours) → Bloque l'utilisation réelle
2. **Portail client final** (5-7 jours) → Expérience client complète
3. **Séries** (5-7 jours) → Optimisation production

**Total** : ~2-3 semaines pour MVP 100%

### Option B : MVP + V1 en parallèle
1. Envoi email réel
2. Portail client final
3. Facturation (en parallèle avec séries)
4. Séries
5. Retouches/NC
6. Notifications push

**Total** : ~4-5 semaines pour V1 complète

---

## 📝 Actions immédiates recommandées

### Cette semaine
1. ✅ **Envoi email réel** : Commencer par OAuth Gmail (plus simple)
2. ✅ **Portail client** : Structure base (auth client + routes)

### Semaine prochaine
3. ✅ **Séries** : Vue recommandations + création batch
4. ✅ **Facturation** : Structure base (tables + routes)

---

## 🔧 Configuration nécessaire

### Avant de continuer
- [ ] Vérifier que Supabase Storage est bien configuré (buckets + policies)
- [ ] Tester workflow complet avec compte réel
- [ ] Vérifier isolation multi-tenant (tests RLS)

### Pour envoi email
- [ ] Créer projet Google Cloud (OAuth Gmail)
- [ ] Ou configurer SMTP (SendGrid/Mailgun)
- [ ] Créer templates emails (MJML)

### Pour facturation
- [ ] Créer compte Stripe (test puis production)
- [ ] Configurer webhooks Stripe
- [ ] Tester paiements (mode test)

---

## 📚 Ressources utiles

### Documentation
- `PLAN.md` : Cahier des charges complet
- `AVANCEMENT_MVP.md` : État détaillé fonctionnalités
- `SUIVI.md` : Historique modifications
- `METHODETRAVAIL.md` : Méthodologie de travail

### Fichiers techniques
- `supabase/migrations/` : Schéma BDD
- `src/lib/` : Utilitaires existants
- `src/types/` : Types TypeScript

---

## 🎯 Objectif final

**MVP 100%** : Toutes fonctionnalités core opérationnelles  
**V1** : Production solide avec facturation et portail client  
**V2** : Extensions (Jantes, multi-langue, etc.)

---

**Prochaine action recommandée** : Commencer par l'envoi email réel (bloque l'utilisation réelle du système)
