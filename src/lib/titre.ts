/**
 * Titre d'onglet des écrans internes (lot D13 du cahier des charges v3) : presque tous les
 * écrans partageaient le même titre, ce qui rend un onglet parmi dix introuvable dans la barre du
 * navigateur. Les pages `(app)` sont des composants client (elles dépendent de la session), donc
 * pas de `export const metadata` possible : ce hook pose `document.title` une fois les données
 * chargées, avec un suffixe unique pour rester reconnaissable en dehors de l'application.
 */
"use client";
import { useEffect } from "react";

export function definirTitre(titre: string | null | undefined) {
  if (typeof document !== "undefined" && titre) document.title = `${titre} · Thermogestion`;
}

/** Variante à effet, pour poser le titre dès qu'une valeur dépendante de données async est prête. */
export function useTitreDocument(titre: string | null | undefined) {
  useEffect(() => {
    definirTitre(titre);
  }, [titre]);
}
