"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BainForm from "@/components/BainForm";
import { Badge, Card, Empty, PageTitle, Select, Spinner } from "@/components/ui";
import { dateFr, libelleBain, nombreFr } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import { verdictLabel, verdictTon } from "@/lib/qualite";
import type { ControleBain } from "@/lib/types";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BainsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [releves, setReleves] = useState<ControleBain[] | null>(null);
  const [filtreBain, setFiltreBain] = useState("");

  async function reload() {
    const { data } = await supabase
      .from("controles_bains")
      .select("*")
      .order("mesure_at", { ascending: false })
      .limit(300);
    setReleves((data as unknown as ControleBain[]) ?? []);
  }
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bains = useMemo(() => Array.from(new Set((releves ?? []).map((r) => r.bain))), [releves]);

  // Dernier relevé de chaque bain : vue d'ensemble pour repérer d'un coup d'œil un bain qui traîne
  // sans contrôle récent ou qui est resté non conforme depuis sa dernière mesure.
  const dernierParBain = useMemo(() => {
    const map = new Map<string, ControleBain>();
    for (const r of releves ?? []) if (!map.has(r.bain)) map.set(r.bain, r);
    return map;
  }, [releves]);

  const aujourdHui = isoDate(new Date());
  const liste = filtreBain ? (releves ?? []).filter((r) => r.bain === filtreBain) : releves;

  useTitreDocument("Bains de prétraitement");

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle>Registre des bains</PageTitle>

      {dernierParBain.size > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...dernierParBain.entries()].map(([bain, r]) => {
            const controleAujourdhui = r.mesure_at.slice(0, 10) === aujourdHui;
            return (
              <Card key={bain} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{libelleBain(bain)}</div>
                  <div className="text-xs text-gray-500">{controleAujourdhui ? "Contrôlé aujourd'hui" : `Dernier contrôle : ${dateFr(r.mesure_at)}`}</div>
                </div>
                <Badge tone={verdictTon(r.conforme)}>{verdictLabel(r.conforme)}</Badge>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <div className="mb-3 text-sm font-semibold text-gray-700">Nouveau relevé</div>
        <BainForm onSaved={reload} />
      </Card>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Historique</div>
        <Select value={filtreBain} onChange={(e) => setFiltreBain(e.target.value)} className="w-auto">
          <option value="">Tous les bains</option>
          {bains.map((b) => <option key={b} value={b}>{libelleBain(b)}</option>)}
        </Select>
      </div>

      {liste === null ? (
        <Spinner />
      ) : liste.length === 0 ? (
        <Empty>Aucun relevé de bain enregistré pour l&apos;instant.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {liste.map((r) => (
            <Card key={r.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{libelleBain(r.bain)}</div>
                <div className="text-sm text-gray-700">
                  {/* D6 — PostgREST rend les `numeric` en chaîne (« 6.80 ») : sans `nombreFr()`,
                      un relevé s'affichait en anglo-saxon au milieu d'un écran français. */}
                  {[
                    r.ph != null ? `pH ${nombreFr(r.ph, 2)}` : null,
                    r.conductivite != null ? `${nombreFr(r.conductivite, 0)} µS/cm` : null,
                    r.temperature != null ? `${nombreFr(r.temperature, 1)} °C` : null,
                    r.titrage != null ? `titrage ${nombreFr(r.titrage, 2)}` : null,
                  ].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {dateFr(r.mesure_at)}{r.renouvele ? " · Bain renouvelé" : ""}
                </div>
                {r.action && <div className="mt-1 text-xs text-gray-600">{r.action}</div>}
              </div>
              <Badge tone={verdictTon(r.conforme)}>{verdictLabel(r.conforme)}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
