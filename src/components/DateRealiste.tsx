"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { dateFr } from "@/lib/utils";
import { calculerCharge, dateLivraisonRealiste } from "@/lib/capacite";
import type { AtelierFour, AtelierLot2 } from "@/lib/types";

/**
 * Date de livraison tenable pour ce projet, calculée sur la file d'attente réelle du four.
 * Le projet lui-même est retiré de la file avant le calcul : sinon sa surface serait comptée
 * deux fois et la date proposée reculerait à chaque affichage.
 */
export default function DateRealiste({
  projetId,
  surfaceM2,
  datePromise,
  onChoisir,
}: {
  projetId: string;
  surfaceM2: number | null;
  datePromise: string | null;
  onChoisir: (date: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [proposition, setProposition] = useState<{ date: string; explication: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: projets }] = await Promise.all([
        supabase.from("ateliers").select("four_capacite_m2, four_cycles_jour, four_remplissage_moyen_pct").maybeSingle(),
        supabase.from("projets").select("id, surface_m2, status, date_promise, etape_courante, stock_decremente_at"),
      ]);
      const atelier = a as (AtelierFour & AtelierLot2) | null;
      const charge = calculerCharge(
        (projets ?? []).filter((p) => p.id !== projetId),
        {
          four_capacite_m2: atelier?.four_capacite_m2 ?? null,
          four_cycles_jour: atelier?.four_cycles_jour ?? 0,
          four_remplissage_moyen_pct: atelier?.four_remplissage_moyen_pct ?? 0,
        },
      );
      setProposition(dateLivraisonRealiste(charge, Number(surfaceM2 ?? 0)));
    })();
  }, [projetId, surfaceM2, supabase]);

  if (!proposition) {
    return (
      <p className="text-xs text-gray-500">
        Pour qu&apos;une date de livraison réaliste vous soit proposée, renseignez la capacité du four,
        les cycles par jour et le remplissage moyen dans <Link href="/reglages" className="text-brand underline">Réglages</Link>.
      </p>
    );
  }

  const tenable = !datePromise || datePromise >= proposition.date;

  return (
    <div className={`rounded-lg p-2 text-xs ${tenable ? "bg-gray-50 text-gray-600" : "bg-warning-50 text-warning-dark"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Date tenable au vu du carnet : <b>{dateFr(proposition.date)}</b>
        </span>
        {datePromise !== proposition.date && (
          <button type="button" className="font-medium text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => onChoisir(proposition.date)}>
            Utiliser cette date
          </button>
        )}
      </div>
      <div className="mt-0.5">{proposition.explication}</div>
      {!tenable && (
        <div className="mt-0.5 font-medium">
          La date promise ({dateFr(datePromise)}) passe avant : il faudra doubler des fournées ou décaler un autre chantier.
        </div>
      )}
    </div>
  );
}
