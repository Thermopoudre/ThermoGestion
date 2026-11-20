"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { errorFr } from "@/lib/errors";
import { dateFr } from "@/lib/utils";
import { CAUSES_NC, TYPOLOGIE_DEFAUTS } from "@/lib/qualite";

type ProjetOption = { id: string; numero: string | null; nom: string };
type FourneeOption = { id: string; numero: string | null; date_prevue: string | null };

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NonConformiteForm({
  prefillProjetId,
  prefillDefaut,
  onSaved,
}: {
  prefillProjetId?: string;
  prefillDefaut?: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [atelierId, setAtelierId] = useState("");
  const [projets, setProjets] = useState<ProjetOption[]>([]);
  const [fournees, setFournees] = useState<FourneeOption[]>([]);

  const defautConnu = prefillDefaut && (TYPOLOGIE_DEFAUTS as readonly string[]).includes(prefillDefaut);
  const [defaut, setDefaut] = useState(defautConnu ? prefillDefaut! : prefillDefaut ? "Autre" : TYPOLOGIE_DEFAUTS[0]);
  const [defautLibre, setDefautLibre] = useState(defautConnu ? "" : prefillDefaut ?? "");
  const [projetId, setProjetId] = useState(prefillProjetId ?? "");
  const [fourneeId, setFourneeId] = useState("");
  const [surfaceM2, setSurfaceM2] = useState("");
  const [cause, setCause] = useState<string>("");
  const [actionCorrective, setActionCorrective] = useState("");
  const [coutEstime, setCoutEstime] = useState("");
  const [retouche, setRetouche] = useState(false);
  const [rebut, setRebut] = useState(false);
  const [detecteeLe, setDetecteeLe] = useState(isoDate(new Date()));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: prs }, { data: frs }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("projets").select("id, numero, nom").order("created_at", { ascending: false }).limit(200),
        supabase.from("fournees").select("id, numero, date_prevue").order("date_prevue", { ascending: false }).limit(100),
      ]);
      if (membre) setAtelierId(membre.atelier_id);
      setProjets((prs as ProjetOption[]) ?? []);
      setFournees((frs as FourneeOption[]) ?? []);
    })();
  }, [supabase]);

  const defautFinal = defaut === "Autre" ? defautLibre.trim() : defaut;

  async function submit() {
    if (!defautFinal) return;
    setSaving(true);
    setError("");
    // Date choisie par l'opérateur + heure actuelle, converties en UTC explicite : une simple
    // concaténation de chaînes serait interprétée différemment selon le fuseau du serveur Postgres.
    const [annee, mois, jour] = detecteeLe.split("-").map(Number);
    const maintenant = new Date();
    const detecteeAt = new Date(annee, mois - 1, jour, maintenant.getHours(), maintenant.getMinutes(), maintenant.getSeconds());
    const { error: err } = await supabase.from("non_conformites").insert({
      atelier_id: atelierId,
      projet_id: projetId || null,
      fournee_id: fourneeId || null,
      defaut: defautFinal,
      surface_m2: surfaceM2 === "" ? null : Number(surfaceM2),
      cause: cause || null,
      action_corrective: actionCorrective.trim() || null,
      cout_estime: coutEstime === "" ? null : Number(coutEstime),
      retouche,
      rebut,
      detectee_at: detecteeAt.toISOString(),
    });
    // L'erreur est doublée en toast : sur mobile le message inline peut être hors écran.
    if (err) { const msg = errorFr(err); setError(msg); toast(msg, "error"); setSaving(false); return; }
    toast("Non-conformité déclarée");
    setDefaut(TYPOLOGIE_DEFAUTS[0]); setDefautLibre(""); setProjetId(""); setFourneeId("");
    setSurfaceM2(""); setCause(""); setActionCorrective(""); setCoutEstime("");
    setRetouche(false); setRebut(false); setDetecteeLe(isoDate(new Date()));
    onSaved?.();
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Select label="Défaut constaté *" value={defaut} onChange={(e) => setDefaut(e.target.value)}>
        {TYPOLOGIE_DEFAUTS.map((d) => <option key={d} value={d}>{d}</option>)}
      </Select>
      {defaut === "Autre" && (
        <Input placeholder="Décrivez le défaut" value={defautLibre} onChange={(e) => setDefautLibre(e.target.value)} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Select label="Projet (facultatif)" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
          <option value="">— Aucun —</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.numero ? `${p.numero} — ` : ""}{p.nom}</option>)}
        </Select>
        <Select label="Fournée (facultatif)" value={fourneeId} onChange={(e) => setFourneeId(e.target.value)}>
          <option value="">— Aucune —</option>
          {/* D4 (recette navigateur, vague 2) : même défaut que le sélecteur de fournée de
              `ControleForm` — `date_prevue` est une date ISO, illisible affichée brute. */}
          {fournees.map((f) => <option key={f.id} value={f.id}>{f.numero ?? "Fournée"}{f.date_prevue ? ` — ${dateFr(f.date_prevue)}` : ""}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input label="Surface concernée (m²)" type="number" step="0.01" min="0" inputMode="decimal" value={surfaceM2} onChange={(e) => setSurfaceM2(e.target.value)} />
        <Input label="Détectée le" type="date" value={detecteeLe} onChange={(e) => setDetecteeLe(e.target.value)} />
      </div>

      <Select label="Cause probable" value={cause} onChange={(e) => setCause(e.target.value)}>
        <option value="">— Non déterminée —</option>
        {CAUSES_NC.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>

      <Textarea label="Action corrective" placeholder="Ce qui a été fait ou décidé pour éviter que ça se reproduise" value={actionCorrective} onChange={(e) => setActionCorrective(e.target.value)} />

      <Input label="Coût estimé (€)" type="number" step="0.01" min="0" inputMode="decimal" value={coutEstime} onChange={(e) => setCoutEstime(e.target.value)} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-gray-300 min-h-[44px] px-3 py-3 text-sm text-gray-700">
          <input type="checkbox" checked={retouche} onChange={(e) => setRetouche(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Retouchée
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-gray-300 min-h-[44px] px-3 py-3 text-sm text-gray-700">
          <input type="checkbox" checked={rebut} onChange={(e) => setRebut(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Mise au rebut
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button taille="xl" loading={saving} disabled={!defautFinal} onClick={submit}>
        {saving ? "Enregistrement…" : "Déclarer la non-conformité"}
      </Button>
    </div>
  );
}
