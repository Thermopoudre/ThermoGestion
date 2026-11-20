"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner } from "@/components/ui";
import ConfirmModal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { useTitreDocument } from "@/lib/titre";
import { dateFr } from "@/lib/utils";
import {
  LABELS_CERTIFICATION,
  PREAVIS_CERTIFICATION_JOURS,
  STATUT_CERTIFICATION_TON,
  STATUT_CERTIFICATION_LABEL,
  statutCertification,
} from "@/lib/certificat";
import type { Certification } from "@/lib/types";

export default function CertificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [certifications, setCertifications] = useState<Certification[] | null>(null);
  const [atelierId, setAtelierId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Certification | null>(null);

  const [form, setForm] = useState({ label: "Qualicoat", organisme: "", numero: "", obtenue_le: "", expire_le: "", note: "" });

  async function reload() {
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from("ateliers").select("id").maybeSingle(),
      supabase.from("certifications").select("*").order("expire_le", { ascending: true, nullsFirst: false }),
    ]);
    setAtelierId(a?.id ?? "");
    setCertifications((c as Certification[]) ?? []);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useTitreDocument("Certifications");

  if (!certifications) return <Spinner />;

  async function enregistrer() {
    if (!form.label) return;
    setBusy(true);
    const { error } = await supabase.from("certifications").insert({
      atelier_id: atelierId,
      label: form.label,
      organisme: form.organisme || null,
      numero: form.numero || null,
      obtenue_le: form.obtenue_le || null,
      expire_le: form.expire_le || null,
      note: form.note || null,
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setForm({ label: "Qualicoat", organisme: "", numero: "", obtenue_le: "", expire_le: "", note: "" });
    setOuvert(false);
    toast("Certification enregistrée");
    await reload();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setBusy(true);
    const { error } = await supabase.from("certifications").delete().eq("id", aSupprimer.id);
    setBusy(false);
    setASupprimer(null);
    if (error) { toast(errorFr(error), "error"); return; }
    await reload();
  }

  const aRenouveler = certifications.filter((c) => c.actif && ["bientot", "expiree"].includes(statutCertification(c.expire_le).statut));

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Link href="/qualite" className="text-sm text-brand underline">Qualité</Link>}>Certifications</PageTitle>

      <p className="-mt-2 text-sm text-gray-600">
        Vos agréments — Qualicoat, Qualisteelcoat, Qualimarine, ISO. Le label affiché sur votre registre
        de contrôles et sur vos certificats de conformité vient d&apos;ici : une certification expirée n&apos;est
        plus imprimée, parce qu&apos;elle n&apos;engage plus rien.
      </p>

      {aRenouveler.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="mb-1 text-sm font-semibold text-amber-900">À renouveler</div>
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {aRenouveler.map((c) => {
              const { statut, joursRestants } = statutCertification(c.expire_le);
              return (
                <li key={c.id}>
                  {c.label} —{" "}
                  {statut === "expiree"
                    ? `expirée depuis le ${dateFr(c.expire_le)}`
                    : `expire le ${dateFr(c.expire_le)}, dans ${joursRestants} jour${(joursRestants ?? 0) > 1 ? "s" : ""}`}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-amber-700">
            Un audit de renouvellement se programme plusieurs semaines à l&apos;avance : l&apos;alerte se déclenche
            à {PREAVIS_CERTIFICATION_JOURS} jours de l&apos;échéance.
          </p>
        </Card>
      )}

      {certifications.length === 0 ? (
        <Empty>Aucune certification enregistrée. Vos certificats de conformité seront émis sans label.</Empty>
      ) : (
        certifications.map((c) => {
          const { statut, joursRestants } = statutCertification(c.expire_le);
          return (
            <Card key={c.id} className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{c.label}{!c.actif && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}</div>
                  <div className="text-xs text-gray-500">
                    {[c.organisme, c.numero ? `n° ${c.numero}` : null].filter(Boolean).join(" · ") || "Organisme non renseigné"}
                  </div>
                </div>
                <Badge tone={STATUT_CERTIFICATION_TON[statut]}>{STATUT_CERTIFICATION_LABEL[statut]}</Badge>
              </div>
              <div className="text-xs text-gray-500">
                {c.obtenue_le && <>Obtenue le {dateFr(c.obtenue_le)} · </>}
                {c.expire_le
                  ? <>Expire le {dateFr(c.expire_le)}{joursRestants != null && joursRestants >= 0 && ` (dans ${joursRestants} j)`}</>
                  : "Sans date d'échéance"}
              </div>
              {c.note && <p className="text-xs text-gray-500">{c.note}</p>}
              <div className="mt-1 flex gap-3 text-xs">
                <button
                  className="text-gray-500 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  onClick={async () => { if (await ecrire(supabase.from("certifications").update({ actif: !c.actif }).eq("id", c.id), toast)) await reload(); }}
                >
                  {c.actif ? "Désactiver" : "Réactiver"}
                </button>
                <button className="text-red-500 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setASupprimer(c)}>Supprimer</button>
              </div>
            </Card>
          );
        })
      )}

      {!ouvert ? (
        <Button variant="secondary" onClick={() => setOuvert(true)}>+ Ajouter une certification</Button>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Nouvelle certification</div>
          <Select label="Label *" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}>
            {LABELS_CERTIFICATION.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Organisme certificateur" value={form.organisme} onChange={(e) => setForm((f) => ({ ...f, organisme: e.target.value }))} placeholder="AFNOR Certification…" />
            <Input label="N° d'agrément" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Obtenue le" type="date" value={form.obtenue_le} onChange={(e) => setForm((f) => ({ ...f, obtenue_le: e.target.value }))} />
            <Input label="Expire le" type="date" value={form.expire_le} onChange={(e) => setForm((f) => ({ ...f, expire_le: e.target.value }))} />
          </div>
          <Input label="Note (facultatif)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Classe 1, périmètre aluminium…" />
          <div className="flex gap-2">
            <Button onClick={enregistrer} disabled={busy || !form.label}>{busy ? "…" : "Enregistrer"}</Button>
            <Button variant="ghost" onClick={() => setOuvert(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      <ConfirmModal
        open={!!aSupprimer}
        title="Supprimer cette certification ?"
        message={`« ${aSupprimer?.label ?? ""} » ne sera plus mentionnée sur vos certificats de conformité ni sur votre registre de contrôles.`}
        confirmLabel="Supprimer"
        danger
        busy={busy}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
