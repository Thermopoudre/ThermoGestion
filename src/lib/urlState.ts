"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Lot D — D10 : onglet ou filtre reflété dans l'URL.
 *
 * « Voir les BL à facturer » ouvrait `/bl` sur le filtre par défaut (« Tous »), pas sur celui
 * promis par le lien : rien, dans l'état d'un onglet ou d'un filtre, ne survivait à une
 * navigation, à un partage de lien ou à un appui sur Précédent. `/reglages?onglet=equipe` (le
 * pied du courriel du matin) ne faisait déjà que LIRE le paramètre au montage, jamais l'écrire :
 * cliquer un autre onglet ne changeait pas l'URL, et Précédent quittait la page entière plutôt que
 * de revenir sur le premier onglet.
 *
 * `useSearchParams()` imposerait une frontière `<Suspense>` à des pages qui n'en avaient pas
 * besoin — c'est déjà la raison documentée dans `/reglages` et `/bl?client=` pour lire
 * `window.location.search` à la main. Ce hook généralise cette même méthode : lecture au montage,
 * écriture par `router.replace` (jamais `push` — changer d'onglet ne doit pas empiler une entrée
 * d'historique par clic, sinon Précédent recule onglet par onglet au lieu de quitter la page).
 *
 * La logique elle-même (lire un paramètre valide, construire la nouvelle URL) est extraite en
 * fonctions pures, testables sans navigateur ni React — `useEtatUrl` n'est qu'un fil qui les
 * relie à `window` et au routeur.
 */

/** Valeur initiale : le paramètre de la query string s'il fait partie des valeurs attendues, sinon le défaut. */
export function lireParamUrl<T extends string>(search: string, param: string, valeurs: readonly T[], defaut: T): T {
  const cible = new URLSearchParams(search).get(param);
  return cible && (valeurs as readonly string[]).includes(cible) ? (cible as T) : defaut;
}

/**
 * URL (chemin + query string) à poser après un changement d'onglet ou de filtre.
 *
 * La valeur par défaut n'encombre jamais l'URL : `/bl` et `/bl?filtre=actifs` doivent rester le
 * même lien, sinon un favori posé avant ce correctif ne retrouve plus le même écran.
 */
export function urlAvecParam(pathname: string, search: string, param: string, valeur: string, defaut: string): string {
  const params = new URLSearchParams(search);
  if (valeur === defaut) params.delete(param);
  else params.set(param, valeur);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function useEtatUrl<T extends string>(
  param: string,
  defaut: T,
  valeurs: readonly T[],
): [T, (v: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const [valeur, setValeurBrute] = useState<T>(defaut);

  useEffect(() => {
    setValeurBrute(lireParamUrl(window.location.search, param, valeurs, defaut));
    // Lecture unique au montage : un changement de `valeurs` (tableau recréé à chaque rendu côté
    // appelant) ne doit pas relire l'URL par-dessus le choix déjà fait par l'opérateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  const setValeur = useCallback(
    (v: T) => {
      setValeurBrute(v);
      router.replace(urlAvecParam(pathname, window.location.search, param, v, defaut), { scroll: false });
    },
    [router, pathname, param, defaut],
  );

  return [valeur, setValeur];
}
