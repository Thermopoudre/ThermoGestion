"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NonConformiteForm from "@/components/NonConformiteForm";
import { Badge, Card, Empty, PageTitle, Spinner } from "@/components/ui";
import { dateFr, eur } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import type { NonConformite } from "@/lib/types";

/**
 * Pareto 80/20 : trie les défauts par fréquence décroissante avec le pourcentage cumulé, pour que
 * l'atelier voie en un coup d'œil les 2-3 causes qui expliquent l'essentiel des reprises — c'est
 * ce qu'un système qualité (et un auditeur) attend en action corrective, pas une simple liste plate.
 */
function ParetoDefauts({ ncs }: { ncs: NonConformite[] }) {
  const counts = new Map<string, number>();
  for (const nc of ncs) counts.set(nc.defaut, (counts.get(nc.defaut) ?? 0) + 1);
  const total = ncs.length;
  const tries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  let cumul = 0;
  return (
    <Card className="flex flex-col gap-2">
      <div className="text-sm font-semibold text-gray-700">Pareto des défauts</div>
      {tries.map(([defaut, n]) => {
        cumul += n;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const cumulPct = total > 0 ? Math.round((cumul / total) * 100) : 0;
        return (
          <div key={defaut}>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{defaut}</span>
              <span>{n} · cumul {cumulPct}%</span>
            </div>
            <div className="mt-0.5 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function NonConformitesContent() {
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [ncs, setNcs] = useState<NonConformite[] | null>(null);
  const [ouvert, setOuvert] = useState(!!params.get("projet_id") || !!params.get("defaut"));

  async function reload() {
    const { data } = await supabase
      .from("non_conformites")
      .select("*, projets(numero, nom)")
      .order("detectee_at", { ascending: false })
      .limit(300);
    setNcs((data as unknown as NonConformite[]) ?? []);
  }
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const coutTotal = (ncs ?? []).reduce((s, nc) => s + (nc.cout_estime ?? 0), 0);

  useTitreDocument("Non-conformités");

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle
        action={
          <button type="button" onClick={() => setOuvert((v) => !v)} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {ouvert ? "Fermer" : "+ Déclarer"}
          </button>
        }
      >
        Non-conformités
      </PageTitle>

      {ncs && ncs.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card><div className="text-2xl font-bold">{ncs.length}</div><div className="text-xs text-gray-500">Non-conformités enregistrées</div></Card>
          <Card><div className="text-2xl font-bold">{eur(coutTotal)}</div><div className="text-xs text-gray-500">Coût estimé cumulé</div></Card>
        </div>
      )}

      {ouvert && (
        <Card>
          <NonConformiteForm
            prefillProjetId={params.get("projet_id") ?? undefined}
            prefillDefaut={params.get("defaut") ?? undefined}
            onSaved={() => { setOuvert(false); reload(); }}
          />
        </Card>
      )}

      {ncs && ncs.length > 0 && <ParetoDefauts ncs={ncs} />}

      <div className="text-sm font-semibold text-gray-700">Historique</div>
      {ncs === null ? (
        <Spinner />
      ) : ncs.length === 0 ? (
        <Empty>Aucune non-conformité déclarée pour l&apos;instant — tant mieux.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {ncs.map((nc) => (
            <Card key={nc.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{nc.defaut}</div>
                {nc.projets?.nom && (
                  <div className="truncate text-xs text-gray-500">{nc.projets.numero ? `${nc.projets.numero} — ` : ""}{nc.projets.nom}</div>
                )}
                <div className="mt-0.5 text-xs text-gray-500">{dateFr(nc.detectee_at)}{nc.cause ? ` · ${nc.cause}` : ""}</div>
                {nc.action_corrective && <div className="mt-1 text-xs text-gray-600">{nc.action_corrective}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                {nc.cout_estime != null && <span className="text-xs font-medium text-gray-700">{eur(nc.cout_estime)}</span>}
                {nc.retouche && <Badge tone="warning">Retouchée</Badge>}
                {nc.rebut && <Badge tone="danger">Rebut</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NonConformitesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NonConformitesContent />
    </Suspense>
  );
}
