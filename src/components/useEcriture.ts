"use client";
import { useCallback, useState } from "react";

/**
 * Compteur d'écritures réseau en cours, pour les rendre visibles.
 *
 * POURQUOI. `lib/db.ts:ecrire` a réglé la moitié du problème : une écriture qui échoue le dit
 * enfin. Il reste l'autre moitié — une écriture qui **réussit** en trois secondes ne dit rien
 * non plus pendant ces trois secondes. Sur la 4G d'un bâtiment métallique, l'opérateur choisit
 * une poudre dans la liste, rien ne bouge, il rechoisit. Les 21 écritures relevées par l'audit
 * étaient dans ce cas : l'erreur remontait, l'attente non.
 *
 * Un compteur et non un booléen : une fiche projet peut avoir un champ enregistré au `blur` et
 * un bouton pressé dans la foulée. Avec un booléen, la fin de la première écriture éteindrait
 * l'indicateur alors que la seconde est encore en vol.
 *
 * `suivre` renvoie ce que la fonction enveloppée renvoie, pour rester transparent à l'appel :
 * `const ok = await suivre(() => maj({ ... }))`.
 */
export function useEcriture() {
  const [enVol, setEnVol] = useState(0);

  const suivre = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setEnVol((n) => n + 1);
    try {
      return await action();
    } finally {
      // `finally` et non après le `await` : une exception réseau non capturée laisserait sinon
      // l'écran verrouillé sur « Enregistrement… » jusqu'au rechargement de la page.
      setEnVol((n) => n - 1);
    }
  }, []);

  return { enCours: enVol > 0, suivre };
}
