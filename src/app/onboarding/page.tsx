import type { Metadata } from "next";
import Contenu from "./Contenu";

// D13 (v3), reliquat vague 3 — même motif que `/clients` (voir `src/app/(app)/clients/page.tsx`).
export const metadata: Metadata = { title: "Bienvenue · Thermogestion" };

export default function OnboardingRoute() {
  return <Contenu />;
}
