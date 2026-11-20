"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FourneeComposer from "@/components/FourneeComposer";
import { Badge, Button, Card, Empty, Input, PageTitle, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { dateFr, nombreFr } from "@/lib/utils";
import { poudreLabel, surfaceTotale, tauxRemplissage } from "@/lib/fournees";
import { useTitreDocument } from "@/lib/titre";
import { STATUS_FOURNEE } from "@/lib/types";
import type { AtelierFour, Fournee, ProjetPretFournee } from "@/lib/types";
import AstuceEcran from "@/components/AstuceEcran";

type FourneeAvecCharge = Fournee & { fournee_projets: { surface_m2: number | null }[] };

// Étapes de workflow à partir desquelles un projet est un candidat à une fournée : poudrage
// (sur le point d'être cuit) ou déjà en cuisson mais pas encore rattaché à une fournée en base
// (cas d'une fournée annulée après coup, par exemple).
const ETAPES_CANDIDATES = ["poudrage", "cuisson"];

export default function FourneesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [atelier, setAtelier] = useState<(AtelierFour & { id: string }) | null>(null);
  const [prets, setPrets] = useState<ProjetPretFournee[] | null>(null);
  const [fournees, setFournees] = useState<FourneeAvecCharge[]>([]);
  // Sans cette liste, la fiche de cuisson — pièce de traçabilité réclamée en audit — devient
  // injoignable dès que la fournée est clôturée : plus aucun écran ne pointait vers /fournees/[id].
  const [terminees, setTerminees] = useState<FourneeAvecCharge[]>([]);
  const [voirHisto, setVoirHisto] = useState(false);
  const [selection, setSelection] = useState<ProjetPretFournee[]>([]);
  const [datePrevue, setDatePrevue] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [{ data: a }, { data: fp }, { data: f }, { data: ft }] = await Promise.all([
      supabase.from("ateliers").select("*").maybeSingle(),
      supabase
        .from("projets")
        .select("id, numero, nom, surface_m2, poudre_id, etape_courante, date_promise, clients(nom), poudres(reference, ral, temp_cuisson, duree_cuisson_min)")
        .in("etape_courante", ETAPES_CANDIDATES)
        .neq("status", "livre")
        .neq("status", "annule")
        .order("date_promise", { ascending: true, nullsFirst: false }),
      supabase
        .from("fournees")
        .select("*, poudres(reference, ral), fournee_projets(surface_m2)")
        .in("statut", ["planifiee", "en_cours"])
        .order("date_prevue", { ascending: true, nullsFirst: false }),
      supabase
        .from("fournees")
        .select("*, poudres(reference, ral), fournee_projets(surface_m2)")
        .in("statut", ["terminee", "annulee"])
        .order("terminee_at", { ascending: false, nullsFirst: false })
        .limit(50),
    ]);
    setAtelier(a as (AtelierFour & { id: string }) | null);
    const actives = (f as unknown as FourneeAvecCharge[]) ?? [];
    setFournees(actives);
    setTerminees((ft as unknown as FourneeAvecCharge[]) ?? []);

    // Un projet déjà rattaché à une fournée planifiée ou en cuisson n'est plus « disponible ».
    const { data: dejaPris } = await supabase.from("fournee_projets").select("projet_id, fournees(statut)");
    const prisIds = new Set(
      (((dejaPris as unknown as { projet_id: string; fournees: { statut: string } | null }[]) ?? []))
        .filter((r) => r.fournees && ["planifiee", "en_cours"].includes(r.fournees.statut))
        .map((r) => r.projet_id)
    );
    setPrets((((fp as unknown as ProjetPretFournee[]) ?? []).filter((p) => !prisIds.has(p.id))));
    setSelection([]);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useTitreDocument("Fournées");

  if (!atelier || !prets) return <Spinner />;

  const disponibles = prets.filter((p) => !selection.some((s) => s.id === p.id));

  async function creerFournee() {
    if (selection.length === 0 || !atelier) return;
    setBusy(true);
    const premiere = selection[0];
    /**
     * Le numéro vient de la base, comme celui d'un devis ou d'un bon de livraison.
     *
     * Il était compté côté navigateur (« F-20260903-1 ») à partir des fournées du jour relues
     * juste avant : deux postes qui lancent une fournée à la même minute lisaient le même total
     * et posaient deux fois le même numéro — la table n'a aucune contrainte d'unicité pour les
     * arrêter. `next_numero()` sérialise le compteur en base, et rend au passage le préfixe que
     * l'atelier a posé dans Réglages → Numérotation.
     */
    const { data: numero, error: errNum } = await supabase.rpc("next_numero", { p_type: "fournee" });
    if (errNum || !numero) { toast(errorFr(errNum), "error"); setBusy(false); return; }
    const { data, error } = await supabase
      .from("fournees")
      .insert({
        atelier_id: atelier.id,
        numero,
        date_prevue: datePrevue || null,
        statut: "planifiee",
        poudre_id: premiere.poudre_id,
        temp_consigne: premiere.poudres?.temp_cuisson ?? null,
        duree_min: premiere.poudres?.duree_cuisson_min ?? null,
      })
      .select("id")
      .single();
    if (error || !data) { toast(errorFr(error), "error"); setBusy(false); return; }
    const rows = selection.map((p, i) => ({ atelier_id: atelier.id, fournee_id: data.id, projet_id: p.id, surface_m2: p.surface_m2, position: i }));
    const { error: err2 } = await supabase.from("fournee_projets").insert(rows);
    if (err2) { toast(errorFr(err2), "error"); setBusy(false); return; }
    router.push(`/fournees/${data.id}`);
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle>Fournées</PageTitle>
      <AstuceEcran cle="fournees" />

      {fournees.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-gray-600">En cours</div>
          {fournees.map((f) => {
            const surface = surfaceTotale(f.fournee_projets.map((x) => ({ surface_m2: x.surface_m2 })));
            const taux = tauxRemplissage(surface, atelier.four_capacite_m2);
            return (
              <Link key={f.id} href={`/fournees/${f.id}`}>
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{f.numero ?? "Fournée"} {f.poudres && <span className="font-normal text-gray-500">· {poudreLabel(f.poudres)}</span>}</div>
                    <Badge tone={STATUS_FOURNEE[f.statut].ton}>{STATUS_FOURNEE[f.statut].label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {f.date_prevue ? `Prévue le ${dateFr(f.date_prevue)}` : "Sans date"} · {f.fournee_projets.length} projet{f.fournee_projets.length > 1 ? "s" : ""}
                    {taux != null && ` · ${taux} % du four`}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <div className="text-sm font-semibold text-gray-600">Prochaine fournée</div>
      {prets.length === 0 ? (
        <Empty>Aucun projet en attente de poudrage ou de cuisson pour l&apos;instant.</Empty>
      ) : (
        <>
          <Input label="Date prévue" type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} />
          <FourneeComposer
            disponibles={disponibles}
            selection={selection}
            capaciteM2={atelier.four_capacite_m2}
            onAdd={(p) => setSelection((s) => [...s, p])}
            onRemove={(p) => setSelection((s) => s.filter((x) => x.id !== p.id))}
          />
          {/* `loading` et non un libellé remplacé par « … » : l'opérateur doit continuer de lire
              sur quoi il vient d'appuyer, sinon il appuie une seconde fois et crée deux fournées. */}
          <Button taille="xl" loading={busy} disabled={selection.length === 0} onClick={creerFournee}>
            {`Créer la fournée (${selection.length} projet${selection.length > 1 ? "s" : ""})`}
          </Button>
        </>
      )}

      {terminees.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setVoirHisto((v) => !v)}
            className="w-fit text-sm font-semibold text-gray-600 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            aria-expanded={voirHisto}
          >
            {voirHisto ? "Masquer les fournées passées" : `Fournées passées (${terminees.length}) — fiches de cuisson`}
          </button>
          {voirHisto && terminees.map((f) => {
            const surface = surfaceTotale(f.fournee_projets.map((x) => ({ surface_m2: x.surface_m2 })));
            return (
              <Link key={f.id} href={`/fournees/${f.id}`}>
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{f.numero ?? "Fournée"} {f.poudres && <span className="font-normal text-gray-500">· {poudreLabel(f.poudres)}</span>}</div>
                    <Badge tone={STATUS_FOURNEE[f.statut].ton}>{STATUS_FOURNEE[f.statut].label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {f.terminee_at ? `Cuite le ${dateFr(f.terminee_at)}` : f.date_prevue ? `Prévue le ${dateFr(f.date_prevue)}` : "Sans date"}
                    {" · "}{f.fournee_projets.length} projet{f.fournee_projets.length > 1 ? "s" : ""}
                    {/* D6 — `surface` porte deux décimales (round2) : « 1.68 m² » en anglo-saxon
                        s'affichait sur cet écran. */}
                    {surface > 0 && ` · ${nombreFr(surface)} m²`}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
