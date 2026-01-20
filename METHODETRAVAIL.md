# Méthodologie de travail - ThermoGestion

## 📋 Processus à suivre à chaque demande

### 1. Consultation des documents de référence
**Toujours consulter en premier** :
- `PLAN.md` : Cahier des charges complet
- `PLAN_ACTION.md` : Plan d'action et priorités
- `AVANCEMENT_MVP.md` : État actuel des fonctionnalités
- `SUIVI.md` : Historique des modifications

### 2. Analyse de la demande
- Identifier la fonctionnalité concernée
- Vérifier si elle existe déjà (partiellement ou complètement)
- Consulter `PLAN.md` pour les spécifications détaillées
- Vérifier les dépendances (qu'est-ce qui doit être fait avant ?)

### 3. Planification
- Créer une todo list si tâche complexe (3+ étapes)
- Identifier les fichiers à créer/modifier
- Vérifier les migrations BDD nécessaires
- Consulter la documentation technique (Supabase, Next.js, etc.)

### 4. Implémentation
- Créer/modifier les fichiers nécessaires
- Respecter les conventions de code existantes
- Tester localement si possible
- Vérifier les erreurs de lint/TypeScript

### 5. Documentation
- Mettre à jour `SUIVI.md` avec les modifications
- Mettre à jour `AVANCEMENT_MVP.md` si fonctionnalité MVP
- Ajouter des commentaires dans le code si nécessaire

### 6. Tests
- Tester la fonctionnalité manuellement
- Vérifier l'isolation multi-tenant (RLS)
- Tester les cas limites
- Utiliser le navigateur pour tester l'UI

### 7. Déploiement
- Build local pour vérifier les erreurs
- Déployer sur Vercel (staging puis production)
- Tester en production
- Vérifier les logs en cas d'erreur

---

## 🎯 Priorités de développement

### MVP (Finalisation)
1. **Envoi email réel** : OAuth Gmail/Outlook ou SMTP
2. **Portail client final** : Authentification + vue projets
3. **Séries** : Regroupement par poudre + optimisation four

### V1 (Production)
1. **Facturation** : Acompte, solde, PDF, FEC, Stripe
2. **Retouches/NC** : Déclaration, suivi, statistiques
3. **Notifications push** : Web push natif (atelier uniquement)
4. **Avis Google** : API Google My Business, workflow J+3

### V2 (Extensions)
1. Module Jantes complet
2. Calendrier véhicules de prêt
3. Multi-langue
4. Dashboard gestionnaire admin

---

## 🔍 Vérifications avant chaque modification

### Base de données
- [ ] Migration nécessaire ? (créer fichier `00X_nom.sql`)
- [ ] RLS policies nécessaires ? (isolation multi-tenant)
- [ ] Index nécessaires ? (performance)
- [ ] Triggers nécessaires ? (audit, updated_at)

### Frontend
- [ ] Route Next.js existe ? (`src/app/...`)
- [ ] Composant réutilisable ? (`src/components/...`)
- [ ] Types TypeScript à jour ? (`src/types/`)
- [ ] Hooks personnalisés ? (`src/hooks/`)

### Backend/API
- [ ] Route API nécessaire ? (`src/app/api/...`)
- [ ] Service Role Key nécessaire ? (opérations admin)
- [ ] Validation des données ? (Zod ou autre)
- [ ] Gestion erreurs ? (try/catch, logs)

### Sécurité
- [ ] RLS activé sur nouvelles tables ?
- [ ] Isolation multi-tenant vérifiée ?
- [ ] Validation côté serveur ?
- [ ] Protection CSRF/XSS ?

---

## 📝 Conventions de code

### Fichiers
- **Pages** : `src/app/app/[module]/page.tsx`
- **Composants** : `src/components/[module]/[Component].tsx`
- **Utilitaires** : `src/lib/[module]/[util].ts`
- **Types** : `src/types/[module].ts` ou `database.types.ts`
- **Hooks** : `src/hooks/use[Hook].ts`

### Nommage
- **Composants** : PascalCase (`ClientForm.tsx`)
- **Fichiers** : PascalCase pour composants, camelCase pour utils
- **Variables** : camelCase
- **Constantes** : UPPER_SNAKE_CASE
- **Types/Interfaces** : PascalCase

### Git
- **Branches** : `feat/[fonctionnalite]`, `fix/[bug]`, `refactor/[module]`
- **Commits** : Conventional Commits (feat:, fix:, refactor:, etc.)
- **Messages** : Français ou anglais (cohérence)

---

## 🧪 Tests à effectuer

### Tests fonctionnels
- [ ] Workflow complet fonctionne ?
- [ ] Cas limites gérés ?
- [ ] Erreurs affichées correctement ?
- [ ] Validation formulaires ?

### Tests multi-tenant
- [ ] Atelier A ne voit pas données atelier B ?
- [ ] RLS policies actives ?
- [ ] Isolation Storage vérifiée ?

### Tests UI/UX
- [ ] Responsive (mobile, tablet, desktop) ?
- [ ] Accessibilité (clavier, screen readers) ?
- [ ] Performance (chargement, interactions) ?

---

## 📊 Suivi du projet

### Documents à maintenir
- `SUIVI.md` : Toutes modifications (créations, modifications, suppressions)
- `AVANCEMENT_MVP.md` : État fonctionnalités MVP
- `PLAN_ACTION.md` : Plan d'action et priorités
- `CHANGELOG.md` : Historique versions

### Mise à jour régulière
- Après chaque fonctionnalité majeure
- Après chaque correction importante
- Avant chaque déploiement production

---

## 🚀 Déploiement

### Processus
1. **Build local** : `npm run build` (vérifier erreurs)
2. **Tests** : Vérifier fonctionnalités manuellement
3. **Commit** : Message Conventional Commits
4. **Push** : Vers branche `develop` ou `feat/*`
5. **Déploiement staging** : Vercel preview (si configuré)
6. **Tests staging** : Vérifier fonctionnalités
7. **Déploiement production** : `vercel deploy --prod`
8. **Tests production** : Vérifier fonctionnalités
9. **Documentation** : Mettre à jour `SUIVI.md`

### Rollback
- En cas d'erreur : `vercel rollback` ou déploiement version précédente
- Vérifier logs : `vercel logs` ou Dashboard Vercel

---

## 🔧 Configuration requise

### Environnement local
- Node.js 18+
- npm ou yarn
- Git
- `.env.local` avec clés Supabase

### Services externes
- Supabase (DB, Auth, Storage)
- Vercel (déploiement)
- Stripe (paiements - V1)
- Google Cloud (OAuth Gmail - V1)
- Google My Business API (avis - V1)

---

## 📚 Ressources

### Documentation
- Next.js : https://nextjs.org/docs
- Supabase : https://supabase.com/docs
- Tailwind CSS : https://tailwindcss.com/docs
- TypeScript : https://www.typescriptlang.org/docs

### Projet
- `PLAN.md` : Spécifications complètes
- `README.md` : Setup et installation
- `SETUP.md` : Guide configuration

---

**Dernière mise à jour** : 20 janvier 2026
