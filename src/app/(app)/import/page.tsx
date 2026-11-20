import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3), reliquat vague 3 — même motif que `/clients` (voir le commentaire complet là-bas).
// Ce titre reprend le libellé affiché (`<PageTitle>Importer vos données</PageTitle>` dans
// `Contenu.tsx`), qui n'avait jamais eu de `useTitreDocument` associé : l'onglet gardait le titre
// générique de l'app même une fois la page montée, pas seulement avant.
export const metadata: Metadata = { title: "Importer vos données · Thermogestion" };

export default function ImportRoute() {
  return <Contenu />;
}
