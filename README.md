# ThermoGestion - SaaS de gestion pour ateliers de thermolaquage

Logiciel SaaS professionnel pour gérer vos ateliers de thermolaquage : devis, projets, stock, facturation.

## Stack technique

- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage, RLS)
- **Déploiement**: Vercel
- **Styling**: Tailwind CSS
- **Validation**: Zod + React Hook Form

## Configuration

### Prérequis

- Node.js 18+ 
- npm ou yarn
- Compte Supabase
- Compte Vercel

### Installation

```bash
# Installer les dépendances
npm install

# Créer le fichier .env.local
cp .env.example .env.local

# Remplir les variables d'environnement Supabase
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=

# Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Structure du projet

```
├── src/
│   ├── app/              # App Router Next.js
│   ├── components/       # Composants React
│   ├── lib/              # Utilitaires (Supabase client, etc.)
│   ├── types/            # Types TypeScript
│   ├── hooks/            # React hooks personnalisés
│   └── utils/            # Fonctions utilitaires
├── public/               # Assets statiques
└── supabase/             # Migrations Supabase
```

## Développement

### Commandes disponibles

- `npm run dev` - Serveur de développement
- `npm run build` - Build de production
- `npm run start` - Serveur de production
- `npm run lint` - Linter ESLint
- `npm run type-check` - Vérification TypeScript

## Documentation

Voir `PLAN.md` pour le cahier des charges complet.
