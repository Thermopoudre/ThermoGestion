import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3), reliquat vague 3 — même motif que `/clients` (voir le commentaire complet là-bas).
export const metadata: Metadata = { title: "Abonnement · Thermogestion" };

export default function AbonnementRoute() {
  return <Contenu />;
}
