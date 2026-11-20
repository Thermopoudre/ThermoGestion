export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://luujbyqenmzivzhiatze.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_muPvzJ4oKUe9yvCR_MA9LA_M7eJ2tBL";

// URL publique de prod — sert de base aux images OG/metadata (sans ça, Next.js résout en
// http://localhost:3000 et casse les vignettes de partage WhatsApp/LinkedIn). Audit n°3, 09/07.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thermogestion-v2.vercel.app";

// Stripe Connect (paiement en ligne des factures, plan Atelier). Tant que ces 3 variables ne sont
// pas renseignées côté serveur, le bouton "Payer en ligne" reste désactivé proprement (voir stripe.ts).
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
// Clé service role Supabase — utilisée UNIQUEMENT côté serveur (jamais exposée au client) pour les
// opérations sensibles (ex : webhook Stripe qui marque une facture payée). À récupérer dans
// Supabase Dashboard > Project Settings > API > service_role, projet luujbyqenmzivzhiatze.
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Catalogue Thermopoudre (webservice PrestaShop de la boutique). La clé n'a volontairement pas de
// valeur de repli : sans elle, l'application affiche « catalogue non connecté » plutôt que de
// laisser croire à un catalogue vide. Elle ne doit jamais être préfixée NEXT_PUBLIC_ — elle ouvre
// l'API marchande de thermopoudre.fr.
export const TP_WS_KEY = process.env.TP_WS_KEY ?? "";

// Compte de démonstration publique. Le mot de passe n'est pas un secret au sens habituel — le
// bouton est sur la page d'accueil — mais il n'a rien à faire dans le dépôt : sans la variable,
// la démonstration est simplement fermée, plutôt qu'ouverte avec un identifiant versionné.
// L'atelier visé est marqué `ateliers.demo = true`, ce qui interdit toute écriture en base.
export const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@thermogestion.internal";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";
export const TP_API_URL = process.env.TP_API_URL ?? "https://thermopoudre.fr/api";
export const TP_BOUTIQUE_URL = process.env.TP_BOUTIQUE_URL ?? "https://thermopoudre.fr";
