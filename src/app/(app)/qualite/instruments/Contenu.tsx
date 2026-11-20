"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner } from "@/components/ui";
import { errorFr } from "@/lib/errors";
import { dateFr } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import { INSTRUMENT_TYPE_LABEL, STATUT_ETALONNAGE_LABEL, STATUT_ETALONNAGE_TON, etalonnageInfo } from "@/lib/qualite";
import type { Instrument } from "@/lib/types";

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InstrumentsPage() {
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [atelierId, setAtelierId] = useState("");
  const [instruments, setInstruments] = useState<Instrument[] | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [dernierEtalonnage, setDernierEtalonnage] = useState("");
  const [periodiciteMois, setPeriodiciteMois] = useState("12");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    const [{ data: membre }, { data: instr }] = await Promise.all([
      supabase.from("users").select("atelier_id").single(),
      supabase.from("instruments").select("*").order("nom"),
    ]);
    if (membre) setAtelierId(membre.atelier_id);
    setInstruments((instr as Instrument[]) ?? []);
  }
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function creer() {
    if (!nom.trim()) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("instruments").insert({
      atelier_id: atelierId,
      nom: nom.trim(),
      type: type || null,
      numero_serie: numeroSerie.trim() || null,
      dernier_etalonnage: dernierEtalonnage || null,
      periodicite_mois: Number(periodiciteMois) || 12,
    });
    if (err) { setError(errorFr(err)); setSaving(false); return; }
    toast("Instrument ajouté");
    setNom(""); setType(""); setNumeroSerie(""); setDernierEtalonnage(""); setPeriodiciteMois("12");
    setOuvert(false);
    await reload();
    setSaving(false);
  }

  async function marquerEtalonneAujourdhui(instrument: Instrument) {
    const { error: err } = await supabase.from("instruments").update({ dernier_etalonnage: isoDate(new Date()) }).eq("id", instrument.id);
    if (err) { toast(errorFr(err), "error"); return; }
    toast(`${instrument.nom} étalonné aujourd'hui`);
    await reload();
  }

  async function toggleActif(instrument: Instrument) {
    const { error: err } = await supabase.from("instruments").update({ actif: !instrument.actif }).eq("id", instrument.id);
    if (err) { toast(errorFr(err), "error"); return; }
    await reload();
  }

  useTitreDocument("Instruments de mesure");

  if (instruments === null) return <Spinner />;

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Button onClick={() => setOuvert((v) => !v)}>{ouvert ? "Fermer" : "+ Instrument"}</Button>}>
        Instruments &amp; étalonnage
      </PageTitle>
      <p className="-mt-2 text-sm text-gray-600">
        Un instrument non étalonné à temps invalide potentiellement toutes les mesures prises avec —
        c&apos;est le premier point vérifié à l&apos;audit.
      </p>

      {ouvert && (
        <Card className="flex flex-col gap-3">
          <Input label="Nom *" placeholder="ex : Sonde Elcometer 456" value={nom} onChange={(e) => setNom(e.target.value)} />
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">— Non catégorisé —</option>
            {Object.entries(INSTRUMENT_TYPE_LABEL).map(([code, lib]) => <option key={code} value={code}>{lib}</option>)}
          </Select>
          <Input label="Numéro de série" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Dernier étalonnage" type="date" value={dernierEtalonnage} onChange={(e) => setDernierEtalonnage(e.target.value)} />
            <Input label="Périodicité (mois)" type="number" min="1" inputMode="numeric" value={periodiciteMois} onChange={(e) => setPeriodiciteMois(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button disabled={saving || !nom.trim()} onClick={creer}>{saving ? "…" : "Ajouter l'instrument"}</Button>
        </Card>
      )}

      {instruments.length === 0 ? (
        <Empty>Aucun instrument enregistré. Ajoutez au moins votre sonde d&apos;épaisseur et votre grille de quadrillage.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {instruments.map((i) => {
            const info = etalonnageInfo(i.dernier_etalonnage, i.periodicite_mois);
            return (
              <Card key={i.id} className={!i.actif ? "opacity-60" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{i.nom}</div>
                    <div className="text-xs text-gray-500">
                      {i.type ? INSTRUMENT_TYPE_LABEL[i.type] ?? i.type : "Non catégorisé"}
                      {i.numero_serie ? ` · N° ${i.numero_serie}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {i.dernier_etalonnage ? `Étalonné le ${dateFr(i.dernier_etalonnage)}` : "Jamais étalonné"}
                      {info.prochaine ? ` · prochain ${dateFr(info.prochaine)}` : ""}
                    </div>
                  </div>
                  <Badge tone={STATUT_ETALONNAGE_TON[info.statut]}>{STATUT_ETALONNAGE_LABEL[info.statut]}</Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" className="flex-1 py-2 text-xs" onClick={() => marquerEtalonneAujourdhui(i)}>Étalonné aujourd&apos;hui</Button>
                  <Button variant="ghost" className="flex-1 py-2 text-xs" onClick={() => toggleActif(i)}>{i.actif ? "Désactiver" : "Réactiver"}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
