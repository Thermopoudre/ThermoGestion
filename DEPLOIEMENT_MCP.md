# 🚀 Déploiement via MCP Vercel et Supabase

## ✅ État actuel

### Supabase
- ✅ **Projet** : ThermoGestion (`vlidjcxncuibvpckjdww`)
- ✅ **Status** : ACTIVE_HEALTHY
- ✅ **URL** : https://vlidjcxncuibvpckjdww.supabase.co
- ✅ **Migrations** : Toutes appliquées (001, 002, 003, 004)
- ✅ **Clés disponibles** :
  - Anon key : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Publishable key : `sb_publishable_wKqwHBTPvTziSr5iAmLbcA_osoOzFCb`

### Git
- ✅ Repository initialisé
- ✅ Premier commit créé
- ⚠️ **À faire** : Pousser sur GitHub pour déploiement Vercel automatique

---

## 📋 Étapes pour déployer

### Option 1 : Déploiement automatique via GitHub (recommandé)

1. **Créer un repository GitHub**
   ```bash
   # Sur GitHub.com, créer un nouveau repository "ThermoGestion"
   ```

2. **Pousser le code**
   ```bash
   git remote add origin https://github.com/votre-username/ThermoGestion.git
   git branch -M main
   git push -u origin main
   ```

3. **Connecter à Vercel**
   - Aller sur [vercel.com](https://vercel.com)
   - Importer le repository GitHub
   - Vercel détectera automatiquement Next.js

4. **Configurer les variables d'environnement dans Vercel**
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vlidjcxncuibvpckjdww.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.tflmX-kDZe1-0EFQ3D5Cv-q5pJfhTu1W6JjLQyz1fXI`
   - `SUPABASE_SERVICE_ROLE_KEY` = (à récupérer depuis Supabase Dashboard → Settings → API → service_role key)

5. **Déployer**
   - Vercel déploiera automatiquement à chaque push sur `main`

### Option 2 : Déploiement manuel via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
vercel

# Ajouter les variables d'environnement
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Redéployer
vercel --prod
```

---

## 🔑 Récupérer SUPABASE_SERVICE_ROLE_KEY

⚠️ **Cette clé est secrète et ne doit jamais être exposée côté client !**

1. Aller sur [Supabase Dashboard](https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww/settings/api)
2. Section **Project API keys**
3. Copier la **service_role key** (secret)
4. L'ajouter dans Vercel comme variable d'environnement

---

## 🧪 Tester après déploiement

1. **Accéder à l'URL Vercel** (ex: `https://thermogestion.vercel.app`)

2. **Initialiser les templates** (important !)
   - Se connecter à l'application
   - Ouvrir la console (F12)
   - Exécuter :
   ```javascript
   fetch('/api/init-templates', { method: 'POST' })
     .then(r => r.json())
     .then(console.log)
   ```

3. **Tester le workflow complet**
   - Inscription → Connexion → Dashboard
   - Créer un client
   - Créer un devis
   - Générer le PDF
   - Gérer les templates

---

## 📊 Monitoring

### Vercel
- **Dashboard** : [vercel.com/dashboard](https://vercel.com/dashboard)
- **Logs** : Voir dans chaque déploiement
- **Analytics** : Activer dans Settings → Analytics

### Supabase
- **Dashboard** : [supabase.com/dashboard/project/vlidjcxncuibvpckjdww](https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww)
- **Logs** : Settings → Logs
- **Database** : Table Editor pour voir les données

---

## ✅ Checklist

- [ ] Code poussé sur GitHub
- [ ] Projet Vercel créé et connecté au repo
- [ ] Variables d'environnement ajoutées dans Vercel
- [ ] Build réussi
- [ ] Application accessible
- [ ] Templates initialisés
- [ ] Workflow testé

---

**Une fois le code sur GitHub, Vercel déploiera automatiquement ! 🚀**
