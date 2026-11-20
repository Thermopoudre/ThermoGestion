import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3), reliquat vague 3 — même motif que `/clients` (voir le commentaire complet là-bas).
export const metadata: Metadata = { title: "Corbeille · Thermogestion" };

export default function CorbeilleRoute() {
  return <Contenu />;
}
