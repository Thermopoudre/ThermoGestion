# 📧 Documentation - Système d'envoi email

## ✅ Étape 1 : Envoi email réel - TERMINÉ

### Fonctionnalités implémentées

#### 1. Structure email complète
- ✅ Types TypeScript (`src/lib/email/types.ts`)
- ✅ Support Resend (service email moderne, adapté Vercel Serverless)
- ✅ Support SMTP classique (nodemailer)
- ✅ Queue d'envoi asynchrone (table `email_queue` dans Supabase)
- ✅ Configuration par atelier (stockée dans `ateliers.settings.email_config`)

#### 2. Templates emails
- ✅ Template "Devis nouveau client" (`devis-nouveau-client.html`)
  - Lien création compte client
  - Message personnalisé
  - Informations atelier
- ✅ Template "Devis client existant" (`devis-client-existant.html`)
  - Lien espace client
  - Message personnalisé
  - Informations atelier

#### 3. API Routes
- ✅ `POST /api/email/send` : Envoi email générique
- ✅ `POST /api/email/queue/process` : Traitement queue (cron job)
- ✅ `POST /api/devis/[id]/send-email` : Envoi devis avec PDF

#### 4. Intégration
- ✅ Composant `SendDevis` mis à jour pour utiliser l'envoi réel
- ✅ Génération automatique PDF en pièce jointe
- ✅ Mise à jour statut devis après envoi

---

## 🔧 Configuration requise

### Variables d'environnement

Ajouter dans `.env.local` et Vercel :

```bash
# Resend (recommandé pour Vercel Serverless)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optionnel : Clé secrète pour traitement queue (cron job)
EMAIL_QUEUE_SECRET_KEY=your-secret-key-here
```

### Migration SQL

Appliquer la migration :
```bash
# Via Supabase Dashboard ou CLI
supabase migration up 005_email_config
```

Ou appliquer manuellement le fichier :
- `supabase/migrations/005_email_config.sql`

---

## 📋 Utilisation

### Envoi devis par email

1. **Depuis l'interface** :
   - Aller sur `/app/devis/[id]/send`
   - Rédiger un message personnalisé (optionnel)
   - Cliquer sur "Envoyer le devis"
   - L'email est ajouté à la queue et envoyé automatiquement

2. **Via API** :
```typescript
POST /api/devis/[id]/send-email
{
  "messagePersonnalise": "Message optionnel"
}
```

### Configuration email par atelier

La configuration est stockée dans `ateliers.settings.email_config` :

```json
{
  "email_config": {
    "provider": "resend",
    "from_email": "contact@atelier.fr",
    "from_name": "Nom Atelier",
    "resend_api_key": "re_xxx" // Optionnel si RESEND_API_KEY globale
  }
}
```

**Providers supportés** :
- `resend` : Service email moderne (recommandé)
- `smtp` : SMTP classique (serveur mail atelier)
- `gmail_oauth` : OAuth Gmail (à implémenter)
- `outlook_oauth` : OAuth Outlook (à implémenter)

---

## 🔄 Queue d'envoi

### Fonctionnement

1. **Ajout à la queue** : Les emails sont ajoutés à `email_queue` avec statut `pending`
2. **Traitement** : Un cron job ou API route traite les emails en attente
3. **Retry automatique** : En cas d'échec, retry jusqu'à `max_retries` (défaut: 3)

### Traitement manuel

Appeler l'API route :
```bash
POST /api/email/queue/process
Authorization: Bearer EMAIL_QUEUE_SECRET_KEY
```

### Cron job Vercel (recommandé)

Créer `vercel.json` :
```json
{
  "crons": [{
    "path": "/api/email/queue/process",
    "schedule": "*/5 * * * *"
  }]
}
```

---

## 🚀 Prochaines étapes

### OAuth Gmail/Outlook (V1)
- [ ] Implémenter flow OAuth Gmail
- [ ] Implémenter flow OAuth Outlook
- [ ] Stockage tokens dans `email_oauth_tokens`
- [ ] Refresh tokens automatique

### Templates supplémentaires
- [ ] Email projet prêt
- [ ] Email notification étape
- [ ] Email facture
- [ ] Email relance devis

### Améliorations
- [ ] Statistiques envoi (taux succès, erreurs)
- [ ] Dashboard queue emails
- [ ] Webhooks Resend (bounce, delivery)

---

## 📝 Notes techniques

### Resend vs SMTP

**Resend** (recommandé) :
- ✅ Simple et moderne
- ✅ Adapté Vercel Serverless
- ✅ Pas de serveur SMTP à gérer
- ✅ Statistiques intégrées
- ⚠️ Service payant (gratuit jusqu'à 3000 emails/mois)

**SMTP** :
- ✅ Gratuit (serveur mail atelier)
- ✅ Contrôle total
- ⚠️ Configuration plus complexe
- ⚠️ Gestion serveur nécessaire

### Queue vs Envoi direct

**Queue** (recommandé) :
- ✅ Retry automatique
- ✅ Traçabilité
- ✅ Pas de timeout
- ⚠️ Nécessite traitement asynchrone

**Envoi direct** :
- ✅ Immédiat
- ⚠️ Timeout possible (Vercel 10s)
- ⚠️ Pas de retry automatique

---

**Date** : 20 janvier 2026  
**Statut** : ✅ Terminé et opérationnel
