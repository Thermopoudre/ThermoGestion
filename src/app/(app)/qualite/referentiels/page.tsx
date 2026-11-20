"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner } from "@/components/ui";
import ConfirmModal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import {
  EXPLICATION_SEUILS,
  SEUILS_QUALICOAT_CLASSE_1,
  TYPES_CONTROLE,
  TYPE_CONTROLE_LABEL,
  labelExigeEpaisseur,
  resumeSeuils,
  seuilsDuReferentiel,
  typesControleActifs,
} from "@/lib/qualite";
import { LABELS_CERTIFICATION } from "@/lib/certificat";
import { useTitreDocument } from "@/lib/titre";
import type { ControleType, ReferentielQualite } from "@/lib/types";

type Form = {
  nom: string;
  label: string;
  epaisseur_mini_um: string;
  epaisseur_maxi_um: string;
  brillance_tolerance_ub: string;
  adherence_classe_max: string;
  buchholz_min: string;
  types_controle: ControleType[];
  note: string;
};

const FORM_VIDE: Form = {
  nom: "",
  label: "Qualicoat",
  epaisseur_mini_um: String(SEUILS_QUALICOAT_CLASSE_1.epaisseur_mini_um),
  epaisseur_maxi_um: "",
  brillance_tolerance_ub: String(SEUILS_QUALICOAT_CLASSE_1.brillance_tolerance_ub),
  adherence_classe_max: String(SEUILS_QUALICOAT_CLASSE_1.adherence_classe_max),
  buchholz_min: String(SEUILS_QUALICOAT_CLASSE_1.buchholz_min),
  types_controle: [...TYPES_CONTROLE],
  note: "",
};

function formDepuis(r: ReferentielQualite): Form {
  return {
    nom: r.nom,
    label: r.label ?? "Autre",
    epaisseur_mini_um: String(r.epaisseur_mini_um ?? ""),
    epaisseur_maxi_um: r.epaisseur_maxi_um == null ? "" : String(r.epaisseur_maxi_um),
    brillance_tolerance_ub: String(r.brillance_tolerance_ub ?? ""),
    adherence_classe_max: String(r.adherence_classe_max ?? ""),
    buchholz_min: String(r.buchholz_min ?? ""),
    types_controle: typesControleActifs(r),
    note: r.note ?? "",
  };
}

function Explication({ cle }: { cle: (typeof EXPLICATION_SEUILS)[number]["cle"] }) {
  const e = EXPLICATION_SEUILS.find((x) => x.cle === cle);
  if (!e) return null;
  return <p className="mt-1 text-xs leading-relaxed text-gray-500">{e.texte}</p>;
}

export default function ReferentielsPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [referentiels, setReferentiels] = useState<ReferentielQualite[] | null>(null);
  const [atelierId, setAtelierId] = useState("");
  const [edite, setEdite] = useState<string | "nouveau" | null>(null);
  const [form, setForm] = useState<Form>(FORM_VIDE);
  const [busy, setBusy] = useState(false);
  const [aSupprimer, setASupprimer] = useState<ReferentielQualite | null>(null);

  async function reload() {
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase.from("ateliers").select("id").maybeSingle(),
      supabase.from("referentiels_qualite").select("*").order("par_defaut", { ascending: false }).order("nom"),
    ]);
    setAtelierId(a?.id ?? "");
    setReferentiels((r as ReferentielQualite[]) ?? []);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useTitreDocument("Référentiels qualité");

  if (!referentiels) return <Spinner />;

  function ouvrirNouveau() {
    setForm({ ...FORM_VIDE, nom: "" });
    setEdite("nouveau");
  }
  function ouvrirEdition(r: ReferentielQualite) {
    setForm(formDepuis(r));
    setEdite(r.id);
  }

  function champs() {
    const maxi = form.epaisseur_maxi_um.trim();
    return {
      nom: form.nom.trim(),
      label: form.label === "Autre" ? null : form.label,
      epaisseur_mini_um: Number(form.epaisseur_mini_um),
      epaisseur_maxi_um: maxi === "" ? null : Number(maxi),
      brillance_tolerance_ub: Number(form.brillance_tolerance_ub),
      adherence_classe_max: Number(form.adherence_classe_max),
      buchholz_min: Number(form.buchholz_min),
      // L'ordre d'affichage du produit, pas celui des clics de l'utilisateur.
      types_controle: TYPES_CONTROLE.filter((t) => form.types_controle.includes(t)),
      note: form.note.trim() || null,
    };
  }

  async function enregistrer() {
    const v = champs();
    if (!v.nom) { toast("Donnez un nom à ce référentiel.", "error"); return; }
    if (v.types_controle.length === 0) { toast("Gardez au moins un contrôle pratiqué.", "error"); return; }
    setBusy(true);
    const { error } = edite === "nouveau"
      ? await supabase.from("referentiels_qualite").insert({
          atelier_id: atelierId,
          ...v,
          // Premier référentiel de l'atelier : il devient forcément celui appliqué par défaut.
          par_defaut: referentiels!.length === 0,
        })
      : await supabase.from("referentiels_qualite").update(v).eq("id", edite!);
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setEdite(null);
    toast("Référentiel enregistré — il s'applique aux prochains contrôles, pas aux précédents");
    await reload();
  }

  async function definirParDefaut(r: ReferentielQualite) {
    setBusy(true);
    // L'index unique n'autorise qu'un seul défaut par atelier : on retire l'ancien avant de poser
    // le nouveau, sinon la mise à jour est rejetée.
    const ancien = referentiels!.find((x) => x.par_defaut && x.id !== r.id);
    // Si le retrait de l'ancien défaut échoue, poser le nouveau sera rejeté par l'index unique :
    // on s'arrête ici plutôt que d'afficher une erreur incompréhensible sur l'appel suivant.
    if (ancien && !(await ecrire(supabase.from("referentiels_qualite").update({ par_defaut: false }).eq("id", ancien.id), toast))) { setBusy(false); return; }
    const { error } = await supabase.from("referentiels_qualite").update({ par_defaut: true, actif: true }).eq("id", r.id);
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    await reload();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setBusy(true);
    const { error } = await supabase.from("referentiels_qualite").delete().eq("id", aSupprimer.id);
    setBusy(false);
    setASupprimer(null);
    if (error) { toast(errorFr(error), "error"); return; }
    await reload();
  }

  const formulaire = (
    <Card className="flex flex-col gap-3">
      <div className="text-sm font-semibold">{edite === "nouveau" ? "Nouveau référentiel" : "Modifier le référentiel"}</div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Nom *"
          value={form.nom}
          onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
          placeholder="Qualicoat classe 1, Client X — C4…"
        />
        <Select label="Label rattaché" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}>
          {LABELS_CERTIFICATION.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </div>

      {/* B1 — tous les ateliers ne mesurent pas tout. Un type décoché disparaît de la saisie, du
          registre et des blocages du certificat, et la base refuse de l'enregistrer. */}
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Contrôles pratiqués *</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPES_CONTROLE.map((t) => {
            const coche = form.types_controle.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    types_controle: coche ? f.types_controle.filter((x) => x !== t) : [...f.types_controle, t],
                  }))
                }
                aria-pressed={coche}
                className={
                  "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium " +
                  (coche ? "border-brand bg-brand-light text-brand-dark" : "border-gray-300 bg-white text-gray-500") +
                  " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                }
              >
                {coche && <Check size={14} aria-hidden />}
                {TYPE_CONTROLE_LABEL[t]}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Décochez ce que votre atelier ne mesure pas : ces contrôles disparaissent de la saisie et
          le certificat de conformité cesse de les exiger. Il n&apos;affirmera rien à leur sujet non
          plus — un certificat n&apos;atteste que ce qui a été mesuré.
        </p>
        {labelExigeEpaisseur(form.label) && !form.types_controle.includes("epaisseur") && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            <b>Attention :</b> le référentiel {form.label} impose un contrôle d&apos;épaisseur de film.
            En le désactivant, vos certificats resteront exacts mais n&apos;attesteront plus
            l&apos;épaisseur — un audit du label, lui, la réclamera.
          </p>
        )}
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Épaisseur minimale (µm) *" type="number" value={form.epaisseur_mini_um} onChange={(e) => setForm((f) => ({ ...f, epaisseur_mini_um: e.target.value }))} />
          <Input label="Épaisseur maximale (µm)" type="number" value={form.epaisseur_maxi_um} onChange={(e) => setForm((f) => ({ ...f, epaisseur_maxi_um: e.target.value }))} placeholder="aucune" />
        </div>
        <Explication cle="epaisseur_mini_um" />
        <Explication cle="epaisseur_maxi_um" />
      </div>

      <div>
        <Input label="Tolérance de brillance (± UB à 60°) *" type="number" value={form.brillance_tolerance_ub} onChange={(e) => setForm((f) => ({ ...f, brillance_tolerance_ub: e.target.value }))} />
        <Explication cle="brillance_tolerance_ub" />
      </div>

      <div>
        <Select label="Classe d'adhérence maximale acceptée (ISO 2409) *" value={form.adherence_classe_max} onChange={(e) => setForm((f) => ({ ...f, adherence_classe_max: e.target.value }))}>
          {[0, 1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Classe {c}{c === 0 ? " (aucun écaillage)" : ""}</option>)}
        </Select>
        <Explication cle="adherence_classe_max" />
      </div>

      <div>
        <Input label="Dureté Buchholz minimale *" type="number" value={form.buchholz_min} onChange={(e) => setForm((f) => ({ ...f, buchholz_min: e.target.value }))} />
        <Explication cle="buchholz_min" />
      </div>

      <Input label="Note (facultatif)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Périmètre, donneur d'ordre concerné…" />

      <div className="flex gap-2">
        <Button onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer"}</Button>
        <Button variant="ghost" onClick={() => setEdite(null)}>Annuler</Button>
        {edite === "nouveau" && (
          <Button variant="secondary" onClick={() => setForm((f) => ({ ...FORM_VIDE, nom: f.nom, note: f.note }))}>
            Valeurs Qualicoat classe 1
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Link href="/qualite" className="text-sm text-brand underline">Qualité</Link>}>Référentiels de contrôle</PageTitle>

      <p className="-mt-2 text-sm text-gray-600">
        Les seuils qui décident du verdict « conforme / non conforme » à la saisie d&apos;un contrôle.
        Ils sont livrés aux valeurs de la classe 1 Qualicoat, la plus répandue en sous-traitance générale —
        si votre agrément ou le cahier des charges d&apos;un donneur d&apos;ordre en impose d&apos;autres, réglez-les ici.
      </p>

      <Card className="border-gray-300 bg-gray-50 text-sm text-gray-700">
        <span className="font-semibold">Modifier un seuil n&apos;a jamais d&apos;effet rétroactif.</span> Chaque contrôle
        conserve le barème qui lui a été appliqué le jour de la mesure, et son verdict ne peut plus être modifié —
        c&apos;est ce qui fait qu&apos;un registre de contrôles vaut quelque chose devant un auditeur.
      </Card>

      {referentiels.length === 0 ? (
        <Empty>Aucun référentiel : les contrôles utiliseront les valeurs Qualicoat classe 1.</Empty>
      ) : (
        referentiels.map((r) => (
          <Card key={r.id} className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">
                  {r.nom}
                  {!r.actif && <span className="ml-2 text-xs text-gray-400">(inactif)</span>}
                </div>
                <div className="text-xs text-gray-500">{r.label ?? "Sans label"}</div>
              </div>
              {r.par_defaut && <Badge tone="info">Par défaut</Badge>}
            </div>
            <div className="text-xs text-gray-600">{resumeSeuils(seuilsDuReferentiel(r))}</div>
            <div className="text-xs text-gray-500">
              Contrôles pratiqués : {typesControleActifs(r).map((t) => TYPE_CONTROLE_LABEL[t]).join(", ")}
              {typesControleActifs(r).length < TYPES_CONTROLE.length && (
                <span className="text-gray-400">
                  {" "}(non pratiqués : {TYPES_CONTROLE.filter((t) => !typesControleActifs(r).includes(t)).map((t) => TYPE_CONTROLE_LABEL[t]).join(", ")})
                </span>
              )}
            </div>
            {labelExigeEpaisseur(r.label) && !typesControleActifs(r).includes("epaisseur") && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning-dark">
                <AlertTriangle size={14} aria-hidden className="flex-none" />
                {r.label} impose l&apos;épaisseur, qui n&apos;est pas pratiquée ici.
              </p>
            )}
            {r.note && <p className="text-xs text-gray-500">{r.note}</p>}
            <div className="mt-1 flex flex-wrap gap-3 text-xs">
              <button type="button" className="min-h-[44px] rounded px-1 text-brand underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => ouvrirEdition(r)}>Modifier</button>
              {!r.par_defaut && <button type="button" className="min-h-[44px] rounded px-1 text-gray-600 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => definirParDefaut(r)} disabled={busy}>Définir par défaut</button>}
              <button
                type="button"
                className="min-h-[44px] rounded px-1 text-gray-500 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={async () => { if (await ecrire(supabase.from("referentiels_qualite").update({ actif: !r.actif }).eq("id", r.id), toast)) await reload(); }}
              >
                {r.actif ? "Désactiver" : "Réactiver"}
              </button>
              <button type="button" className="min-h-[44px] rounded px-1 text-danger underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setASupprimer(r)}>Supprimer</button>
            </div>
            {edite === r.id && <div className="mt-2">{formulaire}</div>}
          </Card>
        ))
      )}

      {edite === "nouveau" ? formulaire : <Button variant="secondary" onClick={ouvrirNouveau}>+ Ajouter un référentiel</Button>}

      <ConfirmModal
        open={!!aSupprimer}
        title="Supprimer ce référentiel ?"
        message={`« ${aSupprimer?.nom ?? ""} » ne sera plus proposé à la saisie. Les contrôles déjà enregistrés gardent le barème qui leur a été appliqué : ni leurs seuils ni leur verdict ne changent.`}
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
