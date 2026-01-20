# Instructions de setup - ThermoGestion

## 🚀 Démarrage rapide

### 1. Installation dépendances
```bash
npm install
```

### 2. Configuration Supabase

#### A. Créer les buckets Storage
Aller sur https://supabase.com/dashboard/project/vlidjcxncuibvpckjdww/storage/buckets

Créer 3 buckets :

**Bucket "photos"** :
- Public : ❌ Non (privé)
- File size limit : 10 MB
- Allowed MIME types : image/*
- Structure : `{atelier_id}/{projet_id}/{filename}`

**Bucket "pdfs"** :
- Public : ❌ Non (privé)
- File size limit : 5 MB
- Allowed MIME types : application/pdf
- Structure : `{atelier_id}/devis/{filename}` ou `{atelier_id}/factures/{filename}`

**Bucket "signatures"** :
- Public : ❌ Non (privé)
- File size limit : 1 MB
- Allowed MIME types : image/*
- Structure : `{filename}`

#### B. Configurer les policies RLS Storage

Pour chaque bucket, créer des policies RLS :

**Policy INSERT (upload)** :
```sql
CREATE POLICY "Users can upload in their atelier"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND -- ou 'pdfs' ou 'signatures'
  (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
);
```

**Policy SELECT (read)** :
```sql
CREATE POLICY "Users can view in their atelier"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND -- ou 'pdfs' ou 'signatures'
  (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
);
```

**Policy DELETE** :
```sql
CREATE POLICY "Users can delete in their atelier"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = (SELECT atelier_id::text FROM public.users WHERE id = auth.uid())
);
```

#### C. Récupérer Service Role Key
1. Dashboard Supabase → Settings → API
2. Copier "service_role" key (secret)
3. Ajouter dans `.env.local` : `SUPABASE_SERVICE_ROLE_KEY=...`

### 3. Créer `.env.local`
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vlidjcxncuibvpckjdww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsaWRqY3huY3VpYnZwY2tqZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjIwMDQsImV4cCI6MjA4NDQzODAwNH0.tflmX-kDZe1-0EFQ3D5Cv-q5pJfhTu1W6JjLQyz1fXI
SUPABASE_SERVICE_ROLE_KEY=À_RÉCUPÉRER_DEPUIS_DASHBOARD

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Lancer le serveur
```bash
npm run dev
```

Ouvrir http://localhost:3000

---

## ✅ Checklist avant utilisation

- [ ] Dépendances installées (`npm install`)
- [ ] `.env.local` créé avec toutes les variables
- [ ] Buckets Storage créés (photos, pdfs, signatures)
- [ ] Policies RLS Storage configurées
- [ ] Service Role Key ajouté dans `.env.local`
- [ ] Serveur lancé (`npm run dev`)

---

## 🧪 Test du workflow complet

1. **Inscription** : http://localhost:3000/auth/inscription
   - Créer un compte atelier
   - Vérifier email (Dashboard Supabase → Auth → Users)

2. **Ajouter un client** : /app/clients/new

3. **Ajouter une poudre** : /app/poudres/new

4. **Créer un devis** : /app/devis/new
   - Sélectionner client
   - Ajouter items (dimensions)
   - Vérifier calculs automatiques
   - Enregistrer

5. **Signer le devis** : /app/devis/[id]/sign
   - Dessiner ou uploader signature
   - Vérifier horodatage

6. **Convertir en projet** : /app/devis/[id]/convert
   - Remplir informations projet
   - Convertir

7. **Suivre le projet** : /app/projets/[id]
   - Upload photos
   - Naviguer entre étapes
   - Changer statut

---

## 🔧 Dépannage

### Erreur "Bucket not found"
→ Créer les buckets Storage manuellement via Dashboard

### Erreur "RLS policy violation"
→ Vérifier que les policies RLS Storage sont créées

### Erreur upload photos
→ Vérifier que le bucket "photos" existe et a les bonnes policies

### Erreur Service Role Key
→ Vérifier que `SUPABASE_SERVICE_ROLE_KEY` est dans `.env.local`

---

**Dernière mise à jour** : 20 janvier 2026
