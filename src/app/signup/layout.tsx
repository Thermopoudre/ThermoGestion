import type { Metadata } from "next";

// Même raison que `src/app/login/layout.tsx` : `page.tsx` est un composant client et ne peut pas
// exporter `metadata`, donc la page héritait du titre par défaut du layout racine — identique à
// celui de l'accueil (Lot G, point 2). `/signup` reste indexable, à la différence de `/login` :
// c'est la page que la vitrine pousse comme conversion, elle doit pouvoir se classer seule sur
// une requête du type « essai thermogestion » ou « créer un compte thermogestion ».
const TITRE = "Essai gratuit 30 jours — Thermogestion";
const DESCRIPTION =
  "Créez votre atelier en 30 secondes. Devis signés en ligne, suivi de production au QR, stock de poudre. Essai 30 jours, sans carte bancaire.";

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: "/signup" },
  openGraph: { title: TITRE, description: DESCRIPTION, url: "/signup", type: "website", locale: "fr_FR", siteName: "Thermogestion" },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
