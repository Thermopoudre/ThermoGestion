"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Input, Select, Spinner, Textarea } from "@/components/ui";
import ConfirmModal from "@/components/Modal";
import { calcTotaux, eur, heureFr, nombreFr, remiseAffichee, round2, uniteFr } from "@/lib/utils";
import { errorFr } from "@/lib/errors";
import {
  appliquerForfaitMinimum,
  coucheParDefaut,
  couchesDisponibles,
  lignesFacturables,
  lignesSaisies,
  metrageTotal,
  montantAcompte,
  prixM2 as prixM2Grille,
  prixNegocie,
  prixPieceType,
  surfaceDeveloppee,
} from "@/lib/calculs";
import {
  DESSINS_JANTE_DEFAUT,
  FINITIONS_JANTE_DEFAUT,
  libelleJeu,
  ligneJeuJantes,
  prixJante,
  surfaceJante,
} from "@/lib/jantes";
import type { Client, ClientTarif, Devis, DevisItem, Grille, GrilleCoef, GrillePalier, JantePalier, PieceType, Prestation, TarifMl } from "@/lib/types";

/**
 * Le modèle de ligne ne connaît que trois types (prestation | m2 | libre). Une ligne au mètre
 * linéaire est donc une ligne libre marquée dans son `meta` : elle reste consommable telle quelle
 * par la facture et le PDF, tout en gardant ici son éditeur dédié.
 */
function estLigneMl(it: DevisItem) {
  return it.type === "libre" && it.meta?.ml === true;
}

/** Même mécanique pour un jeu de jantes : ligne libre marquée, éditeur dédié, aval inchangé. */
function estLigneJante(it: DevisItem) {
  return it.type === "libre" && it.meta?.jante === true;
}

export default function DevisEditor({ devisId, statutCourant }: { devisId?: string; statutCourant?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [atelierId, setAtelierId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [grilles, setGrilles] = useState<Grille[]>([]);
  const [paliers, setPaliers] = useState<GrillePalier[]>([]);
  const [coefs, setCoefs] = useState<GrilleCoef[]>([]);
  const [tarifsMl, setTarifsMl] = useState<TarifMl[]>([]);
  const [janteP, setJanteP] = useState<JantePalier[]>([]);
  const [piecesTypes, setPiecesTypes] = useState<PieceType[]>([]);
  // Prix négociés prestation par prestation, propres à un client (accord le plus précis, cf. prixNegocie).
  const [clientTarifs, setClientTarifs] = useState<ClientTarif[]>([]);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<DevisItem[]>([]);
  const [remise, setRemise] = useState<Devis["remise"]>(null);
  // Acompte à la commande (C1) : % du total TTC, demandé à la signature. `null`/0 = pas d'acompte.
  const [acomptePct, setAcomptePct] = useState<number | null>(null);
  // Mémorise que la remise affichée vient du contrat du client et non d'une saisie : sans ça,
  // changer de client laisserait traîner la remise du précédent.
  const [remiseAuto, setRemiseAuto] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("brouillon");

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: cls }, { data: prs }, { data: grs }, { data: pl }, { data: cf }, { data: ml }, { data: pt }, { data: ct }, { data: jp }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("clients").select("*").eq("archive", false).order("nom"),
        supabase.from("prestations").select("*").eq("actif", true).order("ordre"),
        // Toutes les grilles actives, pas seulement la standard : un client sous contrat peut
        // avoir la sienne.
        supabase.from("grilles_tarifaires").select("*").eq("actif", true).order("nom"),
        supabase.from("grille_paliers").select("*").order("surface_min"),
        supabase.from("grille_coefs").select("*"),
        supabase.from("tarifs_ml").select("*").eq("actif", true).order("ordre"),
        supabase.from("pieces_types").select("*").eq("actif", true).order("ordre"),
        supabase.from("client_tarifs").select("*"),
        supabase.from("jante_paliers").select("*").order("diametre_min"),
      ]);
      setAtelierId(membre!.atelier_id);
      setJanteP((jp as JantePalier[]) ?? []);
      setClients((cls as Client[]) ?? []);
      setPrestations((prs as Prestation[]) ?? []);
      setGrilles((grs as Grille[]) ?? []);
      setPaliers((pl as GrillePalier[]) ?? []);
      setCoefs((cf as GrilleCoef[]) ?? []);
      setTarifsMl((ml as TarifMl[]) ?? []);
      setPiecesTypes((pt as PieceType[]) ?? []);
      setClientTarifs((ct as ClientTarif[]) ?? []);
      if (devisId) {
        const { data: d } = await supabase.from("devis").select("*").eq("id", devisId).single();
        if (d) {
          setClientId(d.client_id);
          // La ligne de forfait minimum n'est pas une ligne saisie : elle est retirée à
          // l'ouverture et recalculée à chaque chiffrage, sinon elle s'empilerait.
          setItems(lignesSaisies(d.items as DevisItem[]));
          setRemise((d.remise as Devis["remise"]) ?? null);
          setAcomptePct(d.acompte_pct ?? null);
          setNotes(d.notes ?? "");
          setStatus(d.status);
        }
      }
      setLoading(false);
    })();
  }, [devisId, supabase]);

  const clientCourant = clients.find((c) => c.id === clientId) ?? null;
  const grilleDefaut = grilles.find((g) => g.is_default) ?? null;
  // Le prix au m² dépend du client : sa grille négociée prime sur la grille standard de l'atelier.
  const grille = (clientCourant?.grille_id ? grilles.find((g) => g.id === clientCourant.grille_id) : null) ?? grilleDefaut;

  // Plancher de facturation de la grille appliquée au client : le complément est matérialisé en
  // ligne pour que le client lise sur son devis pourquoi il paie 50 € et non 13,50 €.
  //
  // C5 — une ligne « en option » n'est pas vendue tant que le client ne l'a pas retenue à la
  // signature : elle n'entre ni dans le plancher de facturation, ni dans le total. Elle reste
  // visible et modifiable dans l'éditeur (elle vit dans `items`), simplement écartée du chiffrage.
  const itemsFacturables = lignesFacturables(items);
  const itemsOptionnels = items.filter((it) => it.optionnel);
  const forfaitMinimum = Number(grille?.forfait_minimum ?? 0);
  const { items: itemsChiffres, complement, plancher } = appliquerForfaitMinimum({ items: itemsFacturables, remise, forfaitMinimum });
  const totaux = calcTotaux(itemsChiffres, remise);
  const brutHt = round2(itemsFacturables.reduce((s, i) => s + (i.total_ht || 0), 0));
  // C1 — montant de l'acompte à la commande, calculé sur le total TTC réel du devis.
  const montantAcompteApercu = montantAcompte(totaux.total_ttc, acomptePct);

  // D1 — une remise hors bornes casse l'addition du récapitulatif (100 % ne s'additionne plus une
  // fois le forfait minimum ajouté ; une remise négative gonfle le total sans aucune ligne pour
  // l'expliquer). Bornée ici en plus de la contrainte en base : 0-100 % du sous-total, ou 0 à ce
  // même sous-total en euros — jamais plus que ce qu'il y a à remiser.
  useEffect(() => {
    if (!remise || remise.valeur == null || Number.isNaN(remise.valeur)) return;
    const max = remise.type === "pct" ? 100 : brutHt;
    const borne = Math.min(Math.max(remise.valeur, 0), max);
    if (borne !== remise.valeur) setRemise({ ...remise, valeur: borne });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remise, brutHt]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  /**
   * Ligne dont la suppression est en attente de confirmation.
   *
   * Le `confirm()` natif du navigateur était le seul de l'application : il bloque le fil
   * d'exécution, ignore la charte, n'est pas traduit (« OK » / « Annuler » suivent la langue du
   * navigateur, pas celle du devis), et sur iOS il s'affiche avec le nom de domaine en titre —
   * sur un devis client, ça ressemble à une alerte de sécurité. `ConfirmModal` fait la même chose
   * en restant dans le produit, avec Échap, le piège de focus et le libellé exact de la ligne.
   */
  const [ligneASupprimer, setLigneASupprimer] = useState<number | null>(null);

  // Autosave (mode édition uniquement)
  useEffect(() => {
    if (!devisId || loading || (statutCourant ?? status) !== "brouillon" || !clientId || items.length === 0) return;
    const t = setTimeout(async () => {
      const ok = await save();
      if (ok) setSavedAt(new Date());
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, clientId, notes, remise, acomptePct]);

  // Le statut est chargé une fois au montage : quand la page parente finalise le devis, elle nous
  // repasse le statut à jour, sinon l'éditeur resterait modifiable sur un devis déjà envoyé.
  const statutEffectif = statutCourant ?? status;
  const readOnly = statutEffectif !== "brouillon";

  function prixM2(surface: number, finition: string, complexite: string, couche: string | null, grilleId: string | undefined = grille?.id) {
    return prixM2Grille({ surface, finition, complexite, couche, grilleId, paliers, coefs });
  }

  /** Choisir un client, c'est appliquer ses conditions négociées : grille dédiée et remise contractuelle. */
  function choisirClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id) ?? null;
    const gid = (c?.grille_id && grilles.some((g) => g.id === c.grille_id)) ? c.grille_id : grilleDefaut?.id;
    // Les lignes déjà saisies sont rechiffrées : deux clients ne paient pas le même prix, que ce
    // soit via la grille m² dédiée ou via un tarif négocié prestation par prestation.
    setItems(items.map((it) => {
      if (it.type === "m2") {
        const surface = Number(it.meta?.surface ?? 0);
        // La grille change avec le client : la couche choisie n'existe pas forcément dans la
        // nouvelle, on retombe alors sur sa couche par défaut plutôt que sur un coefficient muet.
        const couche = couchesDisponibles(coefs, gid).some((c) => c.code === it.meta?.couche)
          ? String(it.meta?.couche)
          : coucheParDefaut(coefs, gid);
        const pu = prixM2(surface, String(it.meta?.finition ?? "mat"), String(it.meta?.complexite ?? "simple"), couche, gid);
        const coefPiece = it.meta?.piece_type_id ? piecesTypes.find((p) => p.id === it.meta?.piece_type_id) : undefined;
        const puFinal = coefPiece ? prixPieceType(coefPiece, pu) : pu;
        return { ...it, pu_ht: puFinal, total_ht: round2(surface * puFinal), meta: { ...it.meta, couche, grille_id: gid } };
      }
      if (it.type === "prestation" && it.meta?.prestation_id) {
        const p = prestations.find((x) => x.id === it.meta?.prestation_id);
        if (!p) return it;
        const { pu, negocie } = prixNegocie(p, id, clientTarifs, it.qte);
        return { ...it, pu_ht: pu, total_ht: round2(it.qte * pu), meta: { ...it.meta, tarif_negocie: negocie } };
      }
      return it;
    }));
    const pct = c?.remise_pct != null ? Number(c.remise_pct) : 0;
    if (pct > 0) {
      setRemise({ type: "pct", valeur: pct });
      setRemiseAuto(true);
    } else if (remiseAuto) {
      setRemise(null);
      setRemiseAuto(false);
    }
  }

  function addItem(type: DevisItem["type"]) {
    if (type === "prestation") {
      const p = prestations[0];
      const { pu, negocie } = p ? prixNegocie(p, clientId, clientTarifs) : { pu: 0, negocie: false };
      setItems([...items, { type, libelle: p?.nom ?? "", qte: 1, unite: p?.unite ?? "piece", pu_ht: pu, tva: Number(p?.tva_rate ?? 20), total_ht: pu, meta: { prestation_id: p?.id, tarif_negocie: negocie } }]);
    } else if (type === "m2") {
      const couche = coucheParDefaut(coefs, grille?.id);
      const pu = prixM2(1, "mat", "simple", couche);
      setItems([...items, { type, libelle: "Thermolaquage", qte: 1, unite: "m2", pu_ht: pu, tva: 20, total_ht: pu, meta: { surface: 1, finition: "mat", complexite: "simple", couche, grille_id: grille?.id } }]);
    } else {
      setItems([...items, { type, libelle: "", qte: 1, unite: "piece", pu_ht: 0, tva: 20, total_ht: 0 }]);
    }
  }

  function addLigneMl() {
    const t = tarifsMl[0];
    if (!t) return;
    const per = t.perimetre_developpe_m != null ? Number(t.perimetre_developpe_m) : null;
    setItems([...items, {
      type: "libre",
      libelle: t.famille,
      qte: 1,
      unite: "ml",
      pu_ht: Number(t.prix_ml),
      tva: 20,
      total_ht: round2(Number(t.prix_ml)),
      meta: { ml: true, tarif_ml_id: t.id, perimetre_developpe_m: per, surface_equivalente_m2: per != null ? round2(per) : null },
    }]);
  }

  /**
   * Jeu de jantes chiffré au barème du pouce.
   *
   * La ligne créée est une ligne libre marquée `meta.jante`, avec la quantité en jantes et le prix
   * unitaire à la jante : le client lit « 4 × 224 € » et peut recalculer son devis. `meta.surface_m2`
   * porte la surface d'UNE jante, celle que le projet multipliera par la quantité — la porter pour
   * le jeu entier quadruplerait la poudre, l'énergie et la charge du four.
   */
  function ajouterJeuJantes() {
    setItems([...items, ligneJeuJantes({
      nbJantes: 4, diametre: 19, dessin: "standard", finition: "unie",
      grilleId: grille?.id, paliers: janteP, coefs,
      finitionsLibelles: Object.fromEntries(coefs.filter((c) => c.categorie === "jante_finition").map((c) => [c.code, c.libelle])),
    })]);
  }

  /** Rechiffrage d'une ligne de jantes après changement d'une de ses caractéristiques. */
  function majJante(idx: number, patch: Record<string, unknown>) {
    const it = items[idx];
    const meta = { ...it.meta, ...patch };
    const nb = Number(patch.nb_jantes ?? it.qte) || 1;
    setItems(items.map((x, i) => i !== idx ? x : ligneJeuJantes({
      nbJantes: nb,
      diametre: Number(meta.diametre_pouces) || 0,
      dessin: meta.dessin as string | null,
      finition: meta.finition as string | null,
      teinte: meta.teinte as string | null,
      teinteReference: meta.teinte_reference as string | null,
      vehiculeId: (meta.vehicule_id as string | null) ?? null,
      jeuId: (meta.jeu_jantes_id as string | null) ?? null,
      tva: it.tva,
      grilleId: (meta.grille_id as string | null) ?? grille?.id,
      paliers: janteP,
      coefs,
      finitionsLibelles: Object.fromEntries(coefs.filter((c) => c.categorie === "jante_finition").map((c) => [c.code, c.libelle])),
    })));
  }

  /**
   * Ajout d'une pièce de la bibliothèque. Son `coef_complexite` majore le prix dans les deux cas :
   * une jante à voile creux se laque plus lentement qu'une jante plate de même surface.
   */
  function ajouterPieceType(p: PieceType) {
    const base = { piece_type_id: p.id, temps_minutes: p.temps_minutes, coef_complexite: p.coef_complexite };
    // Prix catalogue renseigné : c'est le prix annoncé au client, majoré de son coefficient.
    if (p.prix_ht != null) {
      const pu = prixPieceType(p, Number(p.prix_ht));
      setItems([...items, { type: "libre", libelle: p.nom, qte: 1, unite: "piece", pu_ht: pu, tva: 20, total_ht: round2(pu), meta: { ...base, surface_m2: p.surface_m2 } }]);
      return;
    }
    // Sinon on retombe sur la grille au m² : la surface de la pièce est déjà connue, c'est
    // justement ce que la bibliothèque fait gagner.
    const surface = Number(p.surface_m2 ?? 0);
    const couche = coucheParDefaut(coefs, grille?.id);
    const pu = prixPieceType(p, prixM2(surface, "mat", "simple", couche));
    setItems([...items, { type: "m2", libelle: p.nom, qte: surface, unite: "m2", pu_ht: pu, tva: 20, total_ht: round2(surface * pu), meta: { ...base, surface, finition: "mat", complexite: "simple", couche, grille_id: grille?.id } }]);
  }

  function updateItem(idx: number, patch: Partial<DevisItem> & { meta?: Record<string, unknown> }) {
    const next = [...items];
    const it = { ...next[idx], ...patch, meta: { ...next[idx].meta, ...patch.meta } };
    if (it.type === "m2") {
      const surface = Number(it.meta?.surface ?? 0);
      it.qte = surface;
      const pu = prixM2(
        surface,
        String(it.meta?.finition ?? "mat"),
        String(it.meta?.complexite ?? "simple"),
        it.meta?.couche != null ? String(it.meta.couche) : null,
        String(it.meta?.grille_id ?? grille?.id ?? "") || undefined,
      );
      // Une ligne issue de la bibliothèque garde la majoration propre à la pièce.
      const piece = it.meta?.piece_type_id ? piecesTypes.find((p) => p.id === it.meta?.piece_type_id) : undefined;
      it.pu_ht = piece ? prixPieceType(piece, pu) : pu;
    }
    // C5 — un palier de quantité change le prix unitaire dès que la quantité franchit un seuil :
    // sans ce recalcul, la ligne restait au prix du premier palier saisi, même une fois la
    // quantité relevée au-delà d'un palier plus avantageux.
    if (it.type === "prestation" && it.meta?.prestation_id && patch.qte !== undefined) {
      const p = prestations.find((x) => x.id === it.meta?.prestation_id);
      if (p) {
        const { pu, negocie } = prixNegocie(p, clientId, clientTarifs, it.qte);
        it.pu_ht = pu;
        it.meta = { ...it.meta, tarif_negocie: negocie };
      }
    }
    if (estLigneMl(it)) {
      // Surface développée = métrage × périmètre du profilé : c'est ce chiffre qui sert à
      // l'atelier pour estimer la poudre à commander.
      const per = it.meta?.perimetre_developpe_m;
      it.meta = { ...it.meta, surface_equivalente_m2: per != null ? round2(it.qte * Number(per)) : null };
    }
    it.total_ht = round2(it.qte * it.pu_ht);
    next[idx] = it;
    setItems(next);
  }

  async function save(): Promise<string | null> {
    setSaving(true);
    setError("");
    // C'est bien le devis chiffré — plancher inclus — qui est enregistré, pas les seules lignes
    // saisies. Les lignes optionnelles sont recopiées telles quelles à la suite : leur prix reste
    // affiché mais elles ne pèsent pas dans `totaux` (calculé sur `itemsChiffres` seul).
    const payload = {
      client_id: clientId,
      items: [...itemsChiffres, ...itemsOptionnels],
      remise,
      acompte_pct: acomptePct,
      notes: notes || null,
      ...totaux,
    };
    if (devisId) {
      const { error: err } = await supabase.from("devis").update(payload).eq("id", devisId);
      if (err) { setError(errorFr(err)); setSaving(false); return null; }
      setSaving(false);
      return devisId;
    }
    const { data, error: err } = await supabase.from("devis").insert({ ...payload, atelier_id: atelierId }).select("id").single();
    setSaving(false);
    if (err) { setError(errorFr(err)); return null; }
    return data.id;
  }

  if (loading) return <Spinner />;

  const finitions = coefs.filter((c) => c.grille_id === grille?.id && c.categorie === "finition");
  const complexites = coefs.filter((c) => c.grille_id === grille?.id && c.categorie === "complexite");
  // Le sélecteur de couches n'apparaît que si la grille en déclare : un atelier qui laque toujours
  // en une passe n'a pas à voir un champ de plus.
  const couches = couchesDisponibles(coefs, grille?.id);
  const grilleDediee = !!clientCourant?.grille_id && grille?.id === clientCourant.grille_id && !grille?.is_default;

  return (
    <div className="flex flex-col gap-4">
      <Select label="Client *" value={clientId} onChange={(e) => choisirClient(e.target.value)} disabled={readOnly}>
        <option value="">— Choisir un client —</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </Select>

      {clientCourant && (grilleDediee || clientCourant.facturation_mensuelle || clientCourant.delai_paiement_jours != null) && (
        <div className="-mt-2 rounded-lg bg-brand-light px-3 py-2 text-xs text-brand-dark">
          {grilleDediee && <div>Grille dédiée appliquée : <b>{grille?.nom}</b></div>}
          {clientCourant.facturation_mensuelle && <div>Client en facturation mensuelle récapitulative</div>}
          {clientCourant.delai_paiement_jours != null && <div>Paiement à {clientCourant.delai_paiement_jours} jours</div>}
        </div>
      )}

      {items.map((it, i) => (
        <Card key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
              {estLigneJante(it) ? "Jeu de jantes" : estLigneMl(it) ? "Au mètre linéaire" : it.type === "m2" ? "Calcul au m²" : it.type === "prestation" ? "Prestation" : "Ligne libre"}
              {it.optionnel && <Badge tone="info">En option</Badge>}
            </span>
            <div className="flex items-center gap-3">
              {/* C5 — une ligne « en option » n'est pas comptée dans le total tant que le client ne
                  l'a pas retenue à la signature. `option_id` l'identifie de façon stable : il ne
                  bouge pas si le libellé est corrigé ensuite. */}
              {!readOnly && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!it.optionnel}
                    onChange={(e) => {
                      const optionnel = e.target.checked;
                      updateItem(i, {
                        optionnel,
                        option_id: optionnel ? (it.option_id ?? crypto.randomUUID()) : undefined,
                      });
                    }}
                  />
                  En option
                </label>
              )}
              {!readOnly && (
                // Confirmation : le bouton est à l'endroit exact où l'œil se pose en premier sur le
                // bloc, et une ligne de devis effacée par mégarde se resaisit en entier.
                <button
                  type="button"
                  onClick={() => setLigneASupprimer(i)}
                  className="rounded px-1 text-xs text-gray-500 underline underline-offset-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
          {estLigneJante(it) ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Select label="Nombre" value={String(it.qte)} disabled={readOnly} onChange={(e) => majJante(i, { nb_jantes: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} jante{n > 1 ? "s" : ""}</option>)}
                </Select>
                <Input
                  label="Diamètre (″)" type="number" step="0.5" min="12" max="26"
                  value={String(it.meta?.diametre_pouces ?? "")}
                  disabled={readOnly}
                  onChange={(e) => {
                    // D5 — une jante à 0 pouce se chiffrait quand même (palier 0-17 de la grille) :
                    // le bouton n'affichait aucune erreur, la ligne partait à un prix inventé. Bornée
                    // ici comme en base (`jeux_jantes_diametre_pouces_check`, 12-26).
                    if (e.target.value === "") { majJante(i, { diametre_pouces: 0 }); return; }
                    majJante(i, { diametre_pouces: Math.min(Math.max(Number(e.target.value) || 0, 12), 26) });
                  }}
                />
                <Input label="PU HT €/jante" type="number" step="0.01" value={it.pu_ht} disabled={readOnly} onChange={(e) => updateItem(i, { pu_ht: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select label="Dessin" value={String(it.meta?.dessin ?? "standard")} disabled={readOnly} onChange={(e) => majJante(i, { dessin: e.target.value })}>
                  {(coefs.filter((c) => c.grille_id === grille?.id && c.categorie === "jante_dessin").length
                    ? coefs.filter((c) => c.grille_id === grille?.id && c.categorie === "jante_dessin")
                    : DESSINS_JANTE_DEFAUT).map((d) => <option key={d.code} value={d.code}>{d.libelle}</option>)}
                </Select>
                <Select label="Finition" value={String(it.meta?.finition ?? "unie")} disabled={readOnly} onChange={(e) => majJante(i, { finition: e.target.value })}>
                  {(coefs.filter((c) => c.grille_id === grille?.id && c.categorie === "jante_finition").length
                    ? coefs.filter((c) => c.grille_id === grille?.id && c.categorie === "jante_finition")
                    : FINITIONS_JANTE_DEFAUT).map((f) => <option key={f.code} value={f.code}>{f.libelle}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Teinte (ex. Frozen Grey)" value={String(it.meta?.teinte ?? "")} disabled={readOnly} onChange={(e) => majJante(i, { teinte: e.target.value || null })} />
                <Input label="Réf. constructeur (ex. C3Z)" value={String(it.meta?.teinte_reference ?? "")} disabled={readOnly} onChange={(e) => majJante(i, { teinte_reference: e.target.value || null })} />
              </div>
              <p className="text-xs text-gray-500">
                {it.libelle} — surface à laquer : <b>{nombreFr(Number(it.meta?.surface_m2 ?? 0) * it.qte)} m²</b>.
                {" "}Les opérations mécaniques (dévoilage, pneus, TPMS…) s&apos;ajoutent en prestations.
              </p>
              {prixJante({ diametre: Number(it.meta?.diametre_pouces ?? 0), dessin: String(it.meta?.dessin ?? ""), finition: String(it.meta?.finition ?? ""), grilleId: grille?.id, paliers: janteP, coefs }) === 0 && (
                <p className="text-xs text-amber-600">
                  Aucune tranche de diamètre ne couvre cette jante dans votre barème : saisissez le prix
                  à la main, ou complétez Réglages → Jantes.
                </p>
              )}
            </>
          ) : estLigneMl(it) ? (
            <>
              <Select label="Famille de profilé" value={String(it.meta?.tarif_ml_id ?? "")} disabled={readOnly} onChange={(e) => {
                const t = tarifsMl.find((x) => x.id === e.target.value);
                if (!t) return;
                const per = t.perimetre_developpe_m != null ? Number(t.perimetre_developpe_m) : null;
                updateItem(i, { libelle: t.famille, unite: "ml", pu_ht: Number(t.prix_ml), meta: { tarif_ml_id: t.id, perimetre_developpe_m: per } });
              }}>
                {tarifsMl.map((t) => <option key={t.id} value={t.id}>{t.famille} — {eur(Number(t.prix_ml))}/ml</option>)}
              </Select>
              <div className="grid grid-cols-3 gap-2">
                <Input label="Métrage (ml)" type="number" step="0.01" min="0" inputMode="decimal" value={it.qte} disabled={readOnly} onChange={(e) => updateItem(i, { qte: Number(e.target.value) })} />
                <Input label="PU HT €/ml" type="number" step="0.01" value={it.pu_ht} disabled={readOnly} onChange={(e) => updateItem(i, { pu_ht: Number(e.target.value) })} />
                <Input label="TVA %" type="number" step="0.1" value={it.tva} disabled={readOnly} onChange={(e) => updateItem(i, { tva: Number(e.target.value) })} />
              </div>
              {it.meta?.surface_equivalente_m2 != null ? (
                <p className="text-xs text-gray-500">
                  Surface développée : <b>{Number(it.meta.surface_equivalente_m2).toLocaleString("fr-FR")} m²</b> — à retenir pour votre consommation de poudre.
                </p>
              ) : (
                <p className="text-xs text-gray-400">Renseignez le périmètre développé de cette famille dans vos réglages pour connaître la surface à poudrer.</p>
              )}
            </>
          ) : (
            <>
              {it.type === "prestation" ? (
                <Select value={String(it.meta?.prestation_id ?? "")} disabled={readOnly} onChange={(e) => {
                  const p = prestations.find((x) => x.id === e.target.value);
                  if (!p) return;
                  const { pu, negocie } = prixNegocie(p, clientId, clientTarifs, it.qte);
                  updateItem(i, { libelle: p.nom, unite: p.unite, pu_ht: pu, tva: Number(p.tva_rate), meta: { prestation_id: p.id, tarif_negocie: negocie } });
                }}>
                  {prestations.map((p) => <option key={p.id} value={p.id}>{p.nom} — {eur(Number(p.prix_unitaire_ht))}/{p.unite}</option>)}
                </Select>
              ) : (
                <Input placeholder="Libellé" value={it.libelle} disabled={readOnly} onChange={(e) => updateItem(i, { libelle: e.target.value })} />
              )}
              {it.type === "prestation" && it.meta?.tarif_negocie && (
                // Le prix affiché n'est pas celui du catalogue ci-dessus : le commercial doit
                // comprendre tout de suite pourquoi, sans aller vérifier la fiche client.
                <p className="text-xs text-brand-dark">Tarif négocié appliqué pour ce client.</p>
              )}
              {it.type !== "m2" && it.meta?.coef_complexite != null && Number(it.meta.coef_complexite) !== 1 && (
                <p className="text-xs text-brand-dark">
                  Coefficient de complexité de la pièce type appliqué : ×{nombreFr(it.meta.coef_complexite)}.
                </p>
              )}
              {it.type === "m2" ? (
                <>
                  <div className={couches.length ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
                    <Input label="Surface m²" type="number" step="0.01" min="0" value={String(it.meta?.surface ?? "")} disabled={readOnly} onChange={(e) => updateItem(i, { meta: { surface: Number(e.target.value) } })} />
                    <Select label="Finition" value={String(it.meta?.finition ?? "mat")} disabled={readOnly} onChange={(e) => updateItem(i, { meta: { finition: e.target.value } })}>
                      {(finitions.length ? finitions : [{ code: "mat", libelle: "Mat", coef: 1 } as GrilleCoef]).map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
                    </Select>
                    <Select label="Complexité" value={String(it.meta?.complexite ?? "simple")} disabled={readOnly} onChange={(e) => updateItem(i, { meta: { complexite: e.target.value } })}>
                      {(complexites.length ? complexites : [{ code: "simple", libelle: "Simple", coef: 1 } as GrilleCoef]).map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
                    </Select>
                    {couches.length > 0 && (
                      <Select label="Couches" value={String(it.meta?.couche ?? coucheParDefaut(coefs, grille?.id) ?? "")} disabled={readOnly} onChange={(e) => updateItem(i, { meta: { couche: e.target.value } })}>
                        {couches.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
                      </Select>
                    )}
                  </div>
                  {it.meta?.coef_complexite != null && Number(it.meta.coef_complexite) !== 1 && (
                    <p className="text-xs text-brand-dark">
                      Coefficient de complexité de la pièce type appliqué : ×{nombreFr(it.meta.coef_complexite)}.
                    </p>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Input label={`Qté (${uniteFr(it.unite)})`} type="number" step="0.01" min="0" value={it.qte} disabled={readOnly} onChange={(e) => updateItem(i, { qte: Number(e.target.value) })} />
                  <Input label="PU HT €" type="number" step="0.01" value={it.pu_ht} disabled={readOnly || it.type === "prestation"} onChange={(e) => updateItem(i, { pu_ht: Number(e.target.value) })} />
                  <Input label="TVA %" type="number" step="0.1" value={it.tva} disabled={readOnly} onChange={(e) => updateItem(i, { tva: Number(e.target.value) })} />
                </div>
              )}
              {it.unite === "ml" && !readOnly && (
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="mb-2 text-xs font-medium text-gray-600">Assistant surface développée</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      label="Périmètre (mm)"
                      type="number" step="1" min="0" inputMode="decimal"
                      value={String(it.meta?.assist_perimetre_mm ?? "")}
                      onChange={(e) => {
                        const perimetre = Number(e.target.value) || 0;
                        const longueur = Number(it.meta?.assist_longueur_m ?? 0);
                        const nb = Number(it.meta?.assist_qte ?? 1);
                        updateItem(i, { qte: metrageTotal(longueur, nb), meta: { assist_perimetre_mm: perimetre, surface_developpee_m2: surfaceDeveloppee(perimetre, longueur, nb) } });
                      }}
                    />
                    <Input
                      label="Longueur unitaire (m)"
                      type="number" step="0.01" min="0" inputMode="decimal"
                      value={String(it.meta?.assist_longueur_m ?? "")}
                      onChange={(e) => {
                        const longueur = Number(e.target.value) || 0;
                        const perimetre = Number(it.meta?.assist_perimetre_mm ?? 0);
                        const nb = Number(it.meta?.assist_qte ?? 1);
                        updateItem(i, { qte: metrageTotal(longueur, nb), meta: { assist_longueur_m: longueur, surface_developpee_m2: surfaceDeveloppee(perimetre, longueur, nb) } });
                      }}
                    />
                    <Input
                      label="Nb pièces"
                      type="number" step="1" min="1" inputMode="numeric"
                      value={String(it.meta?.assist_qte ?? 1)}
                      onChange={(e) => {
                        const nb = Number(e.target.value) || 1;
                        const perimetre = Number(it.meta?.assist_perimetre_mm ?? 0);
                        const longueur = Number(it.meta?.assist_longueur_m ?? 0);
                        updateItem(i, { qte: metrageTotal(longueur, nb), meta: { assist_qte: nb, surface_developpee_m2: surfaceDeveloppee(perimetre, longueur, nb) } });
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Renseignez le périmètre du profilé et la longueur d&apos;une pièce : la quantité (ml)
                    ci-dessus est calculée pour vous.
                    {Number(it.meta?.surface_developpee_m2 ?? 0) > 0 && (
                      <> Surface développée : <b>{Number(it.meta!.surface_developpee_m2).toLocaleString("fr-FR")} m²</b> (utile pour votre consommation de poudre).</>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
          <div className="text-right text-sm font-semibold">{eur(it.total_ht)} HT</div>
        </Card>
      ))}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => addItem("m2")} disabled={!grille}>+ Surface (m²)</Button>
          <Button variant="secondary" onClick={addLigneMl} disabled={!tarifsMl.length}>+ Longueur (ml)</Button>
          <Button variant="secondary" onClick={ajouterJeuJantes} disabled={!janteP.some((p) => p.grille_id === grille?.id)}>+ Jeu de jantes</Button>
          <Button variant="secondary" onClick={() => addItem("prestation")} disabled={!prestations.length}>+ Prestation</Button>
          <Button variant="secondary" onClick={() => addItem("libre")}>+ Ligne libre</Button>
        </div>
      )}
      {!grille && <p className="text-xs text-amber-600">Astuce : configurez votre grille tarifaire au m² dans les réglages pour chiffrer en 2 clics.</p>}
      {!tarifsMl.length && <p className="text-xs text-amber-600">Vous laquez de la menuiserie alu ? Déclarez vos prix au mètre linéaire dans Réglages → Prix au ml.</p>}
      {!janteP.some((p) => p.grille_id === grille?.id) && (
        <p className="text-xs text-amber-600">
          Vous rénovez des jantes ? Posez votre barème au pouce dans Réglages → Jantes : un jeu se
          chiffre alors en deux clics. Pour suivre les jantes une par une, ouvrez plutôt un dossier
          depuis l&apos;écran Jantes.
        </p>
      )}

      {!readOnly && piecesTypes.length > 0 && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Pièces types</div>
          <p className="-mt-1 text-xs text-gray-500">Un appui, une ligne prête. Vous ajustez ensuite si la pièce sort de l&apos;ordinaire.</p>
          <div className="flex flex-wrap gap-2">
            {piecesTypes.map((p) => (
              <button
                key={p.id}
                onClick={() => ajouterPieceType(p)}
                className="min-h-[52px] flex-1 basis-[45%] rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm font-medium text-gray-800 active:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {p.nom}
                <span className="block text-xs font-normal text-gray-500">
                  {p.prix_ht != null ? `${eur(Number(p.prix_ht))} HT` : p.surface_m2 != null ? `${Number(p.surface_m2).toLocaleString("fr-FR")} m² au tarif` : "à chiffrer"}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Textarea label="Notes / conditions" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} />

      {(!readOnly || remise) && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Remise</div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Valeur"
              type="number"
              step="0.01"
              min="0"
              max={remise?.type === "montant" ? brutHt : 100}
              inputMode="decimal"
              value={remise?.valeur ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                setRemiseAuto(false);
                if (e.target.value === "") { setRemise(null); return; }
                const type = remise?.type ?? "pct";
                // Bornée tout de suite : `min`/`max` sur ce champ ne suffisent pas, il redevient un
                // simple `<input type="text">` (ChampDecimal) — voir D5.
                const max = type === "pct" ? 100 : brutHt;
                const valeur = Math.min(Math.max(Number(e.target.value) || 0, 0), max);
                setRemise({ type, valeur });
              }}
            />
            <Select
              label="Unité"
              value={remise?.type ?? "pct"}
              disabled={readOnly || !remise}
              onChange={(e) => {
                setRemiseAuto(false);
                if (!remise) return;
                const type = e.target.value as "pct" | "montant";
                const max = type === "pct" ? 100 : brutHt;
                setRemise({ type, valeur: Math.min(remise.valeur, max) });
              }}
            >
              <option value="pct">% du total</option>
              <option value="montant">€ HT</option>
            </Select>
          </div>
          {clientCourant?.remise_pct != null && Number(clientCourant.remise_pct) > 0 && (
            <p className="text-xs text-brand-dark">
              Remise contractuelle client : −{Number(clientCourant.remise_pct).toLocaleString("fr-FR")} %.
              {!readOnly && " Elle est appliquée d'office ; modifiez la valeur ci-dessus pour ce devis uniquement."}
            </p>
          )}
        </Card>
      )}

      {/* C1 — acompte à la commande : un pourcentage du total TTC, demandé à la signature. Le
          montant se recalcule ici en direct pour que l'atelier sache ce qu'il annonce avant même
          d'enregistrer, exactement comme le forfait minimum juste au-dessus. */}
      {(!readOnly || (acomptePct ?? 0) > 0) && (
        <Card className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Acompte à la commande</div>
          <Input
            label="Pourcentage du total TTC"
            type="number"
            step="1"
            min="0"
            max="100"
            inputMode="decimal"
            value={acomptePct ?? ""}
            disabled={readOnly}
            onChange={(e) => {
              if (e.target.value === "") { setAcomptePct(null); return; }
              setAcomptePct(Math.min(Math.max(Number(e.target.value) || 0, 0), 100));
            }}
          />
          {(acomptePct ?? 0) > 0 && (
            <p className="text-xs text-gray-500">
              Soit <b className="text-gray-800">{eur(montantAcompteApercu)}</b> demandés à la signature — le
              solde restant sera de {eur(round2(totaux.total_ttc - montantAcompteApercu))}.
            </p>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-1 text-sm">
        {/* D1 — la remise affichée doit se lire sur les lignes réellement enregistrées
            (`itemsChiffres`, forfait minimum inclus) et non sur les seules lignes saisies
            (`items`) : sinon le forfait n'entre pas dans le calcul de `remiseAffichee` et le
            récapitulatif ne s'additionne plus (64,40 − 19,40 + 45 ≠ 45 au lieu de 64,40 − 64,40
            + 45 = 45). */}
        {remise && remiseAffichee(itemsChiffres, remise, totaux.total_ht) > 0 && (
          <>
            <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{eur(brutHt)}</span></div>
            <div className="flex justify-between text-gray-500">
              <span>Remise{remise.type === "pct" ? ` (${nombreFr(remise.valeur)} %)` : ""}</span>
              <span>− {eur(remiseAffichee(itemsChiffres, remise, totaux.total_ht))}</span>
            </div>
          </>
        )}
        {complement > 0 && (
          <>
            <div className="flex justify-between text-gray-500">
              <span>Forfait minimum ({eur(plancher)})</span>
              <span>+ {eur(complement)}</span>
            </div>
            <p className="-mt-0.5 text-xs text-gray-500">
              Le total n&apos;atteint pas le minimum de facturation de votre grille : le complément
              apparaît en ligne sur le devis, pour que le client comprenne le prix.
            </p>
          </>
        )}
        <div className="flex justify-between"><span>Total HT</span><b>{eur(totaux.total_ht)}</b></div>
        <div className="flex justify-between text-gray-500"><span>TVA</span><span>{eur(totaux.total_tva)}</span></div>
        <div className="flex justify-between text-base"><span>Total TTC</span><b>{eur(totaux.total_ttc)}</b></div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {/* D13 — `toLocaleTimeString("fr-FR")` sans option rend les secondes ("14:32:07"), un
          quatrième format d'heure à côté des trois autres unifiés par `dateHeureFr`/`heureFr`. */}
      {devisId && savedAt && !error && !readOnly && <p className="text-center text-xs text-gray-500">Brouillon enregistré automatiquement à {heureFr(savedAt)}</p>}
      {!readOnly && (
        <>
          <Button
            loading={saving}
            disabled={!clientId || items.length === 0}
            onClick={async () => {
              const id = await save();
              if (id) { router.push(`/devis/${id}`); router.refresh(); }
            }}
          >
            {devisId ? "Enregistrer" : "Enregistrer le brouillon"}
          </Button>
          {/* Un bouton éteint sans explication oblige à deviner ce qui manque. */}
          {(!clientId || items.length === 0) && (
            <p className="text-center text-xs text-gray-500">
              {!clientId ? "Choisissez d'abord le client." : "Ajoutez au moins une ligne au devis."}
            </p>
          )}
        </>
      )}

      <ConfirmModal
        open={ligneASupprimer !== null}
        title="Supprimer cette ligne ?"
        message={
          ligneASupprimer !== null
            ? `« ${items[ligneASupprimer]?.libelle || "sans libellé"} » sera retirée du devis. Le total est recalculé aussitôt.`
            : undefined
        }
        confirmLabel="Supprimer"
        danger
        onCancel={() => setLigneASupprimer(null)}
        onConfirm={() => {
          setItems(items.filter((_, j) => j !== ligneASupprimer));
          setLigneASupprimer(null);
        }}
      />
    </div>
  );
}
