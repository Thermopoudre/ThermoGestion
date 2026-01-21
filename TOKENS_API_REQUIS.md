# 🔑 Tokens API Requis - ThermoGestion

**Date** : 20 janvier 2026  
**Statut** : Configuration requise pour fonctionnement complet

---

## 📋 Liste complète des tokens API

### ✅ OBLIGATOIRES (MVP fonctionnel)

#### 1. Supabase
**Où obtenir** : Dashboard Supabase → Settings → API

```bash
# URL du projet Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vlidjcxncuibvpckjdww.supabase.co

# Clé anonyme (publique, peut être exposée côté client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.xxxxxxxxxxxxx

# Clé service role (SECRÈTE, jamais exposer côté client)
# Utilisée pour opérations admin (création atelier, bypass RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg2MjAwNCwiZXhwIjoyMDg0NDM4MDA0fQ.ysBrKu-e_yblWtlY0U3m4lavdKJ4FG70AgeGTYe7qs
```

**Note** : La `SUPABASE_SERVICE_ROLE_KEY` est déjà fournie et configurée.

---

#### 2. Resend (Email)
**Où obtenir** : https://resend.com → API Keys

```bash
# Clé API Resend (pour envoi emails)
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

**Alternative** : SMTP classique (voir section SMTP ci-dessous)

**Plan gratuit** : 3000 emails/mois  
**Plan payant** : À partir de 20$/mois

---

#### 3. Stripe (Paiements)
**Où obtenir** : https://dashboard.stripe.com → Developers → API keys

```bash
# Clé secrète Stripe (mode test ou production)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # Mode test
# ou
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx  # Mode production

# Clé publique Stripe (optionnel, pour frontend)
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx  # Mode test
# ou
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx  # Mode production
```

**Note** : Commencer par le mode test (`sk_test_` et `pk_test_`)

**Plan** : 2.9% + 0.25€ par transaction réussie (pas d'abonnement)

---

### ⚠️ OPTIONNELS (Fonctionnalités avancées)

#### 4. SMTP (Alternative à Resend)
**Si vous préférez utiliser votre serveur mail**

```bash
# Configuration SMTP (stockée dans ateliers.settings.email_config)
# Pas de variable globale nécessaire
# Configurée par atelier dans l'interface
```

**Exemples serveurs SMTP** :
- Gmail : `smtp.gmail.com:587`
- Outlook : `smtp-mail.outlook.com:587`
- OVH : `ssl0.ovh.net:465`
- Serveur mail atelier : `mail.entreprise.fr:587`

---

#### 5. OAuth Gmail (Optionnel, V1)
**Où obtenir** : https://console.cloud.google.com → APIs & Services → Credentials

```bash
# Client ID Google OAuth
GMAIL_OAUTH_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com

# Client Secret Google OAuth
GMAIL_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxx

# Redirect URI à configurer dans Google Console
# https://votre-domaine.com/api/auth/gmail/callback
```

**Note** : Pour l'instant, Resend fonctionne déjà. OAuth Gmail est une amélioration V1.

---

#### 6. OAuth Outlook (Optionnel, V1)
**Où obtenir** : https://portal.azure.com → Azure Active Directory → App registrations

```bash
# Client ID Microsoft OAuth
OUTLOOK_OAUTH_CLIENT_ID=xxxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Client Secret Microsoft OAuth
OUTLOOK_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxx

# Redirect URI à configurer dans Azure
# https://votre-domaine.com/api/auth/outlook/callback
```

**Note** : Pour l'instant, Resend fonctionne déjà. OAuth Outlook est une amélioration V1.

---

#### 7. Google My Business API (Optionnel, V1)
**Où obtenir** : https://console.cloud.google.com → APIs & Services → Enable API

```bash
# Clé API Google My Business
GOOGLE_MY_BUSINESS_API_KEY=xxxxxxxxxxxxx

# OAuth 2.0 pour accès aux avis
GOOGLE_MY_BUSINESS_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_MY_BUSINESS_CLIENT_SECRET=xxxxxxxxxxxxx
```

**Note** : Pour fonctionnalité "Avis Google" (workflow J+3 après récupération)

---

#### 8. Pennylane API (Optionnel, V1)
**Où obtenir** : https://app.pennylane.com → Settings → API

```bash
# Token API Pennylane (pour synchronisation comptabilité)
PENNYLANE_API_TOKEN=xxxxxxxxxxxxx

# Company ID Pennylane
PENNYLANE_COMPANY_ID=xxxxxxxxxxxxx
```

**Note** : Pour synchronisation automatique factures vers Pennylane

---

#### 9. Email Queue Secret (Optionnel)
**Pour sécuriser le traitement de la queue email (cron job)**

```bash
# Clé secrète pour protéger l'endpoint /api/email/queue/process
EMAIL_QUEUE_SECRET_KEY=your-random-secret-key-here-min-32-chars
```

**Génération** : Utiliser un générateur de secret (ex: `openssl rand -hex 32`)

---

#### 10. VAPID Keys (Web Push Notifications)
**Où obtenir** : Déjà générées ci-dessous

```bash
# Clé publique VAPID (exposée côté client) - GÉNÉRÉE ✅
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BMPNE3rXJ5Xo2W4kqB2qHr2W4a_bV6aHGpEjreYaCa6LSOk1uO3lzTQDXnJBwwqDRjPwVTVjV7peZ3T9CkaaWhI

# Clé privée VAPID (SECRÈTE, jamais exposer) - GÉNÉRÉE ✅
VAPID_PRIVATE_KEY=3zRVv6DXpf_jfl0RamopuliSnTKqFChSEho3F7rjIio

# Email sujet VAPID (contact support)
VAPID_SUBJECT=mailto:contact@thermogestion.fr
```

**Note** : Ces clés sont uniques à votre projet. Pour notifications push navigateur (Web Push API)

---

#### 11. Stripe Webhook Secret (Optionnel mais recommandé)
**Où obtenir** : Dashboard Stripe → Developers → Webhooks → Endpoint → Signing secret

```bash
# Secret pour vérifier les webhooks Stripe
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Note** : Pour mise à jour automatique statut paiement factures

---

## 📝 Fichier .env.local

Créer un fichier `.env.local` à la racine du projet avec :

```bash
# ============================================
# SUPABASE (OBLIGATOIRE)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://vlidjcxncuibvpckjdww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.xxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg2MjAwNCwiZXhwIjoyMDg0NDM4MDA0fQ.ysBrKu-e_yblWtlY0U3m4lavdKJ4FG70AgeGTYe7qs

# ============================================
# EMAIL (OBLIGATOIRE - Resend recommandé)
# ============================================
RESEND_API_KEY=re_xxxxxxxxxxxxx

# ============================================
# STRIPE (OBLIGATOIRE pour paiements)
# ============================================
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx

# ============================================
# OPTIONNEL (Fonctionnalités avancées)
# ============================================
# Email Queue (pour cron job sécurisé)
EMAIL_QUEUE_SECRET_KEY=your-random-secret-key-here

# Web Push (VAPID keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxx
VAPID_SUBJECT=mailto:contact@thermogestion.fr

# Stripe Webhook (pour mise à jour auto paiements)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# OAuth Gmail (V1)
GMAIL_OAUTH_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GMAIL_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxx

# OAuth Outlook (V1)
OUTLOOK_OAUTH_CLIENT_ID=xxxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OUTLOOK_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxx

# Google My Business (V1)
GOOGLE_MY_BUSINESS_API_KEY=xxxxxxxxxxxxx
GOOGLE_MY_BUSINESS_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_MY_BUSINESS_CLIENT_SECRET=xxxxxxxxxxxxx

# Pennylane (V1)
PENNYLANE_API_TOKEN=xxxxxxxxxxxxx
PENNYLANE_COMPANY_ID=xxxxxxxxxxxxx

# ============================================
# URL APPLICATION (Optionnel)
# ============================================
NEXT_PUBLIC_APP_URL=https://thermogestion.vercel.app
# ou en local : http://localhost:3000
```

---

## 🚀 Configuration Vercel

Pour déployer sur Vercel, ajouter ces variables dans :
**Vercel Dashboard → Project → Settings → Environment Variables**

### Variables à ajouter dans Vercel :

1. **Production, Preview, Development** :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY` (si utilisé frontend)
   - `EMAIL_QUEUE_SECRET_KEY` (optionnel)

2. **Production uniquement** (si différent de test) :
   - `STRIPE_SECRET_KEY` (mode production `sk_live_...`)
   - `STRIPE_PUBLISHABLE_KEY` (mode production `pk_live_...`)

---

## 📋 Checklist configuration

### ✅ MVP Minimum (fonctionnel)
- [x] `NEXT_PUBLIC_SUPABASE_URL` ✅ (déjà configuré)
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ (déjà configuré)
- [x] `SUPABASE_SERVICE_ROLE_KEY` ✅ (déjà configuré)
- [ ] `RESEND_API_KEY` ⚠️ **À AJOUTER**
- [ ] `STRIPE_SECRET_KEY` ⚠️ **À AJOUTER** (pour paiements)

### ⚠️ V1 (Fonctionnalités avancées)
- [ ] `GMAIL_OAUTH_CLIENT_ID` + `GMAIL_OAUTH_CLIENT_SECRET` (OAuth Gmail)
- [ ] `OUTLOOK_OAUTH_CLIENT_ID` + `OUTLOOK_OAUTH_CLIENT_SECRET` (OAuth Outlook)
- [ ] `GOOGLE_MY_BUSINESS_API_KEY` (Avis Google)
- [ ] `PENNYLANE_API_TOKEN` + `PENNYLANE_COMPANY_ID` (Synchronisation comptabilité)
- [ ] `EMAIL_QUEUE_SECRET_KEY` (Sécurisation cron job)

---

## 🔒 Sécurité

### ⚠️ CLÉS SECRÈTES (jamais exposer côté client)
- `SUPABASE_SERVICE_ROLE_KEY` ❌ **JAMAIS côté client**
- `STRIPE_SECRET_KEY` ❌ **JAMAIS côté client**
- `STRIPE_WEBHOOK_SECRET` ❌ **JAMAIS côté client**
- `RESEND_API_KEY` ❌ **JAMAIS côté client**
- `VAPID_PRIVATE_KEY` ❌ **JAMAIS côté client**
- `EMAIL_QUEUE_SECRET_KEY` ❌ **JAMAIS côté client**
- Tous les `*_CLIENT_SECRET` ❌ **JAMAIS côté client**

### ✅ CLÉS PUBLIQUES (peuvent être exposées)
- `NEXT_PUBLIC_SUPABASE_URL` ✅ Public
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ Public (protégée par RLS)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ✅ Public (pour Web Push)
- `STRIPE_PUBLISHABLE_KEY` ✅ Public (si utilisé frontend)
- `NEXT_PUBLIC_APP_URL` ✅ Public

---

## 📚 Liens utiles

- **Supabase Dashboard** : https://supabase.com/dashboard
- **Resend** : https://resend.com/api-keys
- **Stripe Dashboard** : https://dashboard.stripe.com/apikeys
- **Google Cloud Console** : https://console.cloud.google.com
- **Azure Portal** : https://portal.azure.com
- **Pennylane** : https://app.pennylane.com

---

## 🎯 Priorité d'ajout

### 1. Immédiat (MVP fonctionnel)
1. `RESEND_API_KEY` → Pour envoi emails devis/factures
2. `STRIPE_SECRET_KEY` → Pour liens paiement factures

### 2. V1 (Fonctionnalités avancées)
3. OAuth Gmail/Outlook → Alternative email gratuite
4. Google My Business → Avis clients
5. Pennylane → Synchronisation comptabilité

---

**Dernière mise à jour** : 20 janvier 2026
