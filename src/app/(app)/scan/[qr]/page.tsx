import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3), reliquat vague 3 — même motif que `/clients` (voir le commentaire complet là-bas).
// Route dynamique : `params` reste une Promise transmise telle quelle, `Contenu` la déballe avec
// `use(params)` comme le faisait déjà l'ancien `page.tsx` client.
export const metadata: Metadata = { title: "Scan · Thermogestion" };

export default function ScanRoute({ params }: { params: Promise<{ qr: string }> }) {
  return <Contenu params={params} />;
}
