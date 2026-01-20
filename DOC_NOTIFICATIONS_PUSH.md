# 📱 Documentation - Notifications Push

**Date** : 20 janvier 2026

---

## ✅ Système de notifications push - TERMINÉ

### Fonctionnalités implémentées

#### 1. Web Push API
- ✅ Support navigateur natif (Chrome, Firefox, Edge, Safari)
- ✅ Service Worker pour gestion notifications
- ✅ Abonnements multi-devices par utilisateur
- ✅ VAPID keys pour authentification

#### 2. Notifications automatiques
- ✅ Nouveau projet créé
- ✅ Devis signé
- ✅ Retouche déclarée (priorité haute)
- ✅ Facture payée
- ✅ Changement statut projet (prêt, livré)

#### 3. Gestion abonnements
- ✅ Enregistrement abonnement (API `/api/push/subscribe`)
- ✅ Désabonnement (API `/api/push/unsubscribe`)
- ✅ Nettoyage auto abonnements invalides
- ✅ Historique notifications envoyées

---

## 🔧 Configuration requise

### Variables d'environnement

```bash
# VAPID Public Key (exposée côté client)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxx

# VAPID Private Key (SECRÈTE)
VAPID_PRIVATE_KEY=xxxxxxxxxxxxx

# VAPID Subject (email contact)
VAPID_SUBJECT=mailto:contact@thermogestion.fr
```

### Génération VAPID keys

```bash
npx web-push generate-vapid-keys
```

Cela génère :
- Public Key : `BLxxxxxxxxxxxxx` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Private Key : `xxxxxxxxxxxxx` → `VAPID_PRIVATE_KEY`

---

## 🚀 Utilisation

### Activer les notifications

1. L'utilisateur clique sur "Activer notifications" dans le header
2. Le navigateur demande permission
3. L'abonnement est enregistré dans `push_subscriptions`
4. Les notifications sont automatiquement envoyées lors d'événements

### Notifications automatiques

Les notifications sont déclenchées automatiquement lors de :
- Création nouveau projet
- Signature devis
- Déclaration retouche
- Paiement facture
- Changement statut projet (prêt, livré)

### Déclencher manuellement

```typescript
import { sendPushNotificationToAtelier } from '@/lib/notifications/push'

await sendPushNotificationToAtelier(
  atelierId,
  {
    title: 'Titre notification',
    body: 'Corps de la notification',
    data: {
      type: 'custom',
      url: '/app/custom-page',
    },
  }
)
```

---

## 📝 Notes techniques

### Service Worker

Le Service Worker (`public/sw.js`) :
- Écoute les événements `push`
- Affiche les notifications
- Gère les clics (redirection vers URL dans `data.url`)

### Nettoyage abonnements

Les abonnements invalides (410, 404) sont automatiquement supprimés lors de l'envoi.

### Historique

Toutes les notifications sont enregistrées dans `push_notifications` pour traçabilité.

---

**Date** : 20 janvier 2026  
**Statut** : ✅ Terminé et opérationnel
