import type { Metadata } from "next";

// `page.tsx` est un composant client (le formulaire a besoin de useState/useSearchParams) : il ne
// peut pas exporter `metadata`. Sans ce layout, la page héritait du titre par défaut du layout
// racine — le même que la page d'accueil — d'où le titre dupliqué relevé par l'audit SEO du 03/09
// (Lot G, point 2). `robots: { index: false }` : une page de connexion n'a aucune valeur de
// recherche et ne fait que diluer le score des pages qui en ont une.
const TITRE = "Connexion — Thermogestion";
const DESCRIPTION =
  "Connectez-vous à votre atelier Thermogestion pour retrouver vos devis, votre production et votre stock de poudre.";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
