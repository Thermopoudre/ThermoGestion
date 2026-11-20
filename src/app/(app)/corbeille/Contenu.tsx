"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { usePlan } from "@/components/PlanProvider";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, useListePaginee } from "@/components/Pagination";
import { CORBEILLE, ENTITES_CORBEILLE, JOURS_CORBEILLE, joursAvantPurge, type LigneCorbeille } from "@/lib/corbeille";
import { useTitreDocument } from "@/lib/titre";
import { dateFr } from "@/lib/utils";

/**
 * La corbeille.
 *
 * Elle lit la RPC `corbeille()` et non les tables : les politiques posées avec `deleted_at`
 * masquent les lignes supprimées **partout**, y compris à celui qui vient de les jeter. C'est
 * exactement ce qu'on veut — une ligne invisible ne peut pas être dé-supprimée d'un `update`
 * depuis la console du navigateur — et c'est pourquoi la lecture comme la restauration passent
 * par une fonction qui revérifie l'atelier et le rôle.
 *
 * La liste reste paginée côté serveur, comme toutes les autres : une corbeille de trente jours
 * est petite en général, mais « en général » n'est pas une garantie, et un atelier qui fait le
 * ménage de six mois d'essai en jette quelques milliers d'un coup.
 */
const FILTRES = [
  { valeur: "tous" as const, libelle: "Tout" },
  ...ENTITES_CORBEILLE.map((e) => ({ valeur: e, libelle: CORBEILLE[e].pluriel })),
];
type Filtre = (typeof FILTRES)[number]["valeur"];

export default function CorbeillePage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { commercial } = usePlan();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [enCours, setEnCours] = useState<string | null>(null);

  // Devis et factures n'apparaissent pas pour un compte d'atelier : la RPC ne les rend pas, et
  // proposer un filtre qui ramène toujours zéro ligne ressemble à une panne.
  const filtres = FILTRES.filter((f) => commercial || (f.valeur !== "devis" && f.valeur !== "facture"));

  const charger = useCallback((de: number, a: number) => {
    let requete = supabase.rpc("corbeille", {}, { count: "exact" });
    if (filtre !== "tous") requete = requete.eq("entite", filtre);
    return requete.range(de, a);
  }, [supabase, filtre]);

  const liste = useListePaginee<LigneCorbeille>(charger, filtre);

  useTitreDocument("Corbeille");

  async function restaurer(ligne: LigneCorbeille) {
    setEnCours(ligne.id);
    const ok = await ecrire(
      supabase.rpc("restaurer_de_la_corbeille", { p_entite: ligne.entite, p_id: ligne.id }),
      toast,
      `${CORBEILLE[ligne.entite].singulier} restauré`,
    );
    setEnCours(null);
    if (ok) liste.recharger();
  }

  return (
    <div className="flex flex-col gap-3 md:max-w-3xl">
      <PageTitle>Corbeille</PageTitle>
      <p className="-mt-2 text-sm text-gray-600">
        Ce que vous avez retiré des listes reste ici <b>{JOURS_CORBEILLE} jours</b>, puis part
        définitivement. Rien n&apos;est perdu entre-temps : un clic sur « Restaurer » remet la fiche
        exactement là où elle était.
      </p>
      <p className="-mt-1 text-xs text-gray-500">
        Une facture émise n&apos;apparaîtra jamais ici : c&apos;est une pièce comptable, elle ne se
        supprime pas — elle s&apos;annule, ou se corrige par un avoir.
      </p>

      <Filtres label="Filtrer la corbeille" valeur={filtre} onChange={setFiltre} options={filtres} />

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}

      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty icon={<Trash2 size={28} aria-hidden />}>
          {filtre === "tous"
            ? "La corbeille est vide. Tout ce que vous supprimerez y restera 30 jours avant d'être effacé."
            : `Aucun élément de type « ${CORBEILLE[filtre as keyof typeof CORBEILLE].pluriel} » dans la corbeille.`}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {liste.lignes.map((l) => {
            const jours = joursAvantPurge(l.purge_le);
            return (
              <li key={`${l.entite}-${l.id}`}>
                <Card className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral">{CORBEILLE[l.entite].singulier}</Badge>
                      <span className="truncate font-medium">{l.titre}</span>
                    </span>
                    {l.sous_titre && <span className="mt-0.5 block truncate text-xs text-gray-500">{l.sous_titre}</span>}
                    <span className="mt-0.5 block text-xs text-gray-500">
                      Supprimé le {dateFr(l.supprime_le)} ·{" "}
                      {/* Le compte à rebours est écrit en jours, pas en date : « effacé dans 2 jours »
                          se comprend d'un coup d'œil là où « purge le 19/09 » demande un calcul. */}
                      <span className={jours <= 3 ? "font-medium text-danger" : ""}>
                        {jours === 0 ? "effacement imminent" : `effacé dans ${jours} jour${jours > 1 ? "s" : ""}`}
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => restaurer(l)}
                    disabled={enCours === l.id}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 transition duration-150 ease-out hover:bg-gray-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <RotateCcw size={16} aria-hidden /> {enCours === l.id ? "…" : "Restaurer"}
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination liste={liste} nomPluriel="éléments" />

      <p className="text-xs text-gray-500">
        Besoin de retrouver un client seulement archivé ? Il n&apos;est pas ici :{" "}
        <Link href="/clients" className="underline">ouvrez la liste des clients</Link> et choisissez
        le filtre « Archivés ».
      </p>
    </div>
  );
}
