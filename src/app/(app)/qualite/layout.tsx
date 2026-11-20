"use client";
import VerrouPlan from "@/components/VerrouPlan";

/**
 * Verrou d'écran. Il ne protège rien à lui seul — la base refuse déjà l'écriture
 * (`exiger_capacite`) et les vues de coût ne rendent aucune ligne. Il évite à l'atelier de buter
 * sur un refus sans explication, et dit ce que la formule supérieure ouvrirait.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <VerrouPlan capacite="qualite">{children}</VerrouPlan>;
}
