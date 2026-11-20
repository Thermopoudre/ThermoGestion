"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePiegeFocus } from "@/components/usePiegeFocus";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { errorFr } from "@/lib/errors";
import Assistant from "@/components/Assistant";
import { eur, dateFr, cn, STATUS_DEVIS, STATUS_FACTURE, STATUS_PROJET } from "@/lib/utils";

/**
 * Le sous-titre est composé en base, et il y porte les valeurs brutes des colonnes de statut :
 * la palette affichait « Métallerie du Sud · envoye », « FA-2026-0031 · payee », « BL-2026-0011 ·
 * facture » — les seuls endroits du produit où l'exploitant lisait le vocabulaire de la table
 * plutôt que le sien. On traduit ici plutôt que dans la fonction SQL : les libellés vivent déjà
 * dans `utils.ts`, ils y sont partagés avec les badges des listes et des fiches, et les dupliquer
 * en plpgsql aurait créé une seconde vérité qui aurait fini par diverger.
 */
const LIBELLES_STATUT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(STATUS_DEVIS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(STATUS_PROJET).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(STATUS_FACTURE).map(([k, v]) => [k, v.label])),
  // Statuts propres aux bons de livraison, absents des trois dictionnaires ci-dessus.
  emis: "Émis",
  facture: "Facturé",
  prepare: "Préparé",
};

/** Remplace les statuts bruts d'un sous-titre par leur libellé métier, segment par segment. */
function lisible(sousTitre: string): string {
  return sousTitre
    .split(" · ")
    .map((seg) => LIBELLES_STATUT[seg.trim()] ?? seg)
    .join(" · ");
}
import {
  MIN_CARACTERES, REBOND_MS, aplatir, chemin, grouper,
  type ResultatRecherche,
} from "@/lib/recherche";

/**
 * La barre de recherche unique de l'atelier.
 *
 * Le client appelle et dit « c'est pour le devis 2024-0338 », ou « les jantes de la Golf », ou
 * simplement son nom. Jusqu'ici il n'y avait aucune façon de retrouver l'un ou l'autre : le seul
 * champ « Rechercher » du produit filtrait en mémoire sur le nom du client, et uniquement parmi
 * les lignes déjà chargées.
 *
 * Deux entrées volontairement redondantes, parce que les deux publics ne se recouvrent pas :
 * ⌘K / Ctrl+K pour qui travaille au clavier au bureau, une loupe visible dans les deux barres de
 * navigation pour qui travaille au doigt, debout, avec des gants.
 */

const EVENEMENT_OUVERTURE = "thermogestion:recherche";

/** Ouvre la palette depuis n'importe où (Sidebar, barre du bas) sans contexte React partagé. */
export function ouvrirRecherche() {
  window.dispatchEvent(new Event(EVENEMENT_OUVERTURE));
}

/** Bouton loupe réutilisable — la même cible dans la barre latérale et dans la barre du bas. */
export function BoutonRecherche({ className, children, label = "Rechercher" }: { className?: string; children?: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={ouvrirRecherche}
      aria-label={`${label} (Ctrl + K)`}
      className={cn(
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className,
      )}
    >
      {children ?? <Search size={20} aria-hidden />}
    </button>
  );
}

export default function RechercheGlobale() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const [cherche, setCherche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [curseur, setCurseur] = useState(0);
  // F3 — la bascule vers l'assistant : un choix explicite de l'exploitant, jamais automatique.
  // Une recherche sans résultat n'est pas forcément une question mal formée — souvent c'est une
  // simple faute de frappe — donc on PROPOSE l'assistant, on ne le déclenche pas à sa place.
  const [versAssistant, setVersAssistant] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  // Échap n'est pas confié au piège : `clavier` le traite déjà, avec les flèches et Entrée.
  // Ce que le piège apporte ici, c'est que Tab ne sorte plus de la palette vers les boutons de
  // la page assombrie derrière elle, et que le focus revienne à la loupe à la fermeture.
  const boite = usePiegeFocus<HTMLDivElement>(ouvert);

  const fermer = useCallback(() => {
    setOuvert(false);
    setQ("");
    setResultats(null);
    setErreur(null);
    setCurseur(0);
    setVersAssistant(false);
  }, []);

  // ⌘K sur Mac, Ctrl+K ailleurs. `preventDefault` parce que Ctrl+K est pris par le navigateur.
  useEffect(() => {
    function raccourci(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert((o) => !o);
      }
    }
    function demande() { setOuvert(true); }
    window.addEventListener("keydown", raccourci);
    window.addEventListener(EVENEMENT_OUVERTURE, demande);
    return () => {
      window.removeEventListener("keydown", raccourci);
      window.removeEventListener(EVENEMENT_OUVERTURE, demande);
    };
  }, []);

  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);

  /**
   * Anti-rebond et garde à deux caractères. Sans eux, taper « D2026-00147 » lancerait onze
   * requêtes dont les dix premières ramèneraient la moitié de l'atelier.
   */
  useEffect(() => {
    const motif = q.trim();
    // Retaper change la question : la bascule vers l'assistant ne doit pas survivre à une
    // recherche différente, sans quoi le panneau resterait affiché sur un motif obsolète.
    setVersAssistant(false);
    if (motif.length < MIN_CARACTERES) {
      setResultats(null);
      setErreur(null);
      setCherche(false);
      return;
    }
    setCherche(true);
    let annule = false;
    const minuterie = setTimeout(async () => {
      const { data, error } = await supabase.rpc("recherche_globale", { q: motif, limite: 5 });
      if (annule) return;
      setCherche(false);
      if (error) {
        setErreur(errorFr(error));
        setResultats([]);
        return;
      }
      setErreur(null);
      setResultats((data as ResultatRecherche[]) ?? []);
      setCurseur(0);
    }, REBOND_MS);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [q, supabase]);

  const plat = useMemo(() => aplatir(resultats ?? []), [resultats]);
  const groupes = useMemo(() => grouper(resultats ?? []), [resultats]);

  function ouvrirResultat(r: ResultatRecherche) {
    const cible = chemin(r);
    fermer();
    router.push(cible);
  }

  function clavier(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); fermer(); return; }
    if (plat.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCurseur((c) => (c + 1) % plat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCurseur((c) => (c - 1 + plat.length) % plat.length); }
    else if (e.key === "Enter") { e.preventDefault(); ouvrirResultat(plat[curseur]); }
  }

  // La ligne sélectionnée doit rester visible quand on descend au clavier dans une longue liste.
  useEffect(() => {
    liste.current?.querySelector<HTMLElement>('[data-actif="oui"]')?.scrollIntoView({ block: "nearest" });
  }, [curseur]);

  if (!ouvert) return null;

  const motif = q.trim();
  const rienTrouve = resultats !== null && resultats.length === 0 && !cherche && !erreur;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche"
      onClick={fermer}
    >
      <div
        ref={boite}
        className="flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={clavier}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-3">
          <Search size={20} aria-hidden className="shrink-0 text-gray-400" />
          <input
            ref={champ}
            data-focus-initial
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Client, n° de devis, facture, plaque, poudre…"
            aria-label="Rechercher dans tout l'atelier"
            aria-describedby="recherche-aide"
            autoComplete="off"
            className="min-h-[52px] w-full border-0 bg-transparent py-3 text-base outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer la recherche"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div ref={liste} className="flex-1 overflow-y-auto" role="listbox" aria-label="Résultats">
          {motif.length < MIN_CARACTERES && (
            <p id="recherche-aide" className="px-4 py-6 text-center text-sm leading-relaxed text-gray-500">
              Tapez au moins {MIN_CARACTERES} caractères.
              <br />
              <span className="text-xs">
                Nom de client, ville, téléphone, e-mail, SIREN, immatriculation, numéro de devis,
                de facture, de bon de livraison, référence de poudre.
              </span>
            </p>
          )}
          {motif.length >= MIN_CARACTERES && cherche && resultats === null && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Recherche…</p>
          )}
          {erreur && <p className="px-4 py-6 text-center text-sm text-danger">{erreur}</p>}
          {rienTrouve && !versAssistant && (
            <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
              <p className="text-sm leading-relaxed text-gray-500">
                Rien ne correspond à « {motif} ».
                <br />
                <span className="text-xs">Les accents sont ignorés ; essayez le nom du client ou le numéro seul.</span>
              </p>
              {/* F3 — la bascule : ce n'est pas une fiche qu'on cherchait, ou la fiche n'existe
                  pas sous ce nom-là — l'assistant sait répondre à une question, pas seulement
                  retrouver une pièce. */}
              <button
                type="button"
                onClick={() => setVersAssistant(true)}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <MessageCircleQuestion size={16} className="text-brand" aria-hidden />
                Demander à l&apos;assistant
              </button>
            </div>
          )}
          {versAssistant && (
            <div className="p-3">
              <Assistant questionPrereplie={motif} />
            </div>
          )}

          {groupes.map((groupe) => (
            <div key={groupe.type}>
              <div className="sticky top-0 bg-gray-50 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wide text-gray-500">
                {groupe.libelle}
              </div>
              {groupe.lignes.map((r) => {
                const index = plat.indexOf(r);
                const actif = index === curseur;
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={actif}
                    data-actif={actif ? "oui" : "non"}
                    onMouseEnter={() => setCurseur(index)}
                    onClick={() => ouvrirResultat(r)}
                    className={cn(
                      "flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                      actif ? "bg-brand-light" : "hover:bg-gray-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{r.titre}</span>
                      {r.sous_titre && <span className="block truncate text-xs text-gray-500">{lisible(r.sous_titre)}</span>}
                    </span>
                    <span className="shrink-0 text-right text-xs text-gray-500">
                      {r.montant != null && <span className="block font-medium text-gray-700">{eur(r.montant)}</span>}
                      {r.date && <span className="block">{dateFr(r.date)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-4 border-t border-gray-200 px-4 py-2 text-2xs text-gray-500 md:flex">
          <span><kbd className="rounded border border-gray-300 px-1">↑</kbd> <kbd className="rounded border border-gray-300 px-1">↓</kbd> naviguer</span>
          <span><kbd className="rounded border border-gray-300 px-1">Entrée</kbd> ouvrir</span>
          <span><kbd className="rounded border border-gray-300 px-1">Échap</kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}
