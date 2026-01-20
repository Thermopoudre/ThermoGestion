# 💳 Documentation - Webhooks Stripe

**Date** : 20 janvier 2026

---

## ✅ Système Webhooks Stripe - TERMINÉ

### Fonctionnalités implémentées

#### 1. Route webhook
- ✅ Route `/api/webhooks/stripe`
- ✅ Vérification signature Stripe
- ✅ Traitement événements paiement

#### 2. Événements gérés
- ✅ `payment_intent.succeeded` : Paiement réussi
- ✅ `payment_intent.payment_failed` : Paiement échoué
- ✅ `checkout.session.completed` : Session checkout complétée (Payment Links)

#### 3. Actions automatiques
- ✅ Mise à jour statut facture (payée)
- ✅ Création enregistrement paiement
- ✅ Notification push aux utilisateurs
- ✅ Mise à jour `paid_at` et `payment_status`

---

## 🔧 Configuration requise

### Variables d'environnement

```bash
# Secret webhook Stripe (obligatoire pour sécurité)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Configuration Stripe Dashboard

1. Aller sur https://dashboard.stripe.com → Developers → Webhooks
2. Cliquer "Add endpoint"
3. URL endpoint : `https://votre-domaine.com/api/webhooks/stripe`
4. Sélectionner événements :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
5. Copier le "Signing secret" → `STRIPE_WEBHOOK_SECRET`

---

## 🚀 Utilisation

### Automatique

Une fois configuré, les webhooks sont traités automatiquement :
1. Client paie via lien Stripe
2. Stripe envoie webhook
3. Système met à jour facture automatiquement
4. Notification push envoyée aux utilisateurs

### Vérification

Pour tester en local, utiliser Stripe CLI :
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 📝 Notes techniques

### Sécurité

La route vérifie la signature Stripe pour s'assurer que la requête vient bien de Stripe.

### Idempotence

Les webhooks peuvent être reçus plusieurs fois. Le système vérifie l'état actuel avant mise à jour.

### Erreurs

Les erreurs sont loggées mais n'interrompent pas le traitement (pour éviter boucles).

---

**Date** : 20 janvier 2026  
**Statut** : ✅ Terminé et opérationnel
