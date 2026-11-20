"use client";
import { useEffect, useRef } from "react";

/**
 * Éléments qu'un navigateur accepte de mettre au clavier, dans l'ordre du document.
 * `[tabindex="-1"]` est exclu : c'est précisément la marque d'un élément focusable par script
 * mais pas par Tab.
 */
const FOCUSABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Piège de focus pour les quatre boîtes modales du produit.
 *
 * POURQUOI. Une modale qui ne retient pas le focus n'est modale que pour la souris. Au clavier,
 * la troisième tabulation sort de la boîte de confirmation et va se poser sur les boutons de la
 * page *derrière* le voile — que l'utilisateur ne voit pas, puisqu'ils sont assombris. Il valide
 * alors une action qu'il ne lit pas. C'est un manquement dur à WCAG 2.1.2 (No Keyboard Trap, dans
 * son sens inverse) et 2.4.3 (Focus Order), et les quatre modales en souffraient : `ConfirmModal`,
 * `RechercheGlobale`, le panneau « Plus » de `BottomNav` et `BlocageAbonnement`.
 *
 * Le crochet fait quatre choses, dans cet ordre :
 *   1. il mémorise l'élément qui avait le focus avant l'ouverture ;
 *   2. il donne le focus à l'élément marqué `data-focus-initial` (à défaut, au premier focusable) ;
 *   3. il boucle Tab / Maj+Tab entre le premier et le dernier focusable de la boîte ;
 *   4. il rend le focus à l'élément mémorisé à la fermeture — sans quoi l'utilisateur reprend au
 *      tout début de la page, ce qui, sur la fiche projet, veut dire quinze tabulations.
 *
 * `onEchap` est facultatif : `RechercheGlobale` gère déjà Échap avec ses flèches, et deux
 * gestionnaires sur la même touche fermeraient deux fois. `BlocageAbonnement`, lui, ne se ferme
 * pas du tout (c'est un paywall) : il piège le focus sans écouter Échap.
 */
export function usePiegeFocus<T extends HTMLElement = HTMLDivElement>(
  actif: boolean,
  onEchap?: () => void,
) {
  const conteneur = useRef<T>(null);
  // La fonction de fermeture change à chaque rendu du parent : on la lit par référence pour ne
  // pas remonter tout le piège (et donc reprendre le focus) à chaque frappe dans le champ.
  const echap = useRef(onEchap);
  echap.current = onEchap;

  useEffect(() => {
    const boite = conteneur.current;
    if (!actif || !boite) return;

    const precedent = document.activeElement as HTMLElement | null;
    const listeFocusables = () =>
      Array.from(boite.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
        // Un élément masqué (`hidden`, `display:none`) a une boîte englobante nulle : le laisser
        // dans la liste ferait « disparaître » le focus le temps d'une tabulation.
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );

    const vise = boite.querySelector<HTMLElement>("[data-focus-initial]") ?? listeFocusables()[0];
    vise?.focus();

    function auClavier(e: KeyboardEvent) {
      if (e.key === "Escape" && echap.current) {
        e.preventDefault();
        echap.current();
        return;
      }
      if (e.key !== "Tab") return;
      const cibles = listeFocusables();
      if (cibles.length === 0) {
        // Rien à focaliser dans la boîte : on empêche quand même Tab de repartir dans la page.
        e.preventDefault();
        return;
      }
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      const actifCourant = document.activeElement;
      if (e.shiftKey && (actifCourant === premier || !boite!.contains(actifCourant))) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (actifCourant === dernier || !boite!.contains(actifCourant))) {
        e.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", auClavier, true);
    return () => {
      document.removeEventListener("keydown", auClavier, true);
      // `isConnected` : après une navigation, l'élément d'origine n'est plus dans le document et
      // lui rendre le focus ne ferait rien de bon.
      if (precedent?.isConnected) precedent.focus();
    };
  }, [actif]);

  return conteneur;
}
