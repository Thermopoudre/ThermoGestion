"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Empty, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import ConfirmModal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { dateFr } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import { FDS_PERIME_ANNEES, fdsAVerifier, filtrerFds, type FicheFds } from "@/lib/environnement";

type PoudreOption = { id: string; marque: string | null; reference: string; ral: string | null };

const FORM_VIDE = {
  produit: "",
  fournisseur: "",
  poudre_id: "",
  version: "",
  date_fds: "",
  url: "",
  mentions_danger: "",
  note: "",
};

export default function FdsPage() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [fiches, setFiches] = useState<FicheFds[] | null>(null);
  const [poudres, setPoudres] = useState<PoudreOption[]>([]);
  const [atelierId, setAtelierId] = useState("");
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...FORM_VIDE });
  const [aSupprimer, setASupprimer] = useState<FicheFds | null>(null);

  async function reload() {
    const [{ data: a }, { data: f }, { data: p }] = await Promise.all([
      supabase.from("ateliers").select("id").maybeSingle(),
      supabase.from("fds").select("*").order("produit"),
      supabase.from("poudres").select("id, marque, reference, ral").eq("actif", true).order("reference"),
    ]);
    setAtelierId(a?.id ?? "");
    setFiches((f as FicheFds[]) ?? []);
    setPoudres((p as PoudreOption[]) ?? []);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useTitreDocument("Fiches de données de sécurité");

  if (!fiches) return <Spinner />;

  const visibles = filtrerFds(fiches.filter((f) => f.actif), recherche);
  const aVerifier = fiches.filter((f) => f.actif && fdsAVerifier(f.date_fds)).length;

  async function enregistrer() {
    if (!form.produit.trim()) { toast("Indiquez le nom du produit.", "error"); return; }
    if (!form.url.trim()) { toast("Indiquez le lien vers la fiche du fournisseur.", "error"); return; }
    setBusy(true);
    const { error } = await supabase.from("fds").insert({
      atelier_id: atelierId,
      poudre_id: form.poudre_id || null,
      produit: form.produit.trim(),
      fournisseur: form.fournisseur.trim() || null,
      version: form.version.trim() || null,
      date_fds: form.date_fds || null,
      url: form.url.trim(),
      mentions_danger: form.mentions_danger.trim() || null,
      note: form.note.trim() || null,
    });
    setBusy(false);
    if (error) { toast(errorFr(error), "error"); return; }
    setForm({ ...FORM_VIDE });
    setOuvert(false);
    toast("Fiche ajoutée au classeur");
    await reload();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setBusy(true);
    const { error } = await supabase.from("fds").delete().eq("id", aSupprimer.id);
    setBusy(false);
    setASupprimer(null);
    if (error) { toast(errorFr(error), "error"); return; }
    await reload();
  }

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle action={<Link href="/qualite" className="text-sm text-brand underline">Qualité</Link>}>Fiches de données de sécurité</PageTitle>

      <p className="-mt-2 text-sm text-gray-600">
        Le classeur FDS, dans la poche. Les fiches des poudres, dégraissants, solvants et adjuvants
        que vous employez doivent être à disposition de l&apos;équipe (art. R.4411-73 du code du travail) —
        et surtout accessibles en trois secondes le jour où quelqu&apos;un reçoit une projection.
      </p>

      {/* Recherche en premier et en grand : sur un téléphone, dans un atelier, c'est le seul geste
          qui compte. Le reste de l'écran sert à alimenter le classeur, pas à le consulter. */}
      <Input
        placeholder="Rechercher un produit, une marque…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="py-3.5 text-base"
      />

      {aVerifier > 0 && (
        <Card className="border-amber-300 bg-amber-50 text-sm text-amber-900">
          {aVerifier} fiche{aVerifier > 1 ? "s" : ""} sans date ou de plus de {FDS_PERIME_ANNEES} ans.
          Demandez la version à jour à votre fournisseur : il est tenu de vous la fournir.
        </Card>
      )}

      {visibles.length === 0 ? (
        <Empty>
          {recherche ? "Aucune fiche ne correspond à cette recherche." : "Classeur vide. Ajoutez la fiche de chaque produit chimique employé dans l'atelier."}
        </Empty>
      ) : (
        visibles.map((f) => (
          <Card key={f.id} className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{f.produit}</div>
                <div className="text-xs text-gray-500">
                  {[f.fournisseur, f.version ? `version ${f.version}` : null, f.date_fds ? dateFr(f.date_fds) : "sans date"].filter(Boolean).join(" · ")}
                </div>
              </div>
              {fdsAVerifier(f.date_fds) && <Badge tone="warning">À vérifier</Badge>}
            </div>
            {f.mentions_danger && <p className="text-xs text-gray-600">{f.mentions_danger}</p>}
            {f.url && (
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex min-h-[44px] items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white"
              >
                Ouvrir la fiche
              </a>
            )}
            <div className="mt-1 text-xs">
              <button className="text-red-500 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setASupprimer(f)}>Retirer du classeur</button>
            </div>
          </Card>
        ))
      )}

      {!ouvert ? (
        <Button variant="secondary" onClick={() => setOuvert(true)}>+ Ajouter une fiche</Button>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Nouvelle fiche</div>
          <Input label="Produit *" value={form.produit} onChange={(e) => setForm((f) => ({ ...f, produit: e.target.value }))} placeholder="Poudre polyester RAL 9010, dégraissant alcalin…" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fournisseur" value={form.fournisseur} onChange={(e) => setForm((f) => ({ ...f, fournisseur: e.target.value }))} />
            <Input label="Version" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="3.2" />
          </div>
          <Select label="Poudre du catalogue (facultatif)" value={form.poudre_id} onChange={(e) => setForm((f) => ({ ...f, poudre_id: e.target.value }))}>
            <option value="">— Aucune —</option>
            {poudres.map((p) => (
              <option key={p.id} value={p.id}>{[p.marque, p.reference, p.ral ? `RAL ${p.ral}` : null].filter(Boolean).join(" ")}</option>
            ))}
          </Select>
          <Input label="Date de la fiche" type="date" value={form.date_fds} onChange={(e) => setForm((f) => ({ ...f, date_fds: e.target.value }))} />
          <Input label="Lien vers la fiche (PDF du fournisseur) *" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" />
          <Textarea label="Mentions de danger (facultatif)" value={form.mentions_danger} onChange={(e) => setForm((f) => ({ ...f, mentions_danger: e.target.value }))} placeholder="H317 — Peut provoquer une allergie cutanée" />
          <div className="flex gap-2">
            <Button onClick={enregistrer} disabled={busy}>{busy ? "…" : "Enregistrer"}</Button>
            <Button variant="ghost" onClick={() => setOuvert(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      <ConfirmModal
        open={!!aSupprimer}
        title="Retirer cette fiche du classeur ?"
        message={`« ${aSupprimer?.produit ?? ""} » ne sera plus consultable depuis l'atelier.`}
        confirmLabel="Retirer"
        danger
        busy={busy}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </div>
  );
}
