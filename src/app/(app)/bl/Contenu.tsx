"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, useListePaginee } from "@/components/Pagination";
import { calcTotaux, dateFr, eur } from "@/lib/utils";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_BL } from "@/lib/types";
import type { DevisItem } from "@/lib/types";

/**
 * `lignes` et `remise` sont chargées malgré la règle des colonnes explicites : le montant TTC du
 * bon n'est pas stocké, il se recalcule depuis ses lignes. Le reste (signature, jeton public,
 * poids) ne sert qu'à la fiche.
 */
const COLONNES = "id, numero, status, created_at, nb_colis, lignes, remise, client_id, clients(nom)";
type BlListe = {
  id: string;
  numero: string | null;
  status: keyof typeof STATUS_BL;
  created_at: string;
  nb_colis: number | null;
  lignes: DevisItem[] | null;
  remise: { type: "pct" | "montant"; valeur: number } | null;
  client_id: string;
  clients: { nom: string } | null;
};

const FILTRES = [
  { valeur: "actifs", libelle: "À livrer", statuts: ["brouillon", "emis"] },
  // Amélioration n°5 (07/09) — un BL passé en facturation a bel et bien été livré : côté atelier,
  // « Livrés » veut dire « ce qui a quitté les murs ». Avant, un BL `facture` ne sortait plus de
  // « À livrer » ET n'entrait pas dans « Livrés » : invisible partout sauf dans « Tous », ce qui
  // avait fait croire à la recette que la page était vide.
  { valeur: "livre", libelle: "Livrés", statuts: ["livre", "facture"] },
  // Distinct de « Livrés » : c'est le sous-ensemble « pas encore facturé », même définition que
  // `reste_a_facturer`/`bl_a_facturer` dans la vue `client_rentabilite` (statut `livre` sans
  // facture liée). Pilotage y renvoie depuis sa colonne « Reste à facturer ».
  { valeur: "a_facturer", libelle: "À facturer", statuts: ["livre"] },
  { valeur: "tous", libelle: "Tous", statuts: null },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];
const VALEURS_FILTRE: readonly Filtre[] = FILTRES.map((f) => f.valeur);

export default function BlListPage() {
  const supabase = useMemo(() => createClient(), []);
  // D10 — le filtre vit dans l'URL (`?filtre=`) : « Voir les BL à facturer » ouvrait `/bl` sur
  // le filtre par défaut (« À livrer ») au lieu de « Livrés », et rien ne se partageait ni ne
  // survivait à Précédent.
  const [filtre, setFiltre] = useEtatUrl<Filtre>("filtre", "actifs", VALEURS_FILTRE);
  /**
   * `?client=<id>` : c'est le chemin ouvert depuis Pilotage → Rentabilité client, sur la colonne
   * « Reste à facturer ». On lit la chaîne de requête à la main plutôt qu'avec `useSearchParams`
   * pour ne pas imposer une frontière `<Suspense>` à une page qui n'en a pas besoin. Le filtre
   * part désormais en base : il ne portait avant que sur les 200 lignes déjà chargées.
   */
  const [clientFiltre, setClientFiltre] = useState<string | null>(null);
  const [nomClientFiltre, setNomClientFiltre] = useState<string | null>(null);

  useEffect(() => {
    const cible = new URLSearchParams(window.location.search).get("client");
    if (!cible) return;
    setClientFiltre(cible);
    // Arriver depuis la rentabilité, c'est venir chercher ce qui est livré et pas encore facturé —
    // « à facturer », pas « Livrés » (qui inclut désormais le déjà-facturé, amélioration n°5) —
    // sauf si l'URL portait déjà un filtre explicite, qu'on ne doit pas écraser.
    if (!new URLSearchParams(window.location.search).get("filtre")) setFiltre("a_facturer");
    supabase.from("clients").select("nom").eq("id", cible).maybeSingle()
      .then(({ data }) => setNomClientFiltre((data as { nom: string } | null)?.nom ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const charger = useCallback((de: number, a: number) => {
    const statuts = FILTRES.find((f) => f.valeur === filtre)?.statuts;
    let requete = supabase.from("bons_livraison").select(COLONNES, { count: "exact" });
    if (statuts) requete = requete.in("status", [...statuts]);
    if (clientFiltre) requete = requete.eq("client_id", clientFiltre);
    return requete.order("created_at", { ascending: false }).range(de, a);
  }, [supabase, filtre, clientFiltre]);

  const liste = useListePaginee<BlListe>(charger, `${filtre}|${clientFiltre ?? ""}`);

  useTitreDocument("Bons de livraison");

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/bl/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ BL</Link>}>
        Bons de livraison
      </PageTitle>
      <Filtres label="Filtrer les bons de livraison" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />

      {clientFiltre && (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-900">
            Filtré sur {nomClientFiltre ?? "ce client"}. Un bon de livraison au statut « Livré » se
            facture depuis <Link href="/factures" className="font-medium underline">Factures</Link> —
            au coup par coup, ou d&apos;un seul geste avec la facture récapitulative du mois.
          </p>
          <button
            onClick={() => setClientFiltre(null)}
            className="min-h-[44px] text-sm font-medium text-amber-900 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Retirer le filtre
          </button>
        </Card>
      )}

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty>
          {clientFiltre
            ? "Aucun bon de livraison pour ce client avec ce filtre."
            : filtre === "tous"
              ? "Aucun bon de livraison. Créez-en un au moment de rendre les pièces au client."
              : "Aucun bon de livraison avec ce filtre."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((b) => (
            <Link key={b.id} href={`/bl/fiche/${b.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{b.numero ?? "Brouillon"} · {b.clients?.nom}</div>
                  <div className="text-xs text-gray-500">
                    {dateFr(b.created_at)} · {eur(calcTotaux(b.lignes ?? [], b.remise ?? null).total_ttc)} TTC
                    {b.nb_colis ? ` · ${b.nb_colis} colis` : ""}
                  </div>
                </div>
                <Badge tone={STATUS_BL[b.status].ton}>{STATUS_BL[b.status].label}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="bons de livraison" />
    </div>
  );
}
