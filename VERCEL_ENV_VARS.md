# Variables d'environnement pour Vercel

## Variables à configurer dans Vercel Dashboard

Une fois le projet déployé, allez dans **Settings → Environment Variables** et ajoutez :

### Variables publiques (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_SUPABASE_URL=https://vlidjcxncuibvpckjdww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.tflmX-kDZe1-0EFQ3D5Cv-q5pJfhTu1W6JjLQyz1fXI
```

### Variable secrète (SUPABASE_SERVICE_ROLE_KEY)

⚠️ **À récupérer depuis Supabase Dashboard** :
1. Aller sur https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww/settings/api
2. Copier la **service_role key** (clé secrète)
3. Ajouter dans Vercel : `SUPABASE_SERVICE_ROLE_KEY=votre_cle_secrete`

### Environnements

Sélectionner pour tous les environnements :
- ✅ Production
- ✅ Preview  
- ✅ Development
