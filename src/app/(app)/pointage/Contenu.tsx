"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Check, CheckCircle2, Play, Square, Timer } from "lucide-react";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { cn, nombreFr } from "@/lib/utils";
import type { Etape, Projet } from "@/lib/types";

/**
 * Chronométrage partagé — plusieurs pièces sur un même poste.
 *
 * Au sablage, la cabine ne traite pas une pièce à la fois : trois ou quatre projets y passent
 * ensemble et l'opérateur relève **un temps global**. Jusqu'ici il n'avait le choix qu'entre
 * imputer tout le temps à un seul projet ou ne rien pointer du tout — les deux faussent le prix de
 * revient, et la seconde option est celle que choisit un atelier pressé.
 *
 * Le temps relevé est réparti au prorata des dimensions du projet (`surface_m2`, qui porte déjà
 * l'équivalent développé des pièces chiffrées au mètre linéaire), exactement comme `projet_revient`
 * répartit le kWh d'une fournée. Si une seule pièce du lot n'a pas de surface renseignée, la
 * répartition bascule à parts égales : on préfère une part franche à un prorata qui ferait porter
 * tout le temps aux seules pièces mesurées.
 */

type ProjetEnCours = Projet & { surface_m2: number | null };

type LigneOuverte = {
  groupe_id: string;
  etape_code: string;
  debut: string;
  projets: { id: string; numero: string | null; nom: string; surface_m2: number | null }[];
};

type Repartition = {
  minutes_lot: number;
  prorata: boolean;
  projets: { projet_id: string; minutes: number; part_pct: number; surface_m2: number }[];
};

function dureeFr(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export default function PointageLotPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [projets, setProjets] = useState<ProjetEnCours[] | null>(null);
  const [ouverts, setOuverts] = useState<LigneOuverte[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [etape, setEtape] = useState("");
  const [busy, setBusy] = useState(false);
  const [minutesManuelles, setMinutesManuelles] = useState<Record<string, string>>({});
  const [dernier, setDernier] = useState<Repartition | null>(null);
  // Réaffiché après l'arrêt : sans le nom du projet, la répartition n'explique rien.
  const [nomsProjets, setNomsProjets] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const [{ data: prs }, { data: temps }] = await Promise.all([
      supabase
        .from("projets")
        .select("*, clients(nom)")
        .in("status", ["en_attente", "en_cours", "pret"])
        .order("date_promise", { ascending: true, nullsFirst: false }),
      supabase.from("temps_etapes").select("*, projets(id, numero, nom, surface_m2)").is("fin", null).not("groupe_id", "is", null),
    ]);
    const liste = (prs as unknown as ProjetEnCours[]) ?? [];
    setProjets(liste);
    setNomsProjets(Object.fromEntries(liste.map((p) => [p.id, `${p.numero ? `${p.numero} — ` : ""}${p.nom}`])));

    const groupes = new Map<string, LigneOuverte>();
    for (const t of (temps as unknown as { groupe_id: string; etape_code: string; debut: string; projets: LigneOuverte["projets"][number] }[]) ?? []) {
      const g = groupes.get(t.groupe_id) ?? { groupe_id: t.groupe_id, etape_code: t.etape_code, debut: t.debut, projets: [] };
      if (t.projets) g.projets.push(t.projets);
      if (t.debut < g.debut) g.debut = t.debut;
      groupes.set(t.groupe_id, g);
    }
    setOuverts([...groupes.values()]);
  }, [supabase]);

  useEffect(() => { reload(); }, [reload]);

  // Postes proposés : ceux du workflow réel de l'atelier, jamais une liste codée en dur.
  const etapesDisponibles = useMemo(() => {
    const vues = new Map<string, string>();
    for (const p of projets ?? []) {
      for (const e of (p.etapes as Etape[]) ?? []) if (!vues.has(e.code)) vues.set(e.code, e.libelle);
    }
    return [...vues.entries()];
  }, [projets]);

  useEffect(() => {
    if (!etape && etapesDisponibles.length > 0) {
      // Le sablage est le cas d'usage type : on le propose s'il existe.
      setEtape(etapesDisponibles.find(([code]) => code === "preparation")?.[0] ?? etapesDisponibles[0][0]);
    }
  }, [etape, etapesDisponibles]);

  useTitreDocument("Pointage");

  if (!projets) return <Spinner />;

  const selectionnes = projets.filter((p) => selection.includes(p.id));
  const surfaceTotale = selectionnes.reduce((s, p) => s + Number(p.surface_m2 ?? 0), 0);
  const prorataPossible = selectionnes.length > 0 && selectionnes.every((p) => Number(p.surface_m2 ?? 0) > 0);

  async function demarrer() {
    setBusy(true);
    const { error } = await supabase.rpc("demarrer_pointage_lot", { p_projets: selection, p_etape: etape });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    toast(`Chronométrage démarré sur ${selection.length} projets`);
    setSelection([]);
    setDernier(null);
    await reload();
  }

  async function arreter(g: LigneOuverte) {
    setBusy(true);
    const saisi = (minutesManuelles[g.groupe_id] ?? "").trim();
    const { data, error } = await supabase.rpc("arreter_pointage_lot", {
      p_groupe: g.groupe_id,
      p_minutes: saisi === "" ? null : Math.max(0, Math.round(Number(saisi))),
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setDernier(data as Repartition);
    toast("Temps réparti entre les projets du lot");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Link href="/projets" className="text-sm text-brand underline">Atelier</Link>}>Poste partagé</PageTitle>

      <p className="-mt-2 text-sm text-gray-600">
        Plusieurs pièces passent ensemble sur le même poste ? Démarrez le chronomètre sur toutes en
        même temps, arrêtez-le d&apos;un coup : le temps relevé est réparti entre les projets au
        prorata de leur surface, et alimente leur prix de revient comme un temps normal.
      </p>

      {ouverts.map((g) => {
        const minutesEcoulees = (Date.now() - new Date(g.debut).getTime()) / 60000;
        return (
          <Card key={g.groupe_id} className="flex flex-col gap-3 border-brand/40 bg-brand-light">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Timer size={16} aria-hidden />
                {etapesDisponibles.find(([c]) => c === g.etape_code)?.[1] ?? g.etape_code} — {g.projets.length} pièces
              </div>
              {/* Seul badge sans ton : il est posé SUR le bandeau de marque, où les cinq tons
                  disparaîtraient. Blanc sur brand-dark = 6,80:1, au-dessus des 4,5:1 AA. */}
              <Badge className="bg-white text-brand-dark">{dureeFr(minutesEcoulees)}</Badge>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {g.projets.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <Link href={`/projets/${p.id}`} className="underline">{p.numero ?? p.nom}</Link>
                  <span className="text-gray-600">{p.surface_m2 != null ? `${nombreFr(p.surface_m2)} m²` : "surface non renseignée"}</span>
                </li>
              ))}
            </ul>
            <Input
              label="Temps relevé pour le lot (min) — laissez vide pour prendre le temps écoulé"
              type="number"
              min="0"
              placeholder={String(Math.round(minutesEcoulees))}
              value={minutesManuelles[g.groupe_id] ?? ""}
              onChange={(e) => setMinutesManuelles((m) => ({ ...m, [g.groupe_id]: e.target.value }))}
            />
            <Button taille="xl" loading={busy} onClick={() => arreter(g)} className="flex items-center justify-center gap-2">
              <Square size={18} aria-hidden /> Arrêter et répartir
            </Button>
          </Card>
        );
      })}

      {dernier && (
        <Card className="flex flex-col gap-2 border-success-200 bg-success-50">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-success-dark">
            <CheckCircle2 size={16} aria-hidden /> Répartition appliquée
          </div>
          <p className="text-xs text-success-dark">
            {dureeFr(dernier.minutes_lot)} relevés pour le lot,{" "}
            {dernier.prorata
              ? "répartis au prorata des surfaces."
              : "répartis à parts égales : au moins une pièce du lot n'a pas de surface renseignée."}
          </p>
          <ul className="flex flex-col gap-1 text-sm text-success-dark">
            {dernier.projets.map((p) => (
              <li key={p.projet_id} className="flex justify-between">
                <span>{nomsProjets[p.projet_id] ?? p.projet_id.slice(0, 8)}</span>
                <span className="font-medium">
                  {dureeFr(p.minutes)} · {nombreFr(p.part_pct)} %{p.surface_m2 > 0 ? ` · ${nombreFr(p.surface_m2)} m²` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <div className="text-sm font-semibold">Démarrer un lot</div>
        <Select label="Poste" value={etape} onChange={(e) => setEtape(e.target.value)}>
          {etapesDisponibles.map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
        </Select>

        {projets.length === 0 ? (
          <Empty>Aucun projet en production.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {projets.map((p) => {
              const coche = selection.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  // `aria-pressed` : la ligne est un interrupteur, pas un lien. Sans lui, un
                  // lecteur d'écran annonce « bouton P-2026-0031 » aussi bien coché que décoché,
                  // et la seule marque visuelle était un « ✓ » collé au numéro.
                  aria-pressed={coche}
                  onClick={() => setSelection((s) => (coche ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={cn(
                    "flex min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    coche ? "border-brand bg-brand-light ring-1 ring-brand" : "border-gray-300 bg-white",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-5 w-5 flex-none items-center justify-center rounded border",
                        coche ? "border-brand bg-brand text-white" : "border-gray-300 bg-white",
                      )}
                    >
                      {coche && <Check size={14} />}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{p.numero ?? "Projet"}</span>
                      <span className="ml-2 text-xs text-gray-600">{p.clients?.nom} · {p.nom}</span>
                    </span>
                  </span>
                  <span className={cn("text-xs", p.surface_m2 == null ? "font-medium text-amber-700" : "text-gray-500")}>
                    {p.surface_m2 != null ? `${nombreFr(p.surface_m2)} m²` : "sans surface"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selectionnes.length > 0 && (
          <p className="text-xs text-gray-600">
            {selectionnes.length} pièce{selectionnes.length > 1 ? "s" : ""} ·{" "}
            {prorataPossible
              ? `${nombreFr(surfaceTotale)} m² au total, répartition au prorata des surfaces.`
              : "au moins une pièce sans surface renseignée : la répartition se fera à parts égales."}
          </p>
        )}

        {/* Le libellé affichait littéralement « Démarrer sur … projets » quand rien n'était
            sélectionné : le « … » était un `||` de repli sur 0, pas une attente. Il dit maintenant
            ce qu'il faut faire, puis ce qu'il va faire. */}
        <Button
          taille="xl"
          className="flex items-center justify-center gap-2"
          loading={busy}
          disabled={selection.length < 2 || !etape}
          onClick={demarrer}
        >
          <Play size={18} aria-hidden />
          {selection.length < 2
            ? "Sélectionnez au moins deux pièces"
            : `Démarrer sur ${selection.length} projets`}
        </Button>
        {selection.length === 1 && (
          <p className="text-xs text-amber-700">
            Un seul projet ne fait pas un poste partagé : chronométrez-le depuis sa fiche ou son QR.
          </p>
        )}
      </Card>
    </div>
  );
}
