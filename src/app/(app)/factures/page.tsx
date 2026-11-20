import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3) — titre d'onglet au chargement direct : `useTitreDocument` ne pose `document.title`
// qu'en `useEffect`, donc après le premier rendu. Un lien partagé, un favori ou un onglet rouvert
// affiche le titre générique de l'app le temps du montage. Ce fichier est un composant *serveur*
// (pas de `"use client"`) : Next peut résoudre `metadata` avant tout JavaScript client, pendant que
// `Contenu` (l'ancien `page.tsx`, inchangé) garde toute la logique cliente et son propre
// `useTitreDocument` — même suffixe que `definirTitre`, pour qu'il n'y ait pas de scintillement au
// montage.
export const metadata: Metadata = { title: "Factures · Thermogestion" };

export default function FacturesListPage() {
  return <Contenu />;
}
