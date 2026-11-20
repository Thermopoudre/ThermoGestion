"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compterEnAttente, estErreurReseau, rejouer, type ActionEnFile } from "@/lib/offline/queue";

/**
 * Indicateur « hors ligne — N pointage(s) en attente » + rejeu automatique au retour réseau
 * (lot C, C4). Un seul hook, monté sur /scan : le rejeu applique les RPC dans l'ordre où les
 * gestes ont eu lieu, avec leur horodatage réel (`p_survenu_a`), jamais celui de la reconnexion.
 */
export function useFileAttentePointages() {
  const [horsLigne, setHorsLigne] = useState(false);
  const [enAttente, setEnAttente] = useState(0);
  const [enCoursDeRejeu, setEnCoursDeRejeu] = useState(false);

  const rafraichir = useCallback(async () => {
    setEnAttente(await compterEnAttente());
  }, []);

  const rejouerFile = useCallback(async () => {
    setEnCoursDeRejeu(true);
    const supabase = createClient();
    await rejouer(async (action: ActionEnFile) => {
      const { error } =
        action.type === "demarrer_etape"
          ? await supabase.rpc("demarrer_etape", { p_projet: action.projet_id, p_survenu_a: action.survenu_a })
          : await supabase.rpc("avancer_etape", { p_projet_id: action.projet_id, p_survenu_a: action.survenu_a });
      // Une erreur réseau laisse l'action en file pour un prochain essai. Une erreur métier
      // (projet supprimé entre-temps, étape déjà validée par un collègue…) la retire pour ne pas
      // bloquer indéfiniment le reste de la file — l'opérateur revoit de toute façon l'état réel
      // du projet sur sa fiche.
      return !error || !estErreurReseau(error);
    });
    await rafraichir();
    setEnCoursDeRejeu(false);
  }, [rafraichir]);

  useEffect(() => {
    setHorsLigne(typeof navigator !== "undefined" ? !navigator.onLine : false);
    rafraichir();

    function surRetourLigne() {
      setHorsLigne(false);
      rejouerFile();
    }
    function surPerteLigne() {
      setHorsLigne(true);
    }
    window.addEventListener("online", surRetourLigne);
    window.addEventListener("offline", surPerteLigne);
    // Au montage, si le réseau est déjà là, on tente un rejeu — utile pour une file laissée par
    // une session précédente (onglet fermé hors ligne, rouvert plus tard déjà connecté).
    if (typeof navigator !== "undefined" && navigator.onLine) rejouerFile();

    return () => {
      window.removeEventListener("online", surRetourLigne);
      window.removeEventListener("offline", surPerteLigne);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { horsLigne, enAttente, enCoursDeRejeu, rafraichir, rejouerFile };
}
