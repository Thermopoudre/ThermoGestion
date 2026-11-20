"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { Filtres, Pagination, Tri, useListePaginee } from "@/components/Pagination";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import type { PoudreLot } from "@/lib/types";
import { useSeuilDlu } from "@/components/AlertesProvider";
import { dansNJours, joursAvantDlu } from "@/lib/alertes";

/**
 * `poudre_lot_couts` est le prix d'achat, sorti de `poudre_lots` : la table satellite est fermée
 * au rôle atelier, et l'embed rend simplement `null` à qui n'y a pas droit.
 */
const COLONNES =
  "id, numero, fournisseur, quantite_kg, restant_kg, dlu, recu_le, poudre_id, poudres(reference, ral, marque), poudre_lot_couts(prix_kg)";
type LotAvecPoudre = PoudreLot & { poudres: { reference: string; ral: string | null; marque: string | null } | null };

const FILTRES = [
  { valeur: "utiles", libelle: "En stock" },
  { valeur: "risque", libelle: "DLU à surveiller" },
  { valeur: "tous", libelle: "Tous" },
] as const;
type Filtre = (typeof FILTRES)[number]["valeur"];

const TRIS = [
  { valeur: "dlu", libelle: "DLU la plus proche", colonne: "dlu", croissant: true },
  { valeur: "recent", libelle: "Réception récente", colonne: "recu_le", croissant: false },
] as const;
type TriLots = (typeof TRIS)[number]["valeur"];



export default function LotsPage() {
  // Réglage d'atelier, plus une constante recopiée : voir src/lib/alertes.ts.
  const SEUIL_DLU_JOURS = useSeuilDlu();
  const supabase = useMemo(() => createClient(), []);
  const [filtre, setFiltre] = useState<Filtre>("utiles");
  const [tri, setTri] = useState<TriLots>("dlu");
  const [risque, setRisque] = useState<{ perimes: number; bientot: number; valeur: number } | null>(null);

  const charger = useCallback((de: number, a: number) => {
    const t = TRIS.find((x) => x.valeur === tri)!;
    let requete = supabase.from("poudre_lots").select(COLONNES, { count: "exact" });
    if (filtre !== "tous") requete = requete.gt("restant_kg", 0.001);
    // Le seuil de DLU est une borne de date envoyée à la base : c'est le seul filtre qui ait un
    // sens sur une liste paginée — le calculer dans le navigateur ne verrait que la page affichée.
    if (filtre === "risque") requete = requete.not("dlu", "is", null).lte("dlu", dansNJours(SEUIL_DLU_JOURS));
    return requete.order(t.colonne, { ascending: t.croissant, nullsFirst: false }).range(de, a);
  }, [supabase, filtre, tri, SEUIL_DLU_JOURS]);

  const liste = useListePaginee<LotAvecPoudre>(charger, `${filtre}|${tri}|${SEUIL_DLU_JOURS}`);

  /**
   * Le bandeau « stock à risque » est un total sur tout l'atelier, pas sur la page affichée : il
   * a donc sa propre requête, bornée aux seuls lots concernés (restant > 0 et DLU sous deux mois).
   * C'est quelques dizaines de lignes, jamais l'historique complet des lots.
   */
  useEffect(() => {
    let annule = false;
    supabase
      .from("poudre_lots")
      .select("restant_kg, dlu, poudre_lot_couts(prix_kg)")
      .gt("restant_kg", 0.001)
      .not("dlu", "is", null)
      .lte("dlu", dansNJours(SEUIL_DLU_JOURS))
      .limit(500)
      .then(({ data }) => {
        if (annule) return;
        const lignes = (data ?? []) as unknown as { restant_kg: number | string; dlu: string; poudre_lot_couts: { prix_kg: number | null } | null }[];
        setRisque({
          perimes: lignes.filter((l) => joursAvantDlu(l.dlu) < 0).length,
          bientot: lignes.filter((l) => joursAvantDlu(l.dlu) >= 0).length,
          valeur: lignes.reduce((s, l) => s + Number(l.restant_kg) * Number(l.poudre_lot_couts?.prix_kg ?? 0), 0),
        });
      });
    return () => { annule = true; };
  }, [supabase, SEUIL_DLU_JOURS]);

  return (
    <div className="flex flex-col gap-3">
      <PageTitle>Lots de poudre</PageTitle>

      {risque && (risque.perimes > 0 || risque.bientot > 0) && (
        <Card className={risque.perimes > 0 ? "border-danger-200 bg-danger-50" : "border-warning-200 bg-warning-50"}>
          <div className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${risque.perimes > 0 ? "text-danger-dark" : "text-warning-dark"}`}>
            <Hourglass size={16} aria-hidden /> Dates limites d&apos;utilisation
          </div>
          <ul className="text-sm text-gray-700">
            {risque.perimes > 0 && <li>{risque.perimes} lot{risque.perimes > 1 ? "s" : ""} périmé{risque.perimes > 1 ? "s" : ""} — le rendu n&apos;est plus garanti.</li>}
            {risque.bientot > 0 && <li>{risque.bientot} lot{risque.bientot > 1 ? "s" : ""} à écouler sous {SEUIL_DLU_JOURS} jours.</li>}
          </ul>
          <div className="mt-1 text-sm font-semibold">
            Stock à risque : {eur(risque.valeur)} — cette poudre finira à la benne si elle n&apos;est pas utilisée à temps.
          </div>
          <button
            type="button"
            onClick={() => setFiltre("risque")}
            className="mt-1 min-h-[44px] text-sm font-medium underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Voir ces lots →
          </button>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Filtres label="Filtrer les lots" valeur={filtre} onChange={setFiltre} options={FILTRES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))} />
        <Tri valeur={tri} onChange={setTri} options={TRIS.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))} />
      </div>

      {liste.erreur && <Card className="border-danger bg-danger-light text-sm text-danger-dark">{liste.erreur}</Card>}
      {!liste.lignes ? (
        <Spinner />
      ) : liste.lignes.length === 0 ? (
        <Empty>
          {filtre === "risque"
            ? "Aucun lot dont la DLU approche. C'est la bonne nouvelle du jour."
            : "Aucun lot pour l'instant. Les lots se créent à la réception, depuis la fiche d'une poudre."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {liste.lignes.map((l) => {
            const j = l.dlu ? joursAvantDlu(l.dlu) : null;
            const epuise = Number(l.restant_kg) <= 0.001;
            return (
              <Link key={l.id} href={`/lots/${l.id}`}>
                <Card className={`flex items-center justify-between gap-3 ${!epuise && j != null && j < 0 ? "border-red-300" : !epuise && j != null && j <= SEUIL_DLU_JOURS ? "border-amber-300" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {l.poudres?.reference ?? "—"} {l.poudres?.ral && <span className="text-gray-500">· RAL {l.poudres.ral}</span>}
                    </div>
                    <div className="text-xs text-gray-500">Lot {l.numero}{l.fournisseur ? ` · ${l.fournisseur}` : ""} · reçu le {dateFr(l.recu_le)}</div>
                    {j != null && !epuise && (
                      <div className={`text-xs font-medium ${j < 0 ? "text-red-600" : j <= SEUIL_DLU_JOURS ? "text-amber-700" : "text-gray-400"}`}>
                        {j < 0 ? `DLU dépassée le ${dateFr(l.dlu)}` : j <= SEUIL_DLU_JOURS ? `DLU dans ${j} j` : `DLU ${dateFr(l.dlu)}`}
                      </div>
                    )}
                  </div>
                  {epuise ? (
                    <Badge tone="neutral">Épuisé</Badge>
                  ) : (
                    /* Décimales fixées des deux côtés de la barre : sans ça, « 6,8 / 25 kg » lit
                       comme deux unités. Voir `nombreFr()`. */
                    <Badge tone="neutral">{nombreFr(l.restant_kg, 1, 1)} / {nombreFr(l.quantite_kg, 1, 1)} kg</Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <Pagination liste={liste} nomPluriel="lots" />
    </div>
  );
}
