"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Card, PageTitle, Spinner } from "@/components/ui";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import type { PoudreLot } from "@/lib/types";
import { useSeuilDlu } from "@/components/AlertesProvider";
import { joursAvantDlu } from "@/lib/alertes";

type LotAvecPoudre = PoudreLot & { poudres: { reference: string; ral: string | null; marque: string | null } | null };
type ProjetLie = { id: string; numero: string | null; nom: string; date_livraison: string | null; created_at: string; clients: { nom: string } | null };

// Ce chaînage lot → projets est ce qu'exigent les labels qualité en cas de réclamation :
// prouver quel lot de poudre a été appliqué sur quelle pièce.
export default function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Réglage d'atelier, plus une constante recopiée : voir src/lib/alertes.ts.
  const SEUIL_DLU_JOURS = useSeuilDlu();
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [lot, setLot] = useState<LotAvecPoudre | null>(null);
  const [projets, setProjets] = useState<ProjetLie[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("poudre_lots").select("*, poudres(reference, ral, marque), poudre_lot_couts(prix_kg)").eq("id", id).single(),
        supabase.from("projets").select("id, numero, nom, date_livraison, created_at, clients(nom)").eq("lot_id", id).order("created_at", { ascending: false }),
      ]);
      setLot(l as unknown as LotAvecPoudre);
      setProjets((p as unknown as ProjetLie[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!lot) return <Spinner />;

  const j = lot.dlu ? joursAvantDlu(lot.dlu) : null;
  const valeurRestante = Number(lot.restant_kg) * Number(lot.poudre_lot_couts?.prix_kg ?? 0);
  const risque = j != null && j <= SEUIL_DLU_JOURS;

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle>Lot {lot.numero}</PageTitle>
      <div className="text-sm text-gray-600">
        <Link href={`/stock/${lot.poudre_id}`} className="text-brand underline">
          {lot.poudres?.reference ?? "Poudre"}{lot.poudres?.ral ? ` · RAL ${lot.poudres.ral}` : ""}
        </Link>
      </div>

      <Card className={j != null && j < 0 ? "border-red-300 bg-red-50" : risque ? "border-amber-300 bg-amber-50" : ""}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-gray-500">Fournisseur</div><div className="font-medium">{lot.fournisseur ?? "—"}</div></div>
          <div><div className="text-xs text-gray-500">Reçu le</div><div className="font-medium">{dateFr(lot.recu_le)}</div></div>
          <div><div className="text-xs text-gray-500">Quantité reçue</div><div className="font-medium">{nombreFr(lot.quantite_kg, 2)} kg</div></div>
          <div><div className="text-xs text-gray-500">Restant</div><div className="font-medium">{nombreFr(lot.restant_kg, 2)} kg</div></div>
          <div><div className="text-xs text-gray-500">Prix</div><div className="font-medium">{lot.poudre_lot_couts?.prix_kg != null ? `${eur(lot.poudre_lot_couts.prix_kg)}/kg` : "—"}</div></div>
          <div><div className="text-xs text-gray-500">Valeur restante</div><div className="font-medium">{eur(valeurRestante)}</div></div>
        </div>
        {lot.dlu && (
          <div className="mt-3">
            <Badge tone={j! < 0 ? "danger" : j! <= SEUIL_DLU_JOURS ? "warning" : "success"}>
              {j! < 0 ? `Périmé depuis le ${dateFr(lot.dlu)}` : j! <= SEUIL_DLU_JOURS ? `DLU dans ${j} j (${dateFr(lot.dlu)})` : `DLU ${dateFr(lot.dlu)}`}
            </Badge>
          </div>
        )}
        {risque && Number(lot.restant_kg) > 0.001 && (
          <p className="mt-2 text-xs font-medium text-red-700">{eur(valeurRestante)} de poudre à écouler ou à jeter en priorité.</p>
        )}
      </Card>

      <Card>
        <div className="mb-2 text-sm font-semibold">Projets ayant utilisé ce lot</div>
        {projets.length === 0 && (
          <p className="text-xs text-gray-500">Aucun projet rattaché pour l&apos;instant. Le rattachement se fait sur la fiche projet, une fois la cuisson validée.</p>
        )}
        {projets.map((p) => (
          <Link key={p.id} href={`/projets/${p.id}`} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0">
            <span>{p.numero ?? p.nom}{p.clients?.nom ? <span className="text-gray-500"> · {p.clients.nom}</span> : null}</span>
            <span className="text-xs text-gray-500">{dateFr(p.date_livraison ?? p.created_at)}</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
