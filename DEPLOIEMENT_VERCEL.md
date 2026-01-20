# 🚀 Guide de déploiement sur Vercel

Ce guide vous explique comment déployer ThermoGestion sur Vercel et le tester.

---

## 📋 Prérequis

1. **Compte Vercel** : Créer un compte sur [vercel.com](https://vercel.com)
2. **Compte GitHub** : Le code doit être sur GitHub (ou GitLab/Bitbucket)
3. **Variables d'environnement** : Avoir les clés Supabase prêtes

---

## 🔧 Étape 1 : Préparer le projet

### 1.1 Vérifier les fichiers de configuration

Assurez-vous que ces fichiers existent :
- ✅ `package.json` (déjà créé)
- ✅ `next.config.js` (déjà créé)
- ✅ `.gitignore` (déjà créé)

### 1.2 Créer un fichier `.env.example`

Créez un fichier `.env.example` pour documenter les variables nécessaires :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

### 1.3 Vérifier que le projet compile

```bash
npm install
npm run build
```

Si le build réussit, vous êtes prêt pour le déploiement !

---

## 🌐 Étape 2 : Déployer sur Vercel

### Option A : Via l'interface Vercel (recommandé)

1. **Aller sur [vercel.com](https://vercel.com)** et se connecter

2. **Cliquer sur "Add New Project"**

3. **Importer le repository GitHub**
   - Si votre repo n'est pas connecté, Vercel vous guidera pour le connecter
   - Sélectionner le repository `ThermoGestion`

4. **Configuration du projet**
   - **Framework Preset** : Next.js (détecté automatiquement)
   - **Root Directory** : `./` (racine)
   - **Build Command** : `npm run build` (par défaut)
   - **Output Directory** : `.next` (par défaut)
   - **Install Command** : `npm install` (par défaut)

5. **Variables d'environnement**
   - Cliquer sur "Environment Variables"
   - Ajouter les variables suivantes :
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://vlidjcxncuibvpckjdww.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
     SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
     ```
   - ⚠️ **Important** : Récupérer les vraies clés depuis le Dashboard Supabase

6. **Déployer**
   - Cliquer sur "Deploy"
   - Attendre 2-5 minutes pour le build

### Option B : Via Vercel CLI

1. **Installer Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Se connecter**
   ```bash
   vercel login
   ```

3. **Déployer**
   ```bash
   vercel
   ```
   
   - Suivre les instructions interactives
   - Ajouter les variables d'environnement quand demandé

---

## 🔑 Étape 3 : Configurer les variables d'environnement

### 3.1 Récupérer les clés Supabase

1. Aller sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionner le projet **ThermoGestion** (`vlidjcxncuibvpckjdww`)
3. Aller dans **Settings → API**

### 3.2 Clés à récupérer

- **Project URL** : `https://vlidjcxncuibvpckjdww.supabase.co`
- **anon/public key** : Clé publique (commence par `eyJ...`)
- **service_role key** : Clé secrète (⚠️ **NE JAMAIS EXPOSER** côté client)

### 3.3 Ajouter dans Vercel

1. Aller sur votre projet Vercel
2. **Settings → Environment Variables**
3. Ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vlidjcxncuibvpckjdww.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = votre clé anon
   - `SUPABASE_SERVICE_ROLE_KEY` = votre service role key

4. **Sélectionner les environnements** :
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. **Redéployer** après avoir ajouté les variables

---

## 🧪 Étape 4 : Tester l'application

### 4.1 Accéder à l'application

Une fois déployé, Vercel vous donnera une URL :
- **Production** : `https://thermogestion.vercel.app` (ou votre domaine)
- **Preview** : `https://thermogestion-git-main.vercel.app` (pour chaque PR)

### 4.2 Tester le workflow complet

1. **Page d'accueil**
   - Aller sur `/`
   - Vérifier que la page s'affiche

2. **Inscription**
   - Aller sur `/auth/inscription`
   - Créer un compte atelier
   - Vérifier l'email de confirmation dans Supabase Dashboard

3. **Connexion**
   - Aller sur `/auth/login`
   - Se connecter avec le compte créé

4. **Dashboard**
   - Vérifier que le dashboard s'affiche
   - Vérifier les statistiques

5. **Initialiser les templates** (important !)
   - Aller sur `/app/devis/templates`
   - Si aucun template n'apparaît, appeler l'API d'initialisation :
     ```bash
     # Depuis le navigateur (console) ou via curl
     fetch('/api/init-templates', { method: 'POST' })
       .then(r => r.json())
       .then(console.log)
     ```
   - Ou créer manuellement via l'interface

6. **Créer un client**
   - Aller sur `/app/clients/new`
   - Créer un client de test

7. **Créer un devis**
   - Aller sur `/app/devis/new`
   - Créer un devis avec le client créé
   - Générer le PDF : `/app/devis/[id]/pdf`
   - Vérifier que le template s'applique correctement

8. **Tester les autres modules**
   - Poudres : `/app/poudres`
   - Projets : `/app/projets`

---

## 🔍 Étape 5 : Vérifier les logs et erreurs

### 5.1 Logs Vercel

1. Aller sur votre projet Vercel
2. **Deployments** → Sélectionner un déploiement
3. **Functions** → Voir les logs des API routes
4. **Runtime Logs** → Voir les erreurs en temps réel

### 5.2 Logs Supabase

1. Aller sur Supabase Dashboard
2. **Logs** → Voir les requêtes SQL
3. **API Logs** → Voir les appels API

### 5.3 Erreurs courantes

**Erreur : "Missing environment variables"**
- ✅ Vérifier que toutes les variables sont ajoutées dans Vercel
- ✅ Redéployer après avoir ajouté les variables

**Erreur : "RLS policy violation"**
- ✅ Vérifier que les policies RLS sont bien appliquées
- ✅ Vérifier que l'utilisateur est bien authentifié

**Erreur : "Template not found"**
- ✅ Initialiser les templates via `/api/init-templates`
- ✅ Vérifier que la migration `004_devis_templates.sql` est appliquée

---

## 🔄 Étape 6 : Déploiements automatiques

### 6.1 Configuration Git

Vercel se connecte automatiquement à votre repository Git :

- **Push sur `main`** → Déploiement en **Production**
- **Push sur une branche** → Déploiement en **Preview**
- **Pull Request** → Déploiement en **Preview** avec commentaires

### 6.2 Webhooks (optionnel)

Pour déclencher des actions après déploiement :
- **Settings → Git** → Configurer les webhooks

---

## 📊 Étape 7 : Monitoring et analytics

### 7.1 Vercel Analytics

1. **Settings → Analytics**
2. Activer Vercel Analytics (gratuit)
3. Voir les métriques de performance

### 7.2 Speed Insights

1. **Settings → Speed Insights**
2. Activer pour voir les Core Web Vitals

---

## 🛠️ Commandes utiles

### Déploiement manuel

```bash
# Déployer en preview
vercel

# Déployer en production
vercel --prod

# Voir les logs
vercel logs

# Voir les variables d'environnement
vercel env ls
```

### Développement local avec variables Vercel

```bash
# Récupérer les variables depuis Vercel
vercel env pull .env.local
```

---

## ✅ Checklist de déploiement

- [ ] Code poussé sur GitHub
- [ ] Projet créé sur Vercel
- [ ] Variables d'environnement ajoutées
- [ ] Build réussi
- [ ] Application accessible
- [ ] Inscription fonctionne
- [ ] Connexion fonctionne
- [ ] Templates initialisés
- [ ] Création devis fonctionne
- [ ] Génération PDF fonctionne
- [ ] Tous les modules testés

---

## 🆘 Dépannage

### Le build échoue

1. Vérifier les logs dans Vercel
2. Tester en local : `npm run build`
3. Vérifier les erreurs TypeScript : `npm run type-check`

### L'application ne se charge pas

1. Vérifier les variables d'environnement
2. Vérifier les logs Vercel
3. Vérifier la console navigateur (F12)

### Erreurs Supabase

1. Vérifier que le projet Supabase est actif
2. Vérifier que les migrations sont appliquées
3. Vérifier les policies RLS

---

## 📝 Notes importantes

- ⚠️ **Ne jamais commiter `.env.local`** (déjà dans `.gitignore`)
- ⚠️ **`SUPABASE_SERVICE_ROLE_KEY`** est secrète, ne jamais l'exposer côté client
- ✅ Les variables `NEXT_PUBLIC_*` sont accessibles côté client
- ✅ Vercel redéploie automatiquement à chaque push sur `main`

---

## 🎉 C'est prêt !

Une fois déployé, votre application sera accessible sur :
- **Production** : `https://votre-projet.vercel.app`
- **Preview** : `https://votre-projet-git-branche.vercel.app`

**Bon déploiement ! 🚀**
