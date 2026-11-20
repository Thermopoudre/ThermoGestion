"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Button, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import { BAINS_TYPES } from "@/lib/qualite";

function ChampNombre({ label, unite, value, onChange }: { label: string; unite?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}{unite ? ` (${unite})` : ""}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-lg font-semibold focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}

export default function BainForm({ onSaved }: { onSaved?: () => void }) {
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [atelierId, setAtelierId] = useState("");
  const [operateurId, setOperateurId] = useState("");
  const [bain, setBain] = useState<string>(BAINS_TYPES[0]);
  const [bainLibre, setBainLibre] = useState("");
  const [ph, setPh] = useState("");
  const [conductivite, setConductivite] = useState("");
  const [temperature, setTemperature] = useState("");
  const [titrage, setTitrage] = useState("");
  const [conforme, setConforme] = useState<boolean | null>(null);
  const [action, setAction] = useState("");
  const [renouvele, setRenouvele] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("users").select("id, atelier_id").single().then(({ data }) => {
      if (data) { setAtelierId(data.atelier_id); setOperateurId(data.id); }
    });
  }, [supabase]);

  const nomBain = bain === "Autre" ? bainLibre.trim() : bain;

  async function submit() {
    if (!nomBain) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("controles_bains").insert({
      atelier_id: atelierId,
      bain: nomBain,
      ph: ph === "" ? null : Number(ph),
      conductivite: conductivite === "" ? null : Number(conductivite),
      temperature: temperature === "" ? null : Number(temperature),
      titrage: titrage === "" ? null : Number(titrage),
      conforme,
      action: action.trim() || null,
      renouvele,
      operateur_id: operateurId || null,
    });
    // L'erreur est doublée en toast : sur mobile le message inline peut être hors écran.
    if (err) { const msg = errorFr(err); setError(msg); toast(msg, "error"); setSaving(false); return; }
    toast(conforme === false ? "Relevé enregistré — bain non conforme" : "Relevé de bain enregistré", conforme === false ? "error" : "success");
    // Le bain choisi reste affiché : la tournée de contrôle des bains se fait cuve par cuve,
    // à la suite, pas une seule mesure isolée.
    setPh(""); setConductivite(""); setTemperature(""); setTitrage(""); setConforme(null); setAction(""); setRenouvele(false);
    onSaved?.();
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Select label="Bain" value={bain} onChange={(e) => setBain(e.target.value)}>
        {BAINS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
      </Select>
      {bain === "Autre" && (
        <input
          placeholder="Nom du bain"
          value={bainLibre}
          onChange={(e) => setBainLibre(e.target.value)}
          className="w-full rounded-lg border border-gray-300 min-h-[44px] px-3 py-3 text-sm focus:border-brand focus:outline-none"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ChampNombre label="pH" value={ph} onChange={setPh} />
        <ChampNombre label="Conductivité" unite="µS/cm" value={conductivite} onChange={setConductivite} />
        <ChampNombre label="Température" unite="°C" value={temperature} onChange={setTemperature} />
        <ChampNombre label="Titrage" value={titrage} onChange={setTitrage} />
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Verdict</span>
        <p className="mb-2 text-xs text-gray-500">
          Pas de seuil universel ici : la chimie retenue par votre fournisseur de ligne fixe les
          plages correctes. À vous de trancher.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setConforme(true)}
            aria-pressed={conforme === true}
            className={cn("min-h-[44px] rounded-lg border py-3 text-sm font-medium", conforme === true ? "border-success bg-success-50 text-success-dark" : "border-gray-300 bg-white text-gray-700", "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}
          >
            Conforme
          </button>
          <button
            type="button"
            onClick={() => setConforme(false)}
            aria-pressed={conforme === false}
            className={cn("min-h-[44px] rounded-lg border py-3 text-sm font-medium", conforme === false ? "border-danger bg-danger-50 text-danger-dark" : "border-gray-300 bg-white text-gray-700", "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}
          >
            Non conforme
          </button>
        </div>
      </div>

      {conforme === false && (
        <Textarea label="Action corrective (ajustement, appoint, renouvellement…)" value={action} onChange={(e) => setAction(e.target.value)} />
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={renouvele} onChange={(e) => setRenouvele(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
        Ce relevé correspond à un renouvellement du bain
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button taille="xl" loading={saving} disabled={!nomBain} onClick={submit}>
        {saving ? "Enregistrement…" : "Enregistrer le relevé"}
      </Button>
    </div>
  );
}
