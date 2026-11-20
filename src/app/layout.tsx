import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/Toast";
import PwaRegister from "@/components/PwaRegister";
import { JsonLd, ORGANISATION, LOGICIEL } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/env";
import { PRIX_ENTREE } from "@/lib/abonnement";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

// Valeurs par défaut du site. Les pages de la vitrine exportent leur propre `metadata` et les
// remplacent ; celles-ci servent aux écrans sans métadonnées propres (connexion, inscription…).
// « rénovation de jantes » est dans le titre parce que c'est la requête sans concurrence, et que
// « logiciel thermolaquage » est déjà tenue par un concurrent mieux référencé.
const TITRE = "Thermogestion — logiciel d'atelier : thermolaquage et rénovation de jantes";
const DESCRIPTION = `Devis au m², au mètre linéaire ou au pouce, signés en ligne. Suivi de production au QR, stock de poudre décompté à la cuisson, certificat de conformité. À partir de ${PRIX_ENTREE} € HT/mois, essai 30 jours sans carte.`;

export const metadata: Metadata = {
  // Fix audit n°3 (09/07) : sans metadataBase, Next.js résout og:image en http://localhost:3000
  // en prod — les partages WhatsApp/LinkedIn affichaient une vignette cassée.
  metadataBase: new URL(SITE_URL),
  title: TITRE,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  // `"./"` est résolu par Next relativement à la route rendue : chaque page publique obtient sa
  // propre canonique, au lieu de toutes pointer sur la racine.
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Thermogestion",
    title: TITRE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#11203A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${grotesk.variable}`}>
      <head>
        {/* Identité de l'éditeur et fiche produit chiffrée : c'est ce qu'un moteur de réponse
            peut citer. Le bloc FAQPage vit sur la page qui porte les questions (voir
            `faqJsonLd` dans components/JsonLd.tsx), il doit en reprendre le texte exact. */}
        <JsonLd data={ORGANISATION} />
        <JsonLd data={LOGICIEL} />
      </head>
      <body className="font-sans"><ToastProvider>{children}</ToastProvider><PwaRegister /></body>
    </html>
  );
}
