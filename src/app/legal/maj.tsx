/**
 * Date de dernière mise à jour des textes légaux.
 *
 * POURQUOI une seule constante pour les trois pages : un document contractuel sans date de
 * version est un document dont personne ne sait laquelle s'applique, et trois dates saisies à
 * la main dans trois fichiers finissent toujours par diverger — c'est exactement ce qui est
 * arrivé aux prix des formules. On change la date ici, une fois, quand on change un texte.
 *
 * Elle est écrite en toutes lettres plutôt que calculée : la date de révision d'un contrat est
 * un fait, pas la date du dernier déploiement.
 */
export const MAJ_LEGAL = "21 août 2026";

/** Le bandeau de version, identique en haut des trois documents. */
export function MajLegal() {
  return (
    <p className="!text-xs !text-gray-500">
      Dernière mise à jour : <b>{MAJ_LEGAL}</b>.
    </p>
  );
}
