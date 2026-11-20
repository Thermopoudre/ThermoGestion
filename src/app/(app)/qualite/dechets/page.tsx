"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import ConfirmModal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { AlertTriangle } from "lucide-react";
import { dateFr, nombreFr } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import {
  CONSERVATION_REGISTRE_ANNEES,
  NATURES_DECHET,
  TRAITEMENTS_DECHET,
  bordereauManquant,
  totauxDechets,
  type LigneDechet,
} from "@/lib/environnement";

function isoJour(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FormDechet = {
  date_sortie: string; nature: string; code_dechet: string; dangereux: boolean;
  quantite_kg: string; bordereau: string; transporteur: string; destination: string;
  traitement: string; note: string;
};

// `NATURES_DECHET` est déclaré `as const` : sans annotation explicite, TypeScript figerait le
// formulaire sur les seuls libellés de la liste, alors que la nature est modifiable.
const FORM_VIDE: FormDechet = {
  date_sortie: isoJour(new Date()),
  nature: NATURES_DECHET[0].nature,
  code_dechet: NATURES_DECHET[0].code,
  dangereux: NATURES_DECHET[0].dangereux,
  quantite_kg: "",
  bordereau: "",
  transporteur: "",
  destination: "",
  traitement: "",
  note: "",
};

export default function DechetsPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [lignes, setLignes] = useState<LigneDechet[] | null>(null);
  const [atelierId, setAtelierId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...FORM_VIDE });
  const [aSupprimer, setASupprimer] = useState<LigneDechet | null>(null);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));

  async function reload() {
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from("ateliers").select("id").maybeSingle(),
      supabase
        .from("dechets")
        .select("*")
        .gte("date_sortie", `${annee}-01-01`)
        .lte("date_sortie", `${annee}-12-31`)
        .order("date_sortie", { ascending: false }),
    ]);
    setAtelierId(a?.id ?? "");
    setLignes((d as LigneDechet[]) ?? []);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [annee]);

  useTitreDocument("Registre des déchets");

  if (!lignes) return <Spinner />;

  const totaux = totauxDechets(lignes);
  const anneeCourante = new Date().getFullYear();
  const annees = Array.from({ length: CONSERVATION_REGISTRE_ANNEES }, (_, i) => String(anneeCourante - i));

  function choisirNature(nature: string) {
    const connue = NATURES_DECHET.find((n) => n.nature === nature);
    setForm((f) => ({ ...f, nature, code_dechet: connue?.code ?? f.code_dechet, dangereux: connue?.dangereux ?? f.dangereux }));
  }

  async function enregistrer() {
    const kg = Number(form.quantite_kg);
    if (!Number.isFinite(kg) || kg <= 0) { toast("Indiquez une quantité en kilogrammes.", "error"); return; }
    setBusy(true);
    const { data: membre } = await supabase.from("users").select("id").maybeSingle();
    const { error } = await supabase.from("dechets").insert({
      atelier_id: atelierId,
      date_sortie: form.date_sortie,
      nature: form.nature,
      code_dechet: form.code_dechet.trim() || null,
      dangereux: form.dangereux,
      quantite_kg: kg,
      bordereau: form.bordereau.trim() || null,
      transporteur: form.transporteur.trim() || null,
      destination: form.destination.trim() || null,
      traitement: form.traitement || null,
      note: form.note.trim() || null,
      created_by: membre?.id ?? null,
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setForm({ ...FORM_VIDE });
    setOuvert(false);
    toast("Sortie enregistrée au registre");
    await reload();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setBusy(true);
    const { error } = await supabase.from("dechets").delete().eq("id", aSupprimer.id);
    setBusy(false);
    setASupprimer(null);
    if (error) { toast(errorFr(error), "error"); return; }
    await reload();
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-3xl">
      <PageTitle action={<Link href="/qualite" className="text-sm text-brand underline">Qualité</Link>}>Registre des déchets</PageTitle>

      <p className="-mt-2 text-sm text-gray-600">
        Boues de cabine, poudre périmée, bains usés, emballages souillés : le registre chronologique
        des sorties, à conserver {CONSERVATION_REGISTRE_ANNEES} ans et à présenter à l&apos;inspection
        des installations classées (ICPE 2940, art. R.541-43 du code de l&apos;environnement).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <Select label="Année" value={annee} onChange={(e) => setAnnee(e.target.value)} className="w-auto">
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <a
          href={`/api/pdf/registre-dechets?annee=${annee}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand min-h-[44px] px-3 py-3 text-sm font-medium text-white"
        >
          Exporter le registre (PDF)
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><div className="text-2xl font-bold">{nombreFr(totaux.dangereux)}</div><div className="text-xs text-gray-500">kg dangereux</div></Card>
        <Card><div className="text-2xl font-bold">{nombreFr(totaux.nonDangereux)}</div><div className="text-xs text-gray-500">kg non dangereux</div></Card>
        <Card><div className="text-2xl font-bold">{lignes.length}</div><div className="text-xs text-gray-500">sorties enregistrées</div></Card>
        <Card className={totaux.sansBordereau ? "border-red-300 bg-red-50" : ""}>
          <div className="text-2xl font-bold">{totaux.sansBordereau}</div>
          <div className="text-xs text-gray-500">dangereux sans bordereau</div>
        </Card>
      </div>

      {totaux.sansBordereau > 0 && (
        <Card className="border-amber-300 bg-amber-50 text-sm text-amber-900">
          {totaux.sansBordereau} sortie{totaux.sansBordereau > 1 ? "s" : ""} de déchet dangereux sans numéro de bordereau.
          C&apos;est la non-conformité la plus simple à relever en inspection : renseignez le n° de BSD
          (ou le récépissé Trackdéchets) dès que le prestataire vous le remet.
        </Card>
      )}

      {!ouvert ? (
        <Button onClick={() => setOuvert(true)}>+ Enregistrer une sortie</Button>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Nouvelle sortie de déchets</div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date d'expédition *" type="date" value={form.date_sortie} onChange={(e) => setForm((f) => ({ ...f, date_sortie: e.target.value }))} />
            <Input label="Quantité (kg) *" type="number" value={form.quantite_kg} onChange={(e) => setForm((f) => ({ ...f, quantite_kg: e.target.value }))} />
          </div>
          <Select label="Nature du déchet *" value={form.nature} onChange={(e) => choisirNature(e.target.value)}>
            {NATURES_DECHET.map((n) => <option key={n.nature} value={n.nature}>{n.nature}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code déchet (nomenclature)" value={form.code_dechet} onChange={(e) => setForm((f) => ({ ...f, code_dechet: e.target.value }))} placeholder="11 01 09*" />
            <Select label="Classement" value={form.dangereux ? "oui" : "non"} onChange={(e) => setForm((f) => ({ ...f, dangereux: e.target.value === "oui" }))}>
              <option value="oui">Dangereux (bordereau obligatoire)</option>
              <option value="non">Non dangereux</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="N° de bordereau (BSD / Trackdéchets)" value={form.bordereau} onChange={(e) => setForm((f) => ({ ...f, bordereau: e.target.value }))} />
            <Input label="Transporteur" value={form.transporteur} onChange={(e) => setForm((f) => ({ ...f, transporteur: e.target.value }))} />
          </div>
          <Input label="Exutoire — installation de destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="Nom et commune du centre de traitement" />
          <Select label="Code de traitement" value={form.traitement} onChange={(e) => setForm((f) => ({ ...f, traitement: e.target.value }))}>
            <option value="">— Non renseigné —</option>
            {TRAITEMENTS_DECHET.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
          </Select>
          <Textarea label="Note (facultatif)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          <div className="flex gap-2">
            <Button onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer"}</Button>
            <Button variant="ghost" onClick={() => setOuvert(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {lignes.length === 0 ? (
        <Empty>Aucune sortie enregistrée en {annee}.</Empty>
      ) : (
        lignes.map((l) => (
          <Card key={l.id} className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{l.nature}</div>
                <div className="text-xs text-gray-500">
                  {dateFr(l.date_sortie)} · {nombreFr(l.quantite_kg)} kg{l.code_dechet ? ` · code ${l.code_dechet}` : ""}
                </div>
              </div>
              <Badge tone={l.dangereux ? "danger" : "neutral"}>
                {l.dangereux ? "Dangereux" : "Non dangereux"}
              </Badge>
            </div>
            <div className="text-xs text-gray-600">
              {[l.bordereau ? `BSD ${l.bordereau}` : null, l.transporteur, l.destination, l.traitement].filter(Boolean).join(" · ") || "Aucun détail de filière renseigné"}
            </div>
            {bordereauManquant(l) && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-danger"><AlertTriangle size={14} aria-hidden /> Déchet dangereux sans numéro de bordereau.</div>
            )}
            {l.note && <p className="text-xs text-gray-500">{l.note}</p>}
            <div className="mt-1 text-xs">
              <button className="text-red-500 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setASupprimer(l)}>Supprimer</button>
            </div>
          </Card>
        ))
      )}

      <ConfirmModal
        open={!!aSupprimer}
        title="Supprimer cette ligne du registre ?"
        message="Le registre des déchets se conserve cinq ans. Ne supprimez une ligne que si elle a été saisie par erreur."
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
