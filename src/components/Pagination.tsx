"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorFr } from "@/lib/errors";

/**
 * Pagination serveur — le socle commun de toutes les listes.
 *
 * Ce qui existait avant : `.limit(200)`, puis un filtre en mémoire. À 12 000 devis, l'écran en
 * montrait 200 et les 11 800 autres n'étaient plus atteignables depuis l'interface ; le bouton
 * « Tous » ne filtrait que les 200 déjà chargées, ce qui est pire que pas de filtre du tout
 * puisqu'il donne l'illusion d'avoir tout regardé. Les écrans Clients et Stock, eux, chargeaient
 * tout : mesuré à 3 000 clients, la page téléchargeait 2,6 Mo de JSON pour afficher trente cartes.
 *
 * La règle posée ici, valable partout : **la base trie, filtre et découpe ; le navigateur affiche.**
 */

/** Vingt-cinq lignes : deux à trois écrans de pouce sur téléphone, une page lisible sur bureau. */
export const TAILLE_PAGE = 25;

/**
 * `data` est volontairement `unknown` : le type que supabase-js déduit d'un `select("a, b(c)")`
 * ne coïncide jamais tout à fait avec le type d'écran (une relation embarquée y est parfois un
 * tableau), et forcer la coïncidence obligeait chaque appelant à un `as never`. La forme réelle
 * est décrite une fois par l'écran, sur `useListePaginee<TypeDeLigne>`.
 */
export type ReponseListe = { data: unknown; count: number | null; error: unknown };
export type Chargeur = (de: number, a: number) => PromiseLike<ReponseListe>;

/**
 * PostgREST ne rend pas une page vide quand on demande au-delà de la fin : il rend une **erreur**
 * `PGRST103`, « Requested range not satisfiable ». Le cas n'est pas théorique — il suffit qu'un
 * collègue supprime des lignes pendant qu'on est en page 5, ou qu'un filtre se resserre juste
 * avant le clic. Affiché tel quel, ce message anglais donne l'impression d'une panne ; on
 * ramène simplement l'opérateur à la première page.
 */
export function estHorsPlage(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "PGRST103" || /range not satisfiable/i.test(e?.message ?? "");
}

export type Liste<T> = {
  lignes: T[] | null;
  total: number | null;
  page: number;
  nbPages: number;
  taille: number;
  erreur: string | null;
  allerA: (page: number) => void;
  recharger: () => void;
};

/**
 * Charge une page de liste et suit le filtre.
 *
 * `cle` identifie le jeu de critères courant (statut, tri, recherche…). Elle sert à deux choses :
 * relancer la requête quand elle change, et **revenir à la première page** — rester en page 7
 * après avoir changé de filtre affiche un écran vide qui ressemble à une panne.
 */
export function useListePaginee<T>(charger: Chargeur, cle: string, taille = TAILLE_PAGE): Liste<T> {
  const [page, setPage] = useState(0);
  const [lignes, setLignes] = useState<T[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tour, setTour] = useState(0);
  // La fonction de chargement est recréée à chaque rendu par l'écran appelant : la garder dans une
  // référence évite d'en faire une dépendance et de reboucler à l'infini.
  const chargeur = useRef(charger);
  chargeur.current = charger;
  const clePrecedente = useRef(cle);

  if (clePrecedente.current !== cle) {
    clePrecedente.current = cle;
    if (page !== 0) setPage(0);
  }

  useEffect(() => {
    let annule = false;
    setLignes(null);
    const de = page * taille;
    Promise.resolve(chargeur.current(de, de + taille - 1)).then(({ data, count, error }) => {
      if (annule) return;
      if (estHorsPlage(error)) {
        if (page !== 0) setPage(0);
        else { setErreur(null); setLignes([]); setTotal(0); }
        return;
      }
      if (error) {
        // Une erreur de lecture silencieuse laisse un écran en chargement perpétuel : l'opérateur
        // croit à un réseau lent et attend, alors qu'un refus de droits ne se débloquera jamais.
        setErreur(errorFr(error));
        setLignes([]);
        setTotal(0);
        return;
      }
      setErreur(null);
      setLignes((data ?? []) as T[]);
      setTotal(count);
    });
    return () => { annule = true; };
  }, [page, taille, cle, tour]);

  const allerA = useCallback((p: number) => setPage(Math.max(0, p)), []);
  const recharger = useCallback(() => setTour((t) => t + 1), []);
  const nbPages = total != null ? Math.max(1, Math.ceil(total / taille)) : 1;

  return { lignes, total, page, nbPages, taille, erreur, allerA, recharger };
}

/**
 * Barre de pagination.
 *
 * Deux cibles de 44 px minimum et le compte écrit en toutes lettres : sur une liste tronquée,
 * savoir qu'il reste 11 800 lignes derrière est plus utile que de pouvoir sauter à la page 473.
 * Masquée quand tout tient sur une page — un pied de liste inutile est du bruit.
 */
export function Pagination({ liste, nomPluriel }: { liste: Pick<Liste<unknown>, "page" | "nbPages" | "total" | "taille" | "allerA">; nomPluriel: string }) {
  const { page, nbPages, total, taille, allerA } = liste;
  if (total == null || total <= taille) return null;
  const premier = page * taille + 1;
  const dernier = Math.min(total, (page + 1) * taille);

  const bouton = "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 pt-1" aria-label="Pagination">
      <p className="text-xs text-gray-600" aria-live="polite">
        {premier}–{dernier} sur {total.toLocaleString("fr-FR")} {nomPluriel}
        <span className="text-gray-400"> · page {page + 1} sur {nbPages}</span>
      </p>
      <div className="flex gap-2">
        <button type="button" className={bouton} onClick={() => allerA(page - 1)} disabled={page === 0}>
          <ChevronLeft size={16} aria-hidden /> Précédent
        </button>
        <button type="button" className={bouton} onClick={() => allerA(page + 1)} disabled={page + 1 >= nbPages}>
          Suivant <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/**
 * Filtres en pastilles — statut, période, onglet.
 *
 * Le composant ne fait que rendre les boutons : c'est l'écran qui rejoue la requête, parce que
 * chaque filtre est désormais une clause `.eq()` ou `.in()` envoyée à la base, jamais un
 * `Array.filter` sur ce qui traînait en mémoire.
 */
export function Filtres<T extends string>({ valeur, options, onChange, label }: {
  valeur: T;
  options: { valeur: T; libelle: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          onClick={() => onChange(o.valeur)}
          aria-pressed={valeur === o.valeur}
          className={cn(
            "min-h-[36px] shrink-0 rounded-full px-3.5 text-xs font-medium transition duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            valeur === o.valeur ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
          )}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/** Sélecteur de tri. Le tri part en base : trier 25 lignes dans le navigateur ne trie rien. */
export function Tri<T extends string>({ valeur, options, onChange }: {
  valeur: T;
  options: { valeur: T; libelle: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
      <span>Trier par</span>
      <select
        value={valeur}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-h-[36px] rounded-lg border border-gray-300 bg-white px-2 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </select>
    </label>
  );
}
