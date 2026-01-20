# 💰 Documentation - Système de facturation

## ✅ Module facturation - TERMINÉ

### Fonctionnalités implémentées

#### 1. Structure facturation complète
- ✅ Types TypeScript (`src/lib/facturation/types.ts`)
- ✅ Numérotation automatique (format paramétrable : FACT-YYYY-NNNN)
- ✅ Génération PDF factures (HTML imprimable)
- ✅ Gestion acompte/solde/complet
- ✅ Traçabilité paiements (table `paiements`)

#### 2. Pages facturation
- ✅ `/app/factures` : Liste factures avec filtres
- ✅ `/app/factures/new` : Création facture (depuis projet ou manuelle)
- ✅ `/app/factures/[id]` : Détail facture complet
- ✅ `/app/factures/[id]/pdf` : Génération PDF

#### 3. Composants
- ✅ `FacturesList` : Liste avec statuts, paiements
- ✅ `CreateFactureForm` : Formulaire création avec calcul automatique
- ✅ `FactureDetail` : Détail avec actions (envoyer, marquer payée, lien paiement)

#### 4. Intégration Stripe
- ✅ Création liens de paiement Stripe
- ✅ Support acompte, solde, complet
- ✅ Stockage lien dans facture

#### 5. Exports comptabilité
- ✅ Export CSV (format standard)
- ✅ Export FEC comptable (format XML, conforme France)
- ✅ Routes API : `/api/factures/export/csv` et `/api/factures/export/fec`

---

## 🔧 Configuration requise

### Variables d'environnement

Ajouter dans `.env.local` et Vercel :

```bash
# Stripe (pour liens de paiement)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx  # Optionnel pour frontend
```

### Migration SQL

Migration appliquée :
- ✅ `007_facturation_améliorations.sql` : Colonnes factures, table paiements, fonction numérotation

---

## 📋 Utilisation

### Créer une facture

1. **Depuis un projet** :
   - Aller sur `/app/projets/[id]`
   - Cliquer "Créer facture" (à ajouter)
   - Ou aller sur `/app/factures/new?projet_id=[id]`

2. **Manuellement** :
   - Aller sur `/app/factures/new`
   - Sélectionner client
   - Ajouter items (désignation, quantité, prix HT, TVA)
   - Calcul automatique des totaux
   - Choisir type : Acompte, Solde, ou Complète

### Numérotation automatique

Format par défaut : `FACT-YYYY-NNNN` (ex: FACT-2026-0001)

Format paramétrable dans `ateliers.facture_numero_format` :
- `FACT-YYYY-NNNN` : FACT-2026-0001
- `FACT-YY-NNN` : FACT-26-001
- `INV-YYYY-NNNN` : INV-2026-0001
- etc.

Le compteur est réinitialisé chaque année automatiquement.

### Générer un lien de paiement Stripe

1. Sur la page détail facture
2. Cliquer "Créer lien paiement"
3. Le lien est généré et stocké dans la facture
4. Le client peut payer en ligne via Stripe

### Exports comptabilité

**CSV** :
- Route : `/api/factures/export/csv?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- Format : Colonnes standard (numéro, date, client, montant, statut)

**FEC comptable** :
- Route : `/api/factures/export/fec?year=YYYY`
- Format : XML conforme réglementation française
- Archivage : 10 ans (à gérer manuellement pour MVP)

---

## 🚀 Prochaines étapes (V1)

### Webhooks Stripe
- [ ] Configurer webhooks Stripe pour mise à jour automatique statut paiement
- [ ] Route `/api/webhooks/stripe` pour recevoir les événements

### Envoi email facture
- [ ] Template email facture
- [ ] Envoi automatique après création
- [ ] Lien paiement dans email

### Signature électronique
- [ ] Signature facture (similaire devis)
- [ ] Stockage signature dans `factures.signature_url`

### Connexion Pennylane
- [ ] API Pennylane pour synchronisation comptabilité
- [ ] Export automatique factures vers Pennylane

---

## 📝 Notes techniques

### Format FEC

Le FEC (Fichier des Écritures Comptables) est un format XML obligatoire en France depuis 2014 pour les entreprises soumises à TVA.

Structure simplifiée implémentée :
- Journal (VT = Ventes, BQ = Banque)
- Écritures (factures, paiements)
- Comptes (411 = Clients, 44571 = TVA collectée, 701 = Ventes, 512 = Banque)

**Note** : Pour production, adapter les numéros de comptes selon le plan comptable de l'atelier.

### Stripe Payment Links

Les Payment Links Stripe permettent de créer des liens de paiement sans intégration frontend complexe.

Avantages :
- ✅ Simple à implémenter
- ✅ Pas besoin de frontend Stripe
- ✅ Gestion automatique des paiements
- ✅ Webhooks pour mise à jour statut

Limitations :
- ⚠️ Personnalisation limitée
- ⚠️ Pas de paiement récurrent (pour SaaS ateliers)

---

**Date** : 20 janvier 2026  
**Statut** : ✅ Terminé et opérationnel
