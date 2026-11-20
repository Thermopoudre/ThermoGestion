"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SignaturePad from "@/components/SignaturePad";
import { Button, Input, Select, Spinner, Textarea } from "@/components/ui";
import { dateFr } from "@/lib/utils";
import { ipPublique } from "@/lib/ip";
import { errorFr } from "@/lib/errors";
import { ETAT_RECEPTION } from "@/lib/types";
import type { Client, Reception } from "@/lib/types";

type ProjetOption = { id: string; numero: string | null; nom: string; client_id: string };
// Colonnes réelles en base absentes du type partagé `Reception` (qui déclare à tort `signataire`
// et `date_reception`, inexistants) : on les retype localement plutôt que de toucher lib/types.ts.
type ReceptionAvecSignature = Omit<Reception, "signature"> & {
  depose_par: string | null;
  recu_par: string | null;
  signature: { image?: string } | null;
  signed_at: string | null;
};

export default function ReceptionForm({ receptionId, onSaved }: { receptionId?: string; onSaved?: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [atelierId, setAtelierId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [projets, setProjets] = useState<ProjetOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [projetId, setProjetId] = useState("");
  const [nbPieces, setNbPieces] = useState(1);
  const [designation, setDesignation] = useState("");
  const [etat, setEtat] = useState<Reception["etat_constate"]>("bon");
  const [reserves, setReserves] = useState("");
  const [deposePar, setDeposePar] = useState("");
  const [recuPar, setRecuPar] = useState("");
  const [signatureExistante, setSignatureExistante] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signatureDraft, setSignatureDraft] = useState<string | null>(null);
  const [refaireSignature, setRefaireSignature] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: cls }, { data: prs }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("clients").select("*").eq("archive", false).order("nom"),
        supabase.from("projets").select("id, numero, nom, client_id").order("created_at", { ascending: false }).limit(200),
      ]);
      setAtelierId(membre!.atelier_id);
      setClients((cls as Client[]) ?? []);
      setProjets((prs as ProjetOption[]) ?? []);
      if (receptionId) {
        const { data: r } = await supabase.from("receptions").select("*").eq("id", receptionId).single();
        if (r) {
          const reception = r as unknown as ReceptionAvecSignature;
          setClientId(reception.client_id);
          setProjetId(reception.projet_id ?? "");
          setNbPieces(reception.nb_pieces ?? 0);
          setDesignation(reception.designation ?? "");
          setEtat(reception.etat_constate ?? "bon");
          setReserves(reception.reserves ?? "");
          setDeposePar(reception.depose_par ?? "");
          setRecuPar(reception.recu_par ?? "");
          setSignatureExistante(reception.signature?.image ?? null);
          setSignedAt(reception.signed_at ?? null);
        }
      }
      setLoading(false);
    })();
  }, [receptionId, supabase]);

  const projetsDuClient = projets.filter((p) => p.client_id === clientId);

  async function save(): Promise<string | null> {
    setSaving(true);
    setError("");
    // Une signature recueillie sans trace d'IP ni d'horodatage n'a quasiment aucune valeur
    // probante si le client conteste l'état constaté à l'arrivée.
    const ip = signatureDraft ? await ipPublique() : "";
    const payload = {
      client_id: clientId,
      projet_id: projetId || null,
      nb_pieces: nbPieces,
      designation: designation.trim() || null,
      etat_constate: etat,
      reserves: reserves.trim() || null,
      depose_par: deposePar.trim() || null,
      recu_par: recuPar.trim() || null,
      // On n'écrase la signature que si le déposant vient d'en tracer une nouvelle : rouvrir le
      // formulaire pour corriger une réserve ne doit pas effacer une signature déjà recueillie.
      ...(signatureDraft
        ? { signature: { image: signatureDraft, at: new Date().toISOString(), ip }, signed_at: new Date().toISOString(), signature_ip: ip || null }
        : {}),
    };
    if (receptionId) {
      const { error: err } = await supabase.from("receptions").update(payload).eq("id", receptionId);
      setSaving(false);
      if (err) { setError(errorFr(err)); return null; }
      onSaved?.();
      return receptionId;
    }
    // Le bon est remis au client sur le quai, séance tenante : il lui faut un numéro dès la création.
    const { data: num } = await supabase.rpc("next_numero", { p_type: "reception" });
    const { data, error: err } = await supabase
      .from("receptions")
      .insert({ ...payload, atelier_id: atelierId, numero: num as string })
      .select("id")
      .single();
    setSaving(false);
    if (err) { setError(errorFr(err)); return null; }
    return data.id as string;
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Client *"
        value={clientId}
        onChange={(e) => { setClientId(e.target.value); setProjetId(""); }}
      >
        <option value="">— Choisir un client —</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </Select>

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Nombre de pièces *</span>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            aria-label="Retirer une pièce"
            onClick={() => setNbPieces(Math.max(0, nbPieces - 1))}
            className="min-h-[44px] w-16 rounded-lg border border-gray-300 bg-white text-2xl font-bold text-gray-700 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            −
          </button>
          <Input
            type="number"
            min="0"
            inputMode="numeric"
            className="text-center font-semibold"
            value={nbPieces}
            onChange={(e) => setNbPieces(Math.max(0, Number(e.target.value)))}
          />
          <button
            type="button"
            aria-label="Ajouter une pièce"
            onClick={() => setNbPieces(nbPieces + 1)}
            className="min-h-[44px] w-16 rounded-lg border border-gray-300 bg-white text-2xl font-bold text-gray-700 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            +
          </button>
        </div>
      </div>

      <Input
        label="Désignation des pièces"
        placeholder="ex : 4 jantes 19 pouces + 2 étriers"
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
      />

      <Select label="État constaté à l'arrivée *" value={etat} onChange={(e) => setEtat(e.target.value as Reception["etat_constate"])}>
        {Object.entries(ETAT_RECEPTION).map(([code, libelle]) => (
          <option key={code} value={code}>{libelle}</option>
        ))}
      </Select>

      <Textarea
        label={etat === "bon" ? "Réserves (facultatif)" : "Réserves *"}
        placeholder="Décrivez précisément les défauts : emplacement, étendue, pièce concernée."
        value={reserves}
        onChange={(e) => setReserves(e.target.value)}
      />
      {etat !== "bon" && !reserves.trim() && (
        <p className="-mt-2 text-xs text-amber-600">
          Détaillez les défauts constatés : c&apos;est ce texte, avec les photos, qui vous protège si le
          client conteste l&apos;état de ses pièces à la restitution.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input label="Déposé par" placeholder="Nom du client / chauffeur" value={deposePar} onChange={(e) => setDeposePar(e.target.value)} />
        <Input label="Reçu par" placeholder="Votre nom" value={recuPar} onChange={(e) => setRecuPar(e.target.value)} />
      </div>

      <Select label="Rattacher à un projet (facultatif)" value={projetId} onChange={(e) => setProjetId(e.target.value)} disabled={!clientId}>
        <option value="">— Aucun projet —</option>
        {projetsDuClient.map((p) => (
          <option key={p.id} value={p.id}>{p.numero ? `${p.numero} — ` : ""}{p.nom}</option>
        ))}
      </Select>
      {!projetId && (
        <p className="-mt-2 text-xs text-gray-500">
          Rattachez un projet pour que les photos de réception apparaissent aussi sur le bon consulté
          par le client.
        </p>
      )}

      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Signature du déposant (facultatif)</span>
        {signatureExistante && !refaireSignature ? (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signatureExistante} alt="Signature du déposant" className="h-20 w-full rounded bg-white object-contain" />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Signée{signedAt ? ` le ${dateFr(signedAt)}` : ""}</span>
              <button type="button" className="min-h-[44px] rounded px-1 font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setRefaireSignature(true)}>Refaire la signature</button>
            </div>
          </div>
        ) : (
          <SignaturePad onChange={setSignatureDraft} />
        )}
        <p className="mt-1 text-xs text-gray-500">
          Si le déposant est présent, faites-lui signer l&apos;écran : c&apos;est sa reconnaissance de
          l&apos;état des pièces au moment du dépôt.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        taille="xl"
        disabled={saving || !clientId || nbPieces < 1}
        onClick={async () => {
          const id = await save();
          if (id && !receptionId) { router.push(`/receptions/${id}`); router.refresh(); }
        }}
      >
        {saving ? "Enregistrement…" : receptionId ? "Enregistrer les modifications" : "Créer le bon de réception"}
      </Button>
    </div>
  );
}
