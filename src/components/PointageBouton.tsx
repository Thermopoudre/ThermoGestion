"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { Badge, Button, Card, Select } from "@/components/ui";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import type { PoudreLot } from "@/lib/types";
import { useSeuilDlu } from "@/components/AlertesProvider";
import { joursAvantDlu } from "@/lib/alertes";

function dureeFr(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

type ProjetLeger = {
  id: string;
  atelier_id: string;
  poudre_id: string | null;
  poudre_conso_kg: number | null;
  lot_id: string | null;
};

type LotAvecPoudre = PoudreLot & { poudres?: { reference: string; ral: string | null } | null };
/**
 * `cout_main_oeuvre` est `null` pour l'opérateur : le taux horaire vit dans `ateliers_couts`, que
 * la vue `projet_temps_cout` ne peut plus joindre pour lui. On affiche alors le temps seul — le
 * temps est son travail, le prix de son travail ne le regarde pas. On ne montre surtout pas
 * « 0,00 € », qui se lirait comme du travail gratuit.
 */
type TempsCout = { minutes_totales: number; cout_main_oeuvre: number | null };

/**
 * Complète la fiche projet sans dupliquer le chronométrage automatique déjà en place
 * (`avancer_etape` + `pointer_etape` sur `temps_etapes`, affiché dans la carte « Temps passé »
 * de la fiche projet) : ce composant ajoute seulement ce qui manquait à ce système —
 * le coût de main d'œuvre qui en découle (vue `projet_temps_cout`) et le rattachement du lot
 * de poudre réellement appliqué (`projets.lot_id`), avec décompte du kg restant du lot.
 */
export default function PointageBouton({ projetId }: { projetId: string }) {
  // Réglage d'atelier, plus une constante recopiée : voir src/lib/alertes.ts.
  const SEUIL_DLU_JOURS = useSeuilDlu();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [projet, setProjet] = useState<ProjetLeger | null>(null);
  const [lots, setLots] = useState<LotAvecPoudre[]>([]);
  const [tempsCout, setTempsCout] = useState<TempsCout | null>(null);
  const [lotChoisi, setLotChoisi] = useState("");
  const [corriger, setCorriger] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data: p } = await supabase
      .from("projets")
      .select("id, atelier_id, poudre_id, poudre_conso_kg, lot_id")
      .eq("id", projetId)
      .single();
    const proj = p as ProjetLeger | null;
    setProjet(proj);

    if (proj?.poudre_id) {
      // Tri par DLU croissante : le lot qui périme le plus tôt doit être proposé en premier,
      // c'est celui que l'atelier doit écouler.
      const { data: l } = await supabase
        .from("poudre_lots")
        .select("*, poudres(reference, ral)")
        .eq("poudre_id", proj.poudre_id)
        .order("dlu", { ascending: true, nullsFirst: false })
        .order("recu_le", { ascending: true, nullsFirst: false });
      setLots((l as unknown as LotAvecPoudre[]) ?? []);
    } else setLots([]);

    const { data: tc } = await supabase
      .from("projet_temps_cout")
      .select("minutes_totales, cout_main_oeuvre")
      .eq("projet_id", projetId)
      .maybeSingle();
    setTempsCout(tc as TempsCout | null);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projetId]);

  if (!projet) return null;

  // Le décompte du lot est fait automatiquement par la RPC `avancer_etape` à la validation de la
  // cuisson (FIFO, ou lot déjà rattaché au projet). Ce formulaire ne sert plus qu'à deux cas :
  // désigner à l'avance le lot que l'opérateur va appliquer, et corriger après coup s'il s'est
  // trompé de seau — auquel cas on rend les kg au lot initial avant de les prendre au nouveau.
  async function confirmerLot() {
    if (!lotChoisi) return;
    setBusy(true);
    const conso = Number(projet!.poudre_conso_kg ?? 0);
    const ancien = projet!.lot_id ? lots.find((l) => l.id === projet!.lot_id) : null;
    if (conso > 0 && ancien && ancien.id !== lotChoisi) {
      const { error: errRendu } = await supabase
        .from("poudre_lots")
        .update({ restant_kg: Number(ancien.restant_kg) + conso })
        .eq("id", ancien.id);
      if (errRendu) { toast(errorFr(errRendu), "error"); setBusy(false); return; }
    }
    const lot = lots.find((l) => l.id === lotChoisi);
    if (conso > 0 && lot && lot.id !== projet!.lot_id) {
      const restant = Math.max(0, Number(lot.restant_kg) - conso);
      const { error: errLot } = await supabase.from("poudre_lots").update({ restant_kg: restant }).eq("id", lot.id);
      if (errLot) { toast(errorFr(errLot), "error"); setBusy(false); return; }
    }
    const { error: errProj } = await supabase.from("projets").update({ lot_id: lotChoisi }).eq("id", projetId);
    if (errProj) toast(errorFr(errProj), "error");
    else { toast(ancien ? "Lot corrigé" : "Lot rattaché au projet"); setCorriger(false); await reload(); }
    setBusy(false);
  }

  const lotConfirme = projet.lot_id ? lots.find((l) => l.id === projet.lot_id) : null;
  const jLot = lotConfirme?.dlu ? joursAvantDlu(lotConfirme.dlu) : null;

  return (
    <>
      {tempsCout && tempsCout.minutes_totales > 0 && (
        <Card className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            {tempsCout.cout_main_oeuvre != null ? "Coût main d\u2019œuvre" : "Temps passé"}
          </div>
          <div className="text-right text-sm">
            {tempsCout.cout_main_oeuvre != null && (
              <div className="font-medium">{eur(tempsCout.cout_main_oeuvre)}</div>
            )}
            <div className={tempsCout.cout_main_oeuvre != null ? "text-xs text-gray-500" : "font-medium"}>
              {dureeFr(tempsCout.minutes_totales)} pointées
            </div>
          </div>
        </Card>
      )}

      {projet.poudre_id && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Lot de poudre utilisé</div>
          {lotConfirme && !corriger ? (
            <>
              <Link href={`/lots/${lotConfirme.id}`} className="flex items-center justify-between rounded-lg border border-gray-200 p-2 text-sm">
                <span>Lot {lotConfirme.numero}{lotConfirme.fournisseur ? ` · ${lotConfirme.fournisseur}` : ""}</span>
                {jLot != null && jLot < 0 ? (
                  <Badge tone="danger">Périmé</Badge>
                ) : jLot != null && jLot <= SEUIL_DLU_JOURS ? (
                  <Badge tone="warning">DLU {jLot} j</Badge>
                ) : (
                  <Badge tone="neutral">Voir la fiche →</Badge>
                )}
              </Link>
              {projet.poudre_conso_kg && (
                <p className="text-xs text-gray-500">
                  {nombreFr(projet.poudre_conso_kg, 3)} kg décomptés de ce lot à la validation de la cuisson.
                </p>
              )}
              {lots.length > 1 && (
                <button
                  type="button"
                  className="self-start rounded px-1 py-1 text-xs font-medium text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={() => { setLotChoisi(lotConfirme.id); setCorriger(true); }}
                >
                  Ce n&apos;est pas le bon lot ? Corriger
                </button>
              )}
            </>
          ) : lots.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun lot réceptionné pour cette poudre : saisissez-en un depuis la fiche stock.</p>
          ) : (
            <>
              <Select value={lotChoisi} onChange={(e) => setLotChoisi(e.target.value)}>
                <option value="">— Choisir le lot appliqué —</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    Lot {l.numero}{l.fournisseur ? ` · ${l.fournisseur}` : ""} · {nombreFr(l.restant_kg, 1)} kg restants
                    {l.dlu ? ` · DLU ${dateFr(l.dlu)}` : ""}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={confirmerLot} loading={busy} disabled={!lotChoisi}>
                  {corriger ? "Corriger le lot" : "Confirmer ce lot"}
                </Button>
                {corriger && <Button variant="ghost" onClick={() => setCorriger(false)} disabled={busy}>Annuler</Button>}
              </div>
              <p className="text-xs text-gray-500">
                {projet.poudre_conso_kg
                  ? "Corriger le lot rend les kg au lot initial et les prend sur le nouveau."
                  : "Facultatif : à la validation de la cuisson, le lot le plus proche de sa DLU est décompté automatiquement. Désignez-en un ici si vous savez déjà quel seau sera ouvert."}
              </p>
            </>
          )}
        </Card>
      )}
    </>
  );
}
