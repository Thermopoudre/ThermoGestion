"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, useListePaginee } from "@/components/Pagination";
import { dateFr } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import { ETAT_RECEPTION } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";

/** Le corps de la réception (photos, signature, réserves détaillées) ne sert qu'à la fiche. */
const COLONNES = "id, numero, created_at, nb_pieces, designation, etat_constate, clients(nom)";
type ReceptionListe = {
  id: string;
  numero: string | null;
  created_at: string;
  nb_pieces: number;
  designation: string | null;
  etat_constate: string;
  clients: { nom: string } | null;
};

/** « Avec réserves » est le filtre que réclame le litige : c'est là que se trouve la preuve. */
const FILTRES = [
  { valeur: "tous", libelle: "Toutes", etats: null },
  { valeur: "reserves", libelle: "Avec réserves", etats: ["rayures", "chocs", "corrosion", "ancien_revetement", "autre"] },
  { valeur: "bon", libelle: "Bon état", etats: ["bon"] },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];

export default function ReceptionsListPage() {
  const supabase = useMemo(() => createClient(), []);
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const charger = useCallback((de: number, a: number) => {
    const etats = FILTRES.find((f) => f.valeur === filtre)?.etats;
    let requete = supabase.from("receptions").select(COLONNES, { count: "exact" });
    if (etats) requete = requete.in("etat_constate", [...etats]);
    return requete.order("created_at", { ascending: false }).range(de, a);
  }, [supabase, filtre]);

  const liste = useListePaginee<ReceptionListe>(charger, filtre);

  useTitreDocument("Réceptions");

  return (
    <div className="flex flex-col gap-3">
      <PageTitle action={<Link href="/receptions/new" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Réception</Link>}>
        Réceptions
      </PageTitle>
      <AstuceEcran cle="receptions" />
      <Filtres label="Filtrer les réceptions" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty>
          {filtre === "tous"
            ? "Aucune réception enregistrée. Créez un bon dès qu'un client dépose des pièces : c'est la preuve de leur état à l'entrée."
            : "Aucune réception avec ce filtre."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((r) => (
            <Link key={r.id} href={`/receptions/${r.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.numero ?? "Sans numéro"} · {r.clients?.nom}</div>
                  <div className="truncate text-xs text-gray-500">
                    {dateFr(r.created_at)} · {r.nb_pieces} pièce{r.nb_pieces > 1 ? "s" : ""}
                    {r.designation ? ` · ${r.designation}` : ""}
                  </div>
                </div>
                <Badge tone={r.etat_constate === "bon" ? "success" : "warning"}>
                  {ETAT_RECEPTION[r.etat_constate]}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="réceptions" />
    </div>
  );
}
