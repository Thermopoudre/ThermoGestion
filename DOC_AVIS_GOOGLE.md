# ⭐ Documentation - Avis Google

**Date** : 20 janvier 2026

---

## ✅ Système Avis Google - TERMINÉ

### Fonctionnalités implémentées

#### 1. Workflow J+3
- ✅ Détection automatique projets livrés (J+3 après récupération)
- ✅ Email automatique demande avis
- ✅ Lien Google My Business dans email
- ✅ Relance automatique (J+Y configurable)

#### 2. Configuration par atelier
- ✅ Activation/désactivation avis Google
- ✅ Délai J+X configurable (défaut: 3 jours)
- ✅ Délai relance J+Y configurable (défaut: 7 jours)
- ✅ Google My Business Location ID
- ✅ API Key Google (optionnel, pour tracking)

#### 3. Suivi avis
- ✅ Table `avis_google` pour traçabilité
- ✅ Statuts : pending, email_sent, relance_sent, avis_received, expired
- ✅ Dates envoi email, relance, réception avis
- ✅ Note et texte avis (si API Google connectée)

---

## 🔧 Configuration requise

### Variables d'environnement

```bash
# Optionnel : API Key Google My Business (pour tracking avis)
GOOGLE_MY_BUSINESS_API_KEY=xxxxxxxxxxxxx
```

### Configuration atelier

Dans la table `ateliers` :
- `avis_google_enabled` : true/false
- `avis_google_delay_days` : J+X (défaut: 3)
- `avis_google_relance_days` : J+Y (défaut: 7)
- `avis_google_location_id` : Google My Business Location ID

### Google My Business Location ID

1. Aller sur https://business.google.com
2. Sélectionner votre établissement
3. Récupérer le Location ID depuis l'URL ou les paramètres
4. Configurer dans `ateliers.avis_google_location_id`

---

## 🚀 Utilisation

### Traitement automatique (Cron job)

Le cron job Vercel appelle quotidiennement `/api/avis-google/process` :
- Détecte les projets livrés J+X jours avant
- Crée les demandes d'avis
- Envoie les emails automatiquement

### Configuration Vercel Cron

Dans `vercel.json` :
```json
{
  "crons": [
    {
      "path": "/api/avis-google/process",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Envoi manuel

```typescript
import { sendAvisEmail } from '@/lib/google/avis'

await sendAvisEmail(atelierId, projetId, clientId)
```

---

## 📝 Notes techniques

### Fonction SQL

La fonction `get_projets_ready_for_avis()` :
- Filtre projets livrés J+X jours avant
- Exclut projets déjà traités
- Retourne projets avec email client disponible

### Email template

L'email contient :
- Message personnalisé avec nom projet
- Lien Google My Business (avec Location ID)
- Design professionnel

### Relance

La relance est gérée par le même cron job :
- Vérifie demandes `email_sent` sans avis reçu
- Envoie relance si J+Y jours après email initial

---

## 🚀 Prochaines étapes (V1)

### API Google My Business
- [ ] Connexion API Google My Business
- [ ] Tracking avis reçus (polling ou webhook)
- [ ] Mise à jour automatique `avis_received_at`
- [ ] Affichage avis dans interface

---

**Date** : 20 janvier 2026  
**Statut** : ✅ Terminé et opérationnel
