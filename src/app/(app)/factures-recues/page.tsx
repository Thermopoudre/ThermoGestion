import type { Metadata } from "next";
import Contenu from "./Contenu";

// Même motif que `/bl`, `/factures`… (voir leur `page.tsx`) : un composant *serveur* pour que le
// titre d'onglet soit posé avant tout JavaScript client, `Contenu` gardant toute la logique.
export const metadata: Metadata = { title: "Factures reçues · Thermogestion" };

export default function FacturesRecuesPage() {
  return <Contenu />;
}
