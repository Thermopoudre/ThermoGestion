# Configuration Supabase - ThermoGestion

## Informations du projet

- **ID** : `vlidjcxncuibvpckjdww`
- **Nom** : ThermoGestion
- **Région** : eu-west-1 (Europe)
- **Organisation** : Thermopoudre (tualdwwyrapzxtegehqi)
- **URL** : https://vlidjcxncuibvpckjdww.supabase.co
- **Status** : COMING_UP (initialisation en cours)

## Clés API

### Clé publique (anon)
- **Legacy anon key** : Déjà dans `.env.local`
- **Publishable key** : `sb_publishable_wKqwHBTPvTziSr5iAmLbcA_osoOzFCb`

### Clé service role (admin)
⚠️ **À récupérer depuis le Dashboard Supabase** :
1. Aller sur https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww
2. Settings → API → Service role key (secret)
3. Ajouter dans `.env.local` : `SUPABASE_SERVICE_ROLE_KEY=...`

## ⏳ Actions à faire quand le projet sera ACTIVE_HEALTHY

### 1. Appliquer la migration SQL

Le projet doit être en statut `ACTIVE_HEALTHY` avant d'appliquer la migration.

**Option A : Via Supabase Dashboard**
1. Aller sur : https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww
2. SQL Editor → New Query
3. Copier le contenu de `supabase/migrations/001_initial_schema.sql`
4. Exécuter la migration

**Option B : Via MCP Supabase**
```bash
# Attendre que le projet soit ACTIVE_HEALTHY
# Puis utiliser : mcp_supabase_apply_migration
```

### 2. Configurer Storage Buckets

Créer les buckets nécessaires :
- `photos` - Photos projets (quota 20 GB par atelier)
- `pdfs` - Devis et factures PDF
- `signatures` - Signatures électroniques

**Policies Storage** (à créer) :
- Isolation par atelier (RLS)
- Accès read/write selon rôles utilisateur

### 3. Générer les types TypeScript

Une fois la migration appliquée :

**Option A : Via CLI Supabase** (si installé)
```bash
npx supabase gen types typescript --project-id vlidjcxncuibvpckjdww > src/types/database.types.ts
```

**Option B : Via MCP Supabase**
Utiliser `mcp_supabase_generate_typescript_types` avec le project_id

### 4. Configurer Auth

- Email auth activé par défaut
- Configurer OAuth Gmail/Outlook (pour envoi emails atelier)
- Configurer 2FA (pour rôles Owner/Admin)

### 5. Configurer RLS

Les policies RLS de base sont dans la migration. À compléter selon besoins spécifiques.

---

## 📋 Checklist

- [x] Projet Supabase créé
- [x] Variables d'environnement configurées (partiellement - service role key à ajouter)
- [ ] Projet ACTIVE_HEALTHY (attendre initialisation)
- [ ] Migration SQL appliquée
- [ ] Storage buckets créés
- [ ] Types TypeScript générés
- [ ] Auth configuré
- [ ] RLS policies complètes

---

**Dernière mise à jour** : 20 janvier 2026
