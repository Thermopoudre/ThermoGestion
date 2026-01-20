# 📝 Instructions pour créer `.env.local`

Le fichier `.env.local` est protégé (ne peut pas être créé directement pour des raisons de sécurité).

## ✅ Méthode rapide

### Option 1 : Copier depuis `.env.example`

```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# Ou Linux/Mac
cp .env.example .env.local
```

### Option 2 : Créer manuellement

Créez un fichier `.env.local` à la racine du projet avec ce contenu :

```bash
# Configuration Supabase - ThermoGestion
NEXT_PUBLIC_SUPABASE_URL=https://vlidjcxncuibvpckjdww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.tflmX-kDZe1-0EFQ3D5Cv-q5pJfhTu1W6JjLQyz1fXI

# ⚠️ À ajouter : Récupérer depuis Dashboard Supabase
# https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww/settings/api
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg2MjAwNCwiZXhwIjoyMDg0NDM4MDA0fQ.ysBrKu-e_yblWtlY0U3m4lavdKJ4FG70AgeXGTYe7qs

# Configuration Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔑 Récupérer SUPABASE_SERVICE_ROLE_KEY

1. **Aller sur** : https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww/settings/api
2. **Section "Project API keys"**
3. **Copier la "service_role" key** (celle avec le cadenas 🔒)
4. **Coller dans `.env.local`** à la place de `VOTRE_CLE_ICI`

⚠️ **Important** : Cette clé est secrète ! Ne jamais la partager ou la commit dans Git.

## ✅ Vérification

Une fois le fichier créé :

```bash
# Redémarrer le serveur
npm run dev
```

Si tout est correct, l'application démarre sans erreur.

---

**Fichier `.env.example` disponible** : Template prêt à copier ! 📄
