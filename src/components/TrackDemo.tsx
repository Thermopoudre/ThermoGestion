"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/**
 * Instrumentation de la démonstration publique.
 *
 * La démo est le meilleur argument de vente du produit, et personne ne savait combien de visiteurs
 * l'ouvraient, quels écrans ils regardaient, ni où ils s'arrêtaient. Deux événements suffisent :
 * `demo_opened` une fois par session (taux d'ouverture), `demo_screen` à chaque écran
 * (profondeur = nombre d'écrans distincts vus dans une même `session_id`).
 *
 * Monté uniquement quand l'atelier porte `demo = true` : aucun atelier réel n'est mesuré ainsi.
 */
export default function TrackDemo() {
  const chemin = usePathname();
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("tg_demo_ouverte")) {
        sessionStorage.setItem("tg_demo_ouverte", "1");
        track("demo_opened");
      }
    } catch {
      // stockage refusé : on perd le dédoublonnage, pas la mesure
    }
    // Le chemin est normalisé : `/projets/<uuid>` et `/projets/<autre uuid>` sont le même écran,
    // sinon la « profondeur de démo » compterait des fiches et non des rubriques.
    track("demo_screen", { ecran: chemin.replace(/\/[0-9a-f-]{8,}/gi, "/:id") });
  }, [chemin]);
  return null;
}
