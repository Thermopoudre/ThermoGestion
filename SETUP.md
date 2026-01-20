# Setup ThermoGestion - Projet initialisé

## ✅ Ce qui a été créé

### 1. Structure Next.js
- ✅ `package.json` - Dépendances (Next.js 14, Supabase, Tailwind, etc.)
- ✅ `tsconfig.json` - Configuration TypeScript
- ✅ `next.config.js` - Configuration Next.js
- ✅ `tailwind.config.ts` - Configuration Tailwind CSS (thème bleu/noir)
- ✅ `postcss.config.js` - Configuration PostCSS
- ✅ `.gitignore` - Fichiers à ignorer
- ✅ `.eslintrc.json` - Configuration ESLint

### 2. Structure de base de l'application
- ✅ `src/app/layout.tsx` - Layout principal
- ✅ `src/app/page.tsx` - Page d'accueil
- ✅ `src/app/globals.css` - Styles globaux Tailwind
- ✅ `src/lib/supabase/client.ts` - Clients Supabase (browser, server, admin)
- ✅ `src/lib/utils/cn.ts` - Utilitaire className merge
- ✅ `src/types/index.ts` - Types TypeScript globaux
- ✅ `src/types/database.types.ts` - Types Supabase (à générer)

### 3. Schéma base de données
- ✅ `supabase/migrations/001_initial_schema.sql` - Migration complète avec :
  - Tables principales : ateliers, users, clients, poudres, stock_poudres, devis, projets, photos, series, factures, audit_logs
  - Multi-tenancy avec RLS (Row Level Security)
  - Policies RLS pour isolation des données par atelier
  - Indexes pour performance
  - Triggers pour updated_at automatique
  - Fonction helper `get_user_atelier_id()` pour RLS

### 4. Documentation
- ✅ `README.md` - Documentation projet
- ✅ `.env.example` - Template variables d'environnement

---

## ⚠️ Actions nécessaires

### 1. Projet Supabase (URGENT)
**Problème** : Limite de 2 projets gratuits atteinte dans l'organisation.

**Options** :
- Option A : Utiliser un projet Supabase existant
  - ColorWheels (zwqxrzmuwjqqhmbsfiia)
  - tlstt-production (iapvoyhvkzlvpbngwxmq)
  
- Option B : Pauser/supprimer un projet existant pour libérer la place

- Option C : Créer dans une autre organisation Supabase

**Une fois le projet Supabase disponible** :
1. Récupérer les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Créer le fichier `.env.local` :
   ```bash
   cp .env.example .env.local
   # Remplir les variables Supabase
   ```

3. Appliquer la migration :
   ```bash
   # Via Supabase Dashboard SQL Editor
   # Ou via CLI Supabase si installé :
   # supabase db push
   ```

### 2. Générer les types TypeScript Supabase
```bash
# Une fois Supabase configuré
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

### 3. Installer les dépendances
```bash
npm install
```

### 4. Lancer le serveur de développement
```bash
npm run dev
```

---

## 📋 Prochaines étapes de développement

### Étape 2 : Authentification multi-tenant
- [ ] Setup Supabase Auth
- [ ] Page inscription atelier
- [ ] Page connexion
- [ ] Gestion rôles (Owner, Admin, Opérateur, Compta)
- [ ] 2FA pour Owner/Admin
- [ ] Middleware protection routes
- [ ] Hook `useAuth()` pour accès utilisateur courant

### Étape 3 : CRM basique
- [ ] Liste clients (tableau avec filtres)
- [ ] Fiche client (détails, historique)
- [ ] Création/édition client
- [ ] Import CSV clients
- [ ] Détection doublons

### Étape 4 : Devis live
- [ ] Formulaire création devis
- [ ] Calcul automatique (dimensions, surface, coûts, marge)
- [ ] Templates devis personnalisables
- [ ] Génération PDF devis
- [ ] Signature électronique
- [ ] Envoi email (OAuth Gmail/Outlook)

### Étape 5 : Projets & suivi
- [ ] Conversion devis → projet
- [ ] Workflow étapes configurable
- [ ] Upload photos (compression, quota 20 GB)
- [ ] Journal d'audit
- [ ] Étiquettes (QR codes)

---

## 🔧 Configuration Supabase nécessaire

### Storage Buckets
- `photos` - Photos projets (20 GB quota par atelier)
- `pdfs` - Devis et factures PDF
- `signatures` - Signatures électroniques

### Functions Edge (optionnel)
- Email queue handler
- Photo compression
- PDF generation

### Policies RLS à compléter
Le schéma initial inclut les policies de base. À compléter selon besoins spécifiques.

---

## 📝 Notes

- **Multi-tenancy** : Toutes les tables incluent `atelier_id` + RLS strict
- **Sécurité** : RLS activé sur toutes les tables, isolation garantie
- **Performance** : Indexes créés sur les colonnes fréquemment utilisées
- **Audit** : Table `audit_logs` pour traçabilité complète

---

**Dernière mise à jour** : 20 janvier 2026
