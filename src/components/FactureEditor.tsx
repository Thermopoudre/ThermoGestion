"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Select, Spinner } from "@/components/ui";
import { calcTotaux, estDeductionAcompte, estForfaitMinimum, eur, montantAcomptesDeduits, nombreFr, remiseAffichee, round2, sousTotalRemisable, uniteFr } from "@/lib/utils";
import { acomptesDeductibles, echeanceIso, joursPaiement, lignesDepuisDevis, lignesDeductionAcomptes, type AcompteDeductible } from "@/lib/calculs";
import { errorFr } from "@/lib/errors";
import { natureOperationDeduite, type NatureOperation } from "@/lib/nature-operation";
import type { Client, DevisItem, Prestation } from "@/lib/types";

type Remise = { type: "pct" | "montant"; valeur: number };
type DevisFacturable = { id: string; numero: string | null; client_id: string; items: DevisItem[]; remise: Remise | null; total_ttc: number };
type FactureLiee = AcompteDeductible & { devis_id: string | null };

const LIBELLE_NATURE: Record<NatureOperation, string> = {
  biens: "livraison de biens",
  services: "prestation de services",
  mixte: "opération mixte",
};

export default function FactureEditor({ factureId, devisInitial }: { factureId?: string; devisInitial?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [atelierId, setAtelierId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<"acompte" | "solde" | "libre" | "avoir">("solde");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  // Mention obligatoire de la facturation électronique. Elle n'est pas saisie mais déduite des
  // lignes (voir `natureDeduite` plus bas) ; ces deux états ne servent qu'à mémoriser une
  // correction assumée par l'atelier, qui doit survivre à un rechargement de la facture.
  const [natureForcee, setNatureForcee] = useState(false);
  const [natureChoisie, setNatureChoisie] = useState<NatureOperation>("services");
  const [items, setItems] = useState<DevisItem[]>([]);
  const [status, setStatus] = useState("brouillon");
  const [delaiAtelier, setDelaiAtelier] = useState<number | null>(null);
  const [devisSignes, setDevisSignes] = useState<DevisFacturable[]>([]);
  const [devisId, setDevisId] = useState("");
  const [projetId, setProjetId] = useState<string | null>(null);
  // Remise contractuelle négociée avec le client : portée par le devis, elle doit suivre sur la
  // facture, sinon rouvrir la facture recalcule les totaux au tarif plein.
  const [remise, setRemise] = useState<{ type: "pct" | "montant"; valeur: number } | null>(null);
  /** Factures déjà émises sur les devis signés : sert à distinguer un acompte d'un solde. */
  const [facturesDuDevis, setFacturesDuDevis] = useState<FactureLiee[]>([]);
  const [factureLieeId, setFactureLieeId] = useState<string | null>(null);
  /** Bons de livraison que cette facture va consommer, annoncés avant l'enregistrement. */
  const [blDuProjet, setBlDuProjet] = useState<{ numero: string | null; deja: boolean }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: cls }, { data: prs }, { data: at }, { data: dvs }, { data: dejaFactures }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("clients").select("*").eq("archive", false).order("nom"),
        supabase.from("prestations").select("*").eq("actif", true).order("ordre"),
        supabase.from("ateliers").select("delai_paiement_jours").maybeSingle(),
        supabase.from("devis").select("id, numero, client_id, items, remise, total_ttc").eq("status", "signe").order("signed_at", { ascending: false }),
        supabase.from("factures").select("id, devis_id, numero, type, status, items, emise_at, created_at").not("devis_id", "is", null),
      ]);
      setAtelierId(membre!.atelier_id);
      setDelaiAtelier((at as { delai_paiement_jours: number } | null)?.delai_paiement_jours ?? null);
      setClients((cls as Client[]) ?? []);
      setPrestations((prs as Prestation[]) ?? []);
      const liees = (dejaFactures as unknown as FactureLiee[]) ?? [];
      setFacturesDuDevis(liees);
      // Ce qui ferme un devis, c'est la facture qui règle le chantier — pas un acompte. Retirer
      // le devis dès la première facture rendait le solde impossible à produire (R6).
      const soldes = new Set(
        liees.filter((f) => ["solde", "libre"].includes(f.type) && f.status !== "annulee").map((f) => f.devis_id),
      );
      setDevisSignes((((dvs as DevisFacturable[]) ?? [])).filter((d) => !soldes.has(d.id)));
      if (factureId) {
        const { data: f } = await supabase.from("factures").select("*").eq("id", factureId).single();
        if (f) {
          setClientId(f.client_id);
          setType(f.type);
          setDueDate(f.due_date ?? "");
          setItems(f.items as DevisItem[]);
          setStatus(f.status);
          setDevisId(f.devis_id ?? "");
          setProjetId(f.projet_id ?? null);
          setRemise((f.remise as Remise | null) ?? null);
          setFactureLieeId(f.facture_liee_id ?? null);
          setNatureForcee(f.nature_operation_forcee === true);
          if (f.nature_operation) setNatureChoisie(f.nature_operation);
        }
      }
      setLoading(false);
    })();
  }, [factureId, supabase]);

  // Sous-total affiché avant remise : le complément de forfait minimum n'entre pas dans l'assiette,
  // il ne doit donc pas non plus gonfler le montant sur lequel la remise semble porter.
  const brutHt = items.filter((i) => !estForfaitMinimum(i)).reduce((s, i) => s + (i.total_ht || 0), 0);
  const totaux = calcTotaux(items, remise);
  const readOnly = status !== "brouillon";

  // D1 — même garde-fou que sur le devis : une remise hors bornes casse l'addition du
  // récapitulatif. Bornée à 0-100 % ou à 0-sous-total remisable en euros.
  useEffect(() => {
    if (!remise || remise.valeur == null || Number.isNaN(remise.valeur)) return;
    const max = remise.type === "pct" ? 100 : sousTotalRemisable(items);
    const borne = Math.min(Math.max(remise.valeur, 0), max);
    if (borne !== remise.valeur) setRemise({ ...remise, valeur: borne });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remise, items]);

  /**
   * Catégorie de l'opération lue dans les lignes. La base la recalcule de son côté à chaque
   * enregistrement (trigger `a_nature_operation`) : ce qui est affiché ici est un aperçu, pas la
   * règle. Tant que l'atelier ne corrige pas, les deux disent forcément la même chose.
   */
  const natureDeduite = useMemo(() => natureOperationDeduite(items, prestations), [items, prestations]);
  const natureOperation: NatureOperation = natureForcee ? natureChoisie : natureDeduite;

  /**
   * Le délai de paiement négocié avec le client prime sur celui de l'atelier : sans ça, une facture
   * pour un client à 45 jours sortait quand même avec une échéance à 30 jours, en contradiction
   * avec ce que le devis annonçait au même client.
   */
  function echeancePourClient(id: string) {
    const c = clients.find((x) => x.id === id);
    return echeanceIso(joursPaiement(c?.delai_paiement_jours, delaiAtelier));
  }

  function choisirClient(id: string) {
    setClientId(id);
    if (!id) return;
    setDueDate(echeancePourClient(id));
  }

  /**
   * Reprise d'un devis signé : lignes, client, échéance et rattachement au projet issu du devis.
   * Sans ce `projet_id`, l'indicateur « Facturé / Marge » de la fiche projet reste vide.
   */
  const choisirDevis = useCallback(async (id: string) => {
    setDevisId(id);
    if (!id) { setProjetId(null); setFactureLieeId(null); setBlDuProjet([]); return; }
    const d = devisSignes.find((x) => x.id === id);
    if (!d) return;
    setClientId(d.client_id);
    setDueDate(echeancePourClient(d.client_id));
    setRemise(d.remise ?? null);

    // Le solde reprend le chantier et déduit les acomptes déjà facturés, en ligne explicite : la
    // mention est attendue sur une facture de solde, et sans elle le client paie deux fois.
    const acomptes = acomptesDeductibles(facturesDuDevis.filter((f) => f.devis_id === id));
    setItems([...lignesDepuisDevis(d.items), ...lignesDeductionAcomptes(acomptes)]);
    setFactureLieeId(acomptes[acomptes.length - 1]?.id ?? null);
    if (acomptes.length > 0) setType("solde");

    const { data: proj } = await supabase.from("projets").select("id").eq("devis_id", id).maybeSingle();
    setProjetId(proj?.id ?? null);
    if (proj?.id) {
      const { data: bls } = await supabase.from("bons_livraison").select("numero, facture_id, status").eq("projet_id", proj.id);
      setBlDuProjet(((bls as { numero: string | null; facture_id: string | null }[]) ?? []).map((b) => ({ numero: b.numero, deja: b.facture_id != null })));
    } else setBlDuProjet([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisSignes, facturesDuDevis, clients, delaiAtelier, supabase]);

  // Arrivée depuis « Créer la facture » d'un devis : on préremplit dès que la liste est chargée.
  useEffect(() => {
    if (!devisInitial || factureId || loading || devisId) return;
    choisirDevis(devisInitial);
  }, [devisInitial, factureId, loading, devisId, choisirDevis]);

  function addItem(fromPrestation?: Prestation) {
    if (fromPrestation) {
      setItems([...items, { type: "prestation", libelle: fromPrestation.nom, qte: 1, unite: fromPrestation.unite, pu_ht: Number(fromPrestation.prix_unitaire_ht), tva: Number(fromPrestation.tva_rate), total_ht: Number(fromPrestation.prix_unitaire_ht), meta: { prestation_id: fromPrestation.id } }]);
    } else {
      setItems([...items, { type: "libre", libelle: "", qte: 1, unite: "piece", pu_ht: 0, tva: 20, total_ht: 0 }]);
    }
  }

  function updateItem(idx: number, patch: Partial<DevisItem>) {
    const next = [...items];
    const it = { ...next[idx], ...patch };
    it.total_ht = round2(it.qte * it.pu_ht);
    next[idx] = it;
    setItems(next);
  }

  async function save(): Promise<string | null> {
    setSaving(true);
    setError("");
    const payload = {
      client_id: clientId, type, due_date: dueDate || null, items, ...totaux,
      // La valeur envoyée n'est retenue par la base que si la correction est assumée ; sinon le
      // trigger la remplace par la déduction faite sur les lignes.
      nature_operation: natureOperation, nature_operation_forcee: natureForcee,
      devis_id: devisId || null, projet_id: projetId, remise,
      // Colonne longtemps morte : elle porte le lien acompte → solde, imprimé sur le document.
      //
      // Depuis C3 elle porte aussi le lien avoir → facture d'origine, et c'est lui qui alimente le
      // plafond des avoirs en base. Le tester uniquement sur la présence d'une ligne de déduction
      // d'acompte effaçait ce lien au premier enregistrement de l'avoir : l'avoir devenait orphelin,
      // le plafond ne le comptait plus, et on pouvait créditer deux fois la même facture.
      facture_liee_id: type === "avoir" || items.some(estDeductionAcompte) ? factureLieeId : null,
    };
    if (factureId) {
      const { error: err } = await supabase.from("factures").update(payload).eq("id", factureId);
      setSaving(false);
      if (err) { setError(errorFr(err)); return null; }
      return factureId;
    }
    const { data, error: err } = await supabase.from("factures").insert({ ...payload, atelier_id: atelierId }).select("id").single();
    setSaving(false);
    if (err) { setError(errorFr(err)); return null; }
    return data.id;
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {/* Le rappel du devis d'origine ne doit pas devenir un sélecteur sur une facture déjà
          créée : le devis repris n'est plus dans la liste (il est facturé) et le champ afficherait
          « facture libre » à tort. */}
      {factureId && devisId && (
        <p className="text-xs text-gray-500">Facture issue du devis repris à sa signature.</p>
      )}
      {!factureId && devisSignes.length > 0 && (
        <Card className="border-brand/30 bg-brand-light">
          <Select label="Reprendre un devis signé" value={devisId} disabled={readOnly} onChange={(e) => choisirDevis(e.target.value)}>
            <option value="">— Facture libre (sans devis) —</option>
            {devisSignes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.numero ?? "Devis"} — {clients.find((c) => c.id === d.client_id)?.nom ?? ""} — {eur(d.total_ttc)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-gray-600">
            Reprend les lignes, le client et l&apos;échéance négociée, et rattache la facture au projet du devis.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Select label="Client *" value={clientId} disabled={readOnly} onChange={(e) => choisirClient(e.target.value)}>
          <option value="">— Choisir un client —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        <Select label="Type" value={type} disabled={readOnly} onChange={(e) => setType(e.target.value as typeof type)}>
          {/* Vocabulaire de comptable au deuxième champ d'un formulaire d'artisan : chaque
              intitulé dit ce que le document fait, pas comment il s'appelle en comptabilité. */}
          <option value="solde">Facture (solde du chantier)</option>
          <option value="acompte">Facture d&apos;acompte</option>
          <option value="libre">Facture libre (sans devis)</option>
          <option value="avoir">Avoir (annulation ou remboursement)</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Échéance" type="date" value={dueDate} disabled={readOnly} onChange={(e) => setDueDate(e.target.value)} />
        <Select
          label="Nature de l'opération"
          value={natureOperation}
          disabled={readOnly}
          onChange={(e) => {
            const v = e.target.value as NatureOperation;
            setNatureChoisie(v);
            // Revenir sur la valeur déduite, c'est renoncer à la correction : la facture repart
            // sur ses lignes et suivra leurs évolutions.
            setNatureForcee(v !== natureDeduite);
          }}
        >
          <option value="services">Prestation de services</option>
          <option value="biens">Livraison de biens</option>
          <option value="mixte">Opération mixte</option>
        </Select>
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Mention obligatoire sur les factures depuis la réforme de la facturation électronique. Elle
        est déduite des lignes : le laquage de pièces est une prestation, la revente de poudre est
        une livraison de biens, et une facture qui mélange les deux est mixte.{" "}
        {natureForcee ? (
          <span className="text-amber-700">
            Corrigée à la main : les lignes disent « {LIBELLE_NATURE[natureDeduite]} ».
          </span>
        ) : (
          "Vous pouvez la corriger si votre cas particulier l'exige."
        )}
      </p>

      {/* R4 — le rattachement des bons de livraison est fait par la base à l'enregistrement.
          L'annoncer ici évite qu'un atelier découvre après coup pourquoi son bon a disparu de la
          récapitulative du mois. */}
      {blDuProjet.length > 0 && (
        <Card className="border-gray-300 bg-gray-50 text-xs text-gray-700">
          {blDuProjet.some((b) => !b.deja) ? (
            <>
              Cette facture consommera {blDuProjet.filter((b) => !b.deja).length} bon
              {blDuProjet.filter((b) => !b.deja).length > 1 ? "s" : ""} de livraison du chantier
              ({blDuProjet.filter((b) => !b.deja).map((b) => b.numero ?? "brouillon").join(", ")}) :
              ils ne repartiront plus dans la facture récapitulative du mois.
            </>
          ) : (
            <>
              Les bons de livraison de ce chantier ({blDuProjet.map((b) => b.numero ?? "brouillon").join(", ")})
              sont <b>déjà portés par une autre facture</b>. Vérifiez que vous ne facturez pas deux fois le même chantier.
            </>
          )}
        </Card>
      )}

      {items.map((it, i) => (
        estDeductionAcompte(it) ? (
          // Une déduction d'acompte n'est pas une prestation : elle se retire, elle ne se retouche pas.
          <Card key={i} className="flex flex-col gap-1 border-green-200 bg-green-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-green-800">Acompte déduit</span>
              {!readOnly && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="min-h-[44px] rounded px-1 text-xs text-danger underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Supprimer</button>}
            </div>
            <p className="text-xs text-green-900">{it.libelle} — TVA {nombreFr(it.tva)} %</p>
            <div className="text-right text-sm font-semibold text-green-900">{eur(it.total_ht)} HT</div>
          </Card>
        ) : estForfaitMinimum(it) ? (
          // Le complément de forfait minimum n'est pas une prestation vendue : il se supprime,
          // mais il ne se retouche pas ligne à ligne — sinon il ne relève plus rien.
          <Card key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Forfait minimum</span>
              {!readOnly && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="min-h-[44px] rounded px-1 text-xs text-danger underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Supprimer</button>}
            </div>
            <p className="text-xs text-gray-500">
              Complément portant le devis au minimum de facturation de la grille
              {it.meta?.plancher != null ? ` (${eur(Number(it.meta.plancher))})` : ""}. Il n&apos;entre pas
              dans l&apos;assiette de la remise.
            </p>
            <div className="text-right text-sm font-semibold">{eur(it.total_ht)} HT</div>
          </Card>
        ) : (
        <Card key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">{it.type === "prestation" ? "Prestation" : "Ligne libre"}</span>
            {!readOnly && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="min-h-[44px] rounded px-1 text-xs text-danger underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Supprimer</button>}
          </div>
          <Input placeholder="Libellé" value={it.libelle} disabled={readOnly} onChange={(e) => updateItem(i, { libelle: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input label={`Qté (${uniteFr(it.unite)})`} type="number" step="0.01" min="0" value={it.qte} disabled={readOnly} onChange={(e) => updateItem(i, { qte: Number(e.target.value) })} />
            <Input label="PU HT €" type="number" step="0.01" value={it.pu_ht} disabled={readOnly} onChange={(e) => updateItem(i, { pu_ht: Number(e.target.value) })} />
            <Input label="TVA %" type="number" step="0.1" value={it.tva} disabled={readOnly} onChange={(e) => updateItem(i, { tva: Number(e.target.value) })} />
          </div>
          <div className="text-right text-sm font-semibold">{eur(it.total_ht)} HT</div>
        </Card>
        )
      ))}

      {!readOnly && (
        <div className="flex flex-col gap-2">
          {prestations.length > 0 && (
            <span className="text-xs font-medium text-gray-500">Vos prestations — un appui ajoute la ligne</span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {prestations.map((p) => (
              <button key={p.id} type="button" onClick={() => addItem(p)} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 transition duration-150 ease-out hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ {p.nom}</button>
            ))}
            {/* Noyé au milieu des prestations, « + Ligne libre » passait pour une quinzième
                prestation : il est séparé et porte le style d'une action, pas d'un choix. */}
            <button type="button" onClick={() => addItem()} className="rounded-full border border-dashed border-gray-400 px-3 py-1.5 text-xs font-medium text-gray-700 transition duration-150 ease-out hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Ligne libre</button>
          </div>
        </div>
      )}

      {!readOnly && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Remise</div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Valeur" type="number" step="0.01" min="0" max={remise?.type === "montant" ? sousTotalRemisable(items) : 100}
              value={remise?.valeur ?? ""}
              onChange={(e) => {
                if (e.target.value === "") { setRemise(null); return; }
                const type = remise?.type ?? "pct";
                // Bornée tout de suite : `min`/`max` sur ce champ ne suffisent pas (ChampDecimal
                // rend un `<input type="text">`, voir D5).
                const max = type === "pct" ? 100 : sousTotalRemisable(items);
                const valeur = Math.min(Math.max(Number(e.target.value) || 0, 0), max);
                setRemise(valeur === 0 ? null : { type, valeur });
              }}
            />
            <Select
              label="Unité"
              value={remise?.type ?? "pct"}
              onChange={(e) => {
                if (!remise) return;
                const type = e.target.value as "pct" | "montant";
                const max = type === "pct" ? 100 : sousTotalRemisable(items);
                setRemise({ type, valeur: Math.min(remise.valeur, max) });
              }}
            >
              <option value="pct">% du total</option>
              <option value="montant">€ HT</option>
            </Select>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-1 text-sm">
        {remise && remise.valeur > 0 && (
          <>
            <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{eur(round2(brutHt))}</span></div>
            <div className="flex justify-between text-gray-500">
              <span>Remise{remise.type === "pct" ? ` (${nombreFr(remise.valeur)} %)` : ""}</span>
              <span>− {eur(remiseAffichee(items, remise, totaux.total_ht))}</span>
            </div>
          </>
        )}
        {montantAcomptesDeduits(items) > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Acompte(s) déjà facturé(s)</span>
            <span>− {eur(montantAcomptesDeduits(items))}</span>
          </div>
        )}
        <div className="flex justify-between"><span>Total HT</span><b>{eur(totaux.total_ht)}</b></div>
        <div className="flex justify-between text-gray-500"><span>TVA</span><span>{eur(totaux.total_tva)}</span></div>
        <div className="flex justify-between text-base"><span>Total TTC{montantAcomptesDeduits(items) > 0 ? " restant dû" : ""}</span><b>{eur(totaux.total_ttc)}</b></div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!readOnly && (
        <Button
          disabled={saving || !clientId || items.length === 0}
          onClick={async () => {
            const id = await save();
            if (id) { router.push(`/factures/${id}`); router.refresh(); }
          }}
        >
          {saving ? "Enregistrement…" : factureId ? "Enregistrer" : "Enregistrer le brouillon"}
        </Button>
      )}
    </div>
  );
}
