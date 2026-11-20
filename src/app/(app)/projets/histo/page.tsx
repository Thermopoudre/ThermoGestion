"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, Tri, useListePaginee } from "@/components/Pagination";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_PROJET, dateFr } from "@/lib/utils";
import AstuceEcran from "@/components/AstuceEcran";

/**
 * L'historique de production.
 *
 * C'est l'écran qu'on ouvre pour répondre à « vous nous avez fait ce portail il y a deux ans, on
 * en veut un identique ». Il était plafonné à 100 lignes, sans filtre ni recherche : au bout de
 * quatre mois de production, l'année précédente n'était plus consultable.
 */
const COLONNES = "id, numero, nom, status, date_livraison, updated_at, surface_m2, clients(nom)";
type ProjetHisto = {
  id: string;
  numero: string | null;
  nom: string;
  status: "livre" | "annule";
  date_livraison: string | null;
  updated_at: string;
  surface_m2: number | string | null;
  clients: { nom: string } | null;
};

const FILTRES = [
  { valeur: "livre", libelle: "Livrés", statuts: ["livre"] },
  { valeur: "annule", libelle: "Annulés", statuts: ["annule"] },
  { valeur: "tous", libelle: "Tous", statuts: ["livre", "annule"] },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];

const TRIS = [
  { valeur: "recent", libelle: "Plus récents", colonne: "updated_at", croissant: false },
  { valeur: "ancien", libelle: "Plus anciens", colonne: "updated_at", croissant: true },
  { valeur: "numero", libelle: "Numéro", colonne: "numero", croissant: false },
] as const;
type TriHisto = (typeof TRIS)[number]["valeur"];

export default function HistoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [filtre, setFiltre] = useState<Filtre>("livre");
  const [tri, setTri] = useState<TriHisto>("recent");

  const charger = useCallback((de: number, a: number) => {
    const statuts = FILTRES.find((f) => f.valeur === filtre)!.statuts;
    const t = TRIS.find((x) => x.valeur === tri)!;
    return supabase
      .from("projets")
      .select(COLONNES, { count: "exact" })
      .in("status", [...statuts])
      .order(t.colonne, { ascending: t.croissant, nullsFirst: false })
      .range(de, a);
  }, [supabase, filtre, tri]);

  const liste = useListePaginee<ProjetHisto>(charger, `${filtre}|${tri}`);

  useTitreDocument("Historique des projets");

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/projets" className="text-sm font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">← Projets en cours</Link>}>
        Projets terminés
      </PageTitle>
      <AstuceEcran cle="projets" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Filtres label="Filtrer l'historique" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />
        <Tri valeur={tri} onChange={setTri} options={TRIS.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
      </div>

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty>Aucun projet terminé avec ce filtre. Un projet passé en « Livré » arrive ici tout seul.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((p) => (
            <Link key={p.id} href={`/projets/${p.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.numero} · {p.clients?.nom}</div>
                  <div className="truncate text-xs text-gray-500">
                    {p.nom}
                    {p.date_livraison ? ` · livré le ${dateFr(p.date_livraison)}` : ""}
                  </div>
                </div>
                <Badge tone={STATUS_PROJET[p.status].ton}>{STATUS_PROJET[p.status].label}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="projets" />
    </div>
  );
}
