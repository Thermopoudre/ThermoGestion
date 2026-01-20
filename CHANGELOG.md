# Changelog - ThermoGestion

## [0.1.0] - 2026-01-20

### ✨ Ajouté

#### Infrastructure
- Projet Next.js 14 avec App Router, TypeScript, Tailwind CSS
- Projet Supabase créé (ID: vlidjcxncuibvpckjdww)
- Migration SQL complète avec 11 tables + RLS
- Types TypeScript générés depuis Supabase
- Multi-tenancy avec isolation par atelier

#### Authentification
- Page inscription complète (création atelier + utilisateur)
- Page connexion
- Page vérification email
- API route `/api/auth/signup` avec création complète
- Middleware protection routes
- Hooks `useAuth()` et `useUser()`

#### Dashboard
- Statistiques (clients, projets, devis, stockage)
- Activité récente (journal d'audit)
- Informations atelier (essai gratuit, plan)

#### CRM Clients
- Liste clients avec tableau complet
- Création client (formulaire complet)
- Détail client (avec projets et devis récents)
- Édition client

#### Catalogue Poudres
- Liste poudres avec stock
- Création poudre (tous champs techniques)
- Détail poudre
- Édition poudre
- Gestion stock (théorique + pesées)
- Historique pesées (20 dernières)
- Calcul écarts stock automatique

#### Module Devis
- Liste devis avec statuts
- Création devis avec calcul automatique :
  - Calcul surface (dimensions mm → m²)
  - Calcul coûts (poudre, MO, consommables)
  - Marges paramétrables (% poudre, % MO, forfait)
  - TVA configurable
  - Totaux HT/TTC automatiques
- Détail devis complet
- Édition devis
- Génération PDF (HTML imprimable)
- Signature électronique (dessin canvas + upload image)
- Horodatage et journal signatures (qui, quand, IP)
- Conversion devis → projet
- Envoi devis (statut, email à venir)

#### Module Projets
- Liste projets avec filtres
- Création projet (manuel ou depuis devis)
- Détail projet complet
- Édition projet
- Workflow étapes configurable (5 étapes par défaut)
- Navigation étapes (précédent/suivant)
- Upload photos avec compression :
  - Compression WebP/JPG (~500KB-2MB)
  - Redimensionnement automatique (max 2000px)
  - Gestion quota storage (20 GB par défaut)
  - Nettoyage auto photos anciennes à 90%
- Galerie photos
- Changement statut projet

#### Navigation & UI
- Layout app avec menu complet
- Navigation : Dashboard, Clients, Projets, Devis, Poudres
- Design moderne (bleu/noir, gradients)
- Responsive (mobile, tablette, desktop)

#### Utilitaires
- `src/lib/storage.ts` : compression images, upload, quota, nettoyage
- Fonction `compressImage()` : compression intelligente WebP/JPG
- Fonction `uploadPhoto()` : upload avec compression
- Fonction `checkStorageQuota()` : vérification quota
- Fonction `cleanupOldPhotos()` : nettoyage auto à 90%

### 🔧 Technique

- **30+ pages** créées
- **15+ composants** réutilisables
- **3 migrations SQL** (schéma + documentation)
- **RLS activé** sur toutes les tables
- **Isolation multi-tenant** garantie
- **Compression images** côté client
- **Gestion quota** automatique

### 📝 Documentation

- `README.md` : Documentation projet
- `SETUP.md` : Guide setup initial
- `SUPABASE_CONFIG.md` : Configuration Supabase
- `RESUME_DEVELOPPEMENT.md` : Résumé développement
- `AVANCEMENT_MVP.md` : État d'avancement
- `INSTRUCTIONS_SETUP.md` : Instructions détaillées
- `CHANGELOG.md` : Ce fichier

### ⚠️ À configurer

- Buckets Supabase Storage (photos, pdfs, signatures)
- Policies RLS Storage
- Service Role Key dans `.env.local`
- OAuth Gmail/Outlook (pour envoi emails réel)

---

## Prochaines versions

### [0.2.0] - V1 (prévu)
- Templates devis personnalisables (éditeur zones)
- Envoi email réel (OAuth Gmail/Outlook)
- Portail client final
- Facturation (acompte, solde, PDF, FEC)
- Séries (batch/regroupement)
- Retouches/NC
- Notifications push

### [0.3.0] - V2 (prévu)
- Module Jantes complet
- Multi-langue (anglais, espagnol, italien)
- Avis Google (API Google My Business)
- Calendrier véhicules de prêt
- Dashboard gestionnaire admin

---

**Version actuelle** : 0.1.0 (MVP fonctionnel)
