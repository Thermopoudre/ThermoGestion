# 🚀 Configuration Vercel via MCP - Guide rapide

## ✅ Déploiement effectué

Le projet a été déployé sur Vercel, mais les **variables d'environnement** doivent être configurées.

**URL de déploiement** : https://thermogestion-gp06rdu8t-alexis-delcroixs-projects.vercel.app

---

## 🔑 Configuration des variables d'environnement

### Option 1 : Via l'interface Vercel (recommandé)

1. **Aller sur** : https://vercel.com/alexis-delcroixs-projects/thermogestion/settings/environment-variables

2. **Ajouter les variables suivantes** :

#### Variables publiques (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_SUPABASE_URL
Valeur: https://vlidjcxncuibvpckjdww.supabase.co
Environnements: Production, Preview, Development
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
Valeur: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.tflmX-kDZe1-0EFQ3D5Cv-q5pJfhTu1W6JjLQyz1fXI
Environnements: Production, Preview, Development
```

#### Variable secrète (SUPABASE_SERVICE_ROLE_KEY)

⚠️ **À récupérer depuis Supabase Dashboard** :

1. Aller sur : https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww/settings/api
2. Dans la section **Project API keys**, copier la **service_role key** (clé secrète)
3. Ajouter dans Vercel :

```
SUPABASE_SERVICE_ROLE_KEY
Valeur: [votre_service_role_key]
Environnements: Production, Preview, Development
```

### Option 2 : Via Vercel CLI

```bash
# Configurer les variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Entrer: https://vlidjcxncuibvpckjdww.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Entrer: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.tflmX-kDZe1-0EFQ3D5Cv-q5pJfhTu1W6JjLQyz1fXI

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Entrer: [votre_service_role_key depuis Supabase Dashboard]

# Répéter pour preview et development
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

vercel env add NEXT_PUBLIC_SUPABASE_URL development
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development
vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

---

## 🔄 Redéployer après configuration

Une fois les variables configurées, **redéployer** :

### Via l'interface Vercel
1. Aller sur : https://vercel.com/alexis-delcroixs-projects/thermogestion
2. Cliquer sur **"Redeploy"** sur le dernier déploiement

### Via CLI
```bash
vercel deploy --prod
```

---

## ✅ Vérification

Après redéploiement, vérifier que l'application fonctionne :

1. **Accéder à l'URL** : https://thermogestion-gp06rdu8t-alexis-delcroixs-projects.vercel.app
2. **Tester l'inscription** : `/auth/inscription`
3. **Tester la connexion** : `/auth/login`

---

## 🧪 Initialiser les templates

Une fois connecté, initialiser les templates :

1. Aller sur `/app/devis/templates`
2. Ouvrir la console (F12)
3. Exécuter :
```javascript
fetch('/api/init-templates', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
```

---

## 📊 Statut actuel

- ✅ **Projet Vercel créé** : `thermogestion`
- ✅ **Déploiement effectué** : Preview disponible
- ⚠️ **Variables d'environnement** : À configurer (voir ci-dessus)
- ✅ **Projet Supabase** : ACTIVE_HEALTHY
- ✅ **Migrations** : Appliquées (001, 002, 003, 004)
- ✅ **Build local** : Réussi

---

## 🔗 Liens utiles

- **Vercel Dashboard** : https://vercel.com/alexis-delcroixs-projects/thermogestion
- **Supabase Dashboard** : https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww
- **Variables d'environnement** : https://vercel.com/alexis-delcroixs-projects/thermogestion/settings/environment-variables

---

**Une fois les variables configurées et le projet redéployé, l'application sera opérationnelle ! 🎉**
