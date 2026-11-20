import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3), reliquat vague 3 — même motif que `/clients` : `Contenu` (l'ancien `page.tsx`, client,
// inchangé) garde `useTitreDocument` pour le titre une fois les données chargées ; ce composant
// *serveur* pose `metadata` avant tout JavaScript, pour qu'un lien partagé ou un onglet rouvert
// n'affiche pas le titre générique de l'app le temps du montage.
export const metadata: Metadata = { title: "Bains de prétraitement · Thermogestion" };

export default function BainsRoute() {
  return <Contenu />;
}
