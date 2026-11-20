"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { calcTotaux, eur, remiseAffichee, round2, sousTotalRemisable, uniteFr } from "@/lib/utils";
import { lignesDepuisDevis } from "@/lib/calculs";
import { errorFr } from "@/lib/errors";
import type { Client, DevisItem, LigneBL, Prestation, Remise } from "@/lib/types";

type ProjetOption = { id: string; numero: string | null; nom: string; client_id: string; devis_id: string | null };
type DevisSource = { id: string; numero: string | null; items: DevisItem[]; remise: Remise };

/**
 * Reprend les lignes chiffrées du devis telles quelles : ce qui est livré doit correspondre à ce
 * qui a été devisé, sinon l'écart entre devis, BL et facture est garanti.
 *
 * `meta` fait partie de « telles quelles » : c'est lui qui identifie la ligne de forfait minimum
 * (`estForfaitMinimum`). Une recopie qui le perd remet le plancher dans l'assiette de remise et
 * le BL annonce un total inférieur à celui de la facture du lendemain. C'est la quatrième
 * occurrence de cette famille de bug sur ce produit : la reprise passe désormais par la fonction
 * partagée de `@/lib/calculs`, la même que la facture, plutôt que par une copie locale.
 */
function lignesBLDepuisDevis(items: DevisItem[]): LigneBL[] {
  return lignesDepuisDevis(items).map((it) => ({
    libelle: it.libelle,
    qte: Number(it.qte) || 0,
    unite: it.unite,
    pu_ht: Number(it.pu_ht) || 0,
    tva: Number(it.tva) || 0,
    total_ht: round2((Number(it.qte) || 0) * (Number(it.pu_ht) || 0)),
    ...(it.meta ? { meta: it.meta } : {}),
  }));
}

export default function BonLivraisonEditor({ blId, projetInitial, onSaved }: { blId?: string; projetInitial?: string; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [atelierId, setAtelierId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [projets, setProjets] = useState<ProjetOption[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [clientId, setClientId] = useState("");
  const [projetId, setProjetId] = useState("");
  const [lignes, setLignes] = useState<LigneBL[]>([]);
  // La remise du devis suit les lignes : un BL qui affiche le prix brut d'un client remisé à 12 %
  // annonce un total que la facture dément le lendemain.
  const [remise, setRemise] = useState<Remise>(null);
  const [nbColis, setNbColis] = useState("");
  const [poidsKg, setPoidsKg] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("brouillon");
  const [devisSource, setDevisSource] = useState<DevisSource | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: cls }, { data: prs }, { data: pjs }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("clients").select("*").eq("archive", false).order("nom"),
        supabase.from("prestations").select("*").eq("actif", true).order("ordre"),
        supabase.from("projets").select("id, numero, nom, client_id, devis_id").order("created_at", { ascending: false }).limit(200),
      ]);
      setAtelierId(membre!.atelier_id);
      setClients((cls as Client[]) ?? []);
      setPrestations((prs as Prestation[]) ?? []);
      const options = (pjs as ProjetOption[]) ?? [];
      setProjets(options);
      if (blId) {
        const { data: b } = await supabase.from("bons_livraison").select("*").eq("id", blId).single();
        if (b) {
          setClientId(b.client_id);
          setProjetId(b.projet_id ?? "");
          setLignes((b.lignes as LigneBL[]) ?? []);
          setRemise((b.remise as Remise) ?? null);
          setNbColis(b.nb_colis === null ? "" : String(b.nb_colis));
          setPoidsKg(b.poids_kg === null ? "" : String(b.poids_kg));
          setNote(b.note ?? "");
          setStatus(b.status);
        }
      } else if (projetInitial) {
        const p = options.find((x) => x.id === projetInitial);
        if (p) { setClientId(p.client_id); setProjetId(p.id); }
      }
      setLoading(false);
    })();
  }, [blId, projetInitial, supabase]);

  // Le devis signé contient déjà les lignes : les ressaisir à la main, c'est se garantir un écart
  // entre ce qui est devisé, livré et facturé.
  useEffect(() => {
    let annule = false;
    (async () => {
      const projet = projets.find((p) => p.id === projetId);
      if (!projetId || !projet?.devis_id) { setDevisSource(null); return; }
      const { data } = await supabase.from("devis").select("id, numero, items, remise").eq("id", projet.devis_id).maybeSingle();
      if (annule || !data) { setDevisSource(null); return; }
      const devis = data as DevisSource;
      setDevisSource(devis);
      // Bon encore vierge : on préremplit sans rien demander. Sinon on laisse la main, la reprise
      // reste disponible par le bouton.
      setLignes((cur) => {
        if (cur.length > 0) return cur;
        setRemise(devis.remise ?? null);
        return lignesBLDepuisDevis(devis.items ?? []);
      });
    })();
    return () => { annule = true; };
  }, [projetId, projets, supabase]);

  function reprendreLeDevis() {
    if (!devisSource) return;
    setLignes(lignesBLDepuisDevis(devisSource.items ?? []));
    setRemise(devisSource.remise ?? null);
    toast(`Lignes reprises du devis ${devisSource.numero ?? ""}`.trim());
  }

  const totaux = calcTotaux(lignes, remise);
  const brutHt = sousTotalRemisable(lignes);
  // Remise réellement appliquée : voir `remiseAffichee`, la somme des parts arrondies par taux de
  // TVA peut dépasser la remise nominale d'un centime, et c'est le total HT qui fait foi.
  const remiseMontant = remiseAffichee(lignes, remise, totaux.total_ht);
  const readOnly = status !== "brouillon";
  const projetsDuClient = projets.filter((p) => p.client_id === clientId);

  function addLigne(prestation?: Prestation) {
    if (prestation) {
      setLignes([...lignes, {
        libelle: prestation.nom, qte: 1, unite: prestation.unite,
        pu_ht: Number(prestation.prix_unitaire_ht), tva: Number(prestation.tva_rate),
        total_ht: round2(Number(prestation.prix_unitaire_ht)),
      }]);
    } else {
      setLignes([...lignes, { libelle: "", qte: 1, unite: "piece", pu_ht: 0, tva: 20, total_ht: 0 }]);
    }
  }

  function updateLigne(idx: number, patch: Partial<LigneBL>) {
    const next = [...lignes];
    const l = { ...next[idx], ...patch };
    l.total_ht = round2(l.qte * l.pu_ht);
    next[idx] = l;
    setLignes(next);
  }

  async function save(): Promise<string | null> {
    setSaving(true);
    setError("");
    const payload = {
      client_id: clientId,
      projet_id: projetId || null,
      lignes,
      remise,
      nb_colis: nbColis === "" ? null : Number(nbColis),
      poids_kg: poidsKg === "" ? null : Number(poidsKg),
      note: note.trim() || null,
    };
    if (blId) {
      const { error: err } = await supabase.from("bons_livraison").update(payload).eq("id", blId);
      setSaving(false);
      if (err) { setError(errorFr(err)); return null; }
      onSaved?.();
      return blId;
    }
    const { data, error: err } = await supabase
      .from("bons_livraison")
      .insert({ ...payload, atelier_id: atelierId })
      .select("id")
      .single();
    setSaving(false);
    if (err) { setError(errorFr(err)); return null; }
    return data.id as string;
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <Select label="Client *" value={clientId} disabled={readOnly} onChange={(e) => { setClientId(e.target.value); setProjetId(""); }}>
        <option value="">— Choisir un client —</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </Select>

      <Select label="Projet (facultatif)" value={projetId} disabled={readOnly || !clientId} onChange={(e) => setProjetId(e.target.value)}>
        <option value="">— Aucun projet —</option>
        {projetsDuClient.map((p) => (
          <option key={p.id} value={p.id}>{p.numero ? `${p.numero} — ` : ""}{p.nom}</option>
        ))}
      </Select>

      {!readOnly && devisSource && (
        <Card className="flex items-center justify-between gap-3 border-brand/30 bg-brand-light">
          <div className="min-w-0 text-sm">
            <div className="font-medium text-brand-dark">Devis {devisSource.numero ?? "—"} rattaché à ce projet</div>
            <div className="text-xs text-gray-600">{(devisSource.items ?? []).length} ligne{(devisSource.items ?? []).length > 1 ? "s" : ""} déjà chiffrée{(devisSource.items ?? []).length > 1 ? "s" : ""}.</div>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={reprendreLeDevis}>
            {lignes.length === 0 ? "Reprendre les lignes" : "Remplacer par le devis"}
          </Button>
        </Card>
      )}

      {lignes.map((l, i) => (
        <Card key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Ligne {i + 1}</span>
            {!readOnly && <button type="button" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="min-h-[44px] rounded px-1 text-xs text-danger underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Supprimer</button>}
          </div>
          <Input placeholder="Libellé" value={l.libelle} disabled={readOnly} onChange={(e) => updateLigne(i, { libelle: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input label={`Qté (${uniteFr(l.unite)})`} type="number" step="0.01" min="0" value={l.qte} disabled={readOnly} onChange={(e) => updateLigne(i, { qte: Number(e.target.value) })} />
            <Input label="PU HT €" type="number" step="0.01" value={l.pu_ht} disabled={readOnly} onChange={(e) => updateLigne(i, { pu_ht: Number(e.target.value) })} />
            <Input label="TVA %" type="number" step="0.1" value={l.tva} disabled={readOnly} onChange={(e) => updateLigne(i, { tva: Number(e.target.value) })} />
          </div>
          <div className="text-right text-sm font-semibold">{eur(l.total_ht)} HT</div>
        </Card>
      ))}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {prestations.map((p) => (
            <button key={p.id} onClick={() => addLigne(p)} className="min-h-[44px] rounded-full bg-gray-100 px-3.5 py-1 text-xs text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ {p.nom}</button>
          ))}
          <button onClick={() => addLigne()} className="min-h-[44px] rounded-full bg-gray-100 px-3.5 py-1 text-xs text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Ligne libre</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input label="Nombre de colis" type="number" min="0" inputMode="numeric" value={nbColis} disabled={readOnly} onChange={(e) => setNbColis(e.target.value)} />
        <Input label="Poids total (kg)" type="number" step="0.1" min="0" value={poidsKg} disabled={readOnly} onChange={(e) => setPoidsKg(e.target.value)} />
      </div>

      <Textarea label="Note de livraison" placeholder="ex : livraison sur palette, 2 colis fragiles" value={note} disabled={readOnly} onChange={(e) => setNote(e.target.value)} />

      <Card className="flex flex-col gap-1 text-sm">
        {remiseMontant > 0 && (
          <>
            <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{eur(brutHt)}</span></div>
            <div className="flex justify-between text-gray-500">
              <span>
                Remise{remise?.type === "pct" ? ` (${remise.valeur} %)` : ""}
                {!readOnly && (
                  <button type="button" className="ml-2 min-h-[44px] rounded px-1 text-xs text-danger underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setRemise(null)}>retirer</button>
                )}
              </span>
              <span>− {eur(remiseMontant)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between"><span>Total HT</span><b>{eur(totaux.total_ht)}</b></div>
        <div className="flex justify-between text-gray-500"><span>TVA</span><span>{eur(totaux.total_tva)}</span></div>
        <div className="flex justify-between text-base"><span>Total TTC</span><b>{eur(totaux.total_ttc)}</b></div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!readOnly && (
        <Button
          taille="xl"
          disabled={saving || !clientId || lignes.length === 0}
          onClick={async () => {
            const id = await save();
            if (id && !blId) { router.push(`/bl/fiche/${id}`); router.refresh(); }
          }}
        >
          {saving ? "Enregistrement…" : blId ? "Enregistrer" : "Enregistrer le brouillon"}
        </Button>
      )}
    </div>
  );
}
