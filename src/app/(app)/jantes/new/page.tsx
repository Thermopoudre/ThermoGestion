"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import TeinteOrigineSelecteur, { type TeinteChoisie } from "@/components/TeinteOrigineSelecteur";
import { useToast } from "@/components/Toast";
import { errorFr } from "@/lib/errors";
import { eur } from "@/lib/utils";
import { useTitreDocument } from "@/lib/titre";
import {
  DESSINS_JANTE_DEFAUT,
  FINITIONS_JANTE_DEFAUT,
  POSITIONS_JANTE,
  lignesJantesOuvrables,
  positionsParDefaut,
  prefillJanteDepuisDevis,
  prixJante,
  surfaceJante,
  type LigneJanteDevis,
} from "@/lib/jantes";
import type { Client, DevisItem, GrilleCoef, JantePalier, Vehicule } from "@/lib/types";

const AUCUN_VEHICULE = "__nouveau__";

/**
 * Ouverture d'un dossier jantes, à la réception du jeu.
 *
 * L'écran est bâti autour d'un seul geste : choisir le véhicule. Un garage qui fait quinze jeux
 * par mois revient avec des voitures qu'il a déjà déposées — diamètre, dessin, finition et teinte
 * d'origine sont alors repris du dernier jeu, et il ne reste qu'à valider.
 *
 * Amélioration n°8 (07/09/2026) — second geste de reprise, sur l'autre bout de la chaîne : le
 * jeu chiffré au téléphone dans un devis signé. `?devis=<id>` (posé par le bouton de la fiche
 * devis) précharge directement ; sans lui, le panneau « Reprendre un devis signé » propose les
 * jeux non encore ouverts du client choisi — même geste que « Reprendre le dernier devis de ce
 * client » sur `/devis/new`. Dans les deux cas, tout reste modifiable et rien n'écrase une
 * caractéristique déjà saisie à la main (règle du chantier : la pièce reçue diffère souvent de
 * ce qui a été chiffré au téléphone).
 */
export default function NouveauJeuJantesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [atelierId, setAtelierId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [paliers, setPaliers] = useState<JantePalier[]>([]);
  const [coefs, setCoefs] = useState<GrilleCoef[]>([]);
  const [grilleDefautId, setGrilleDefautId] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [vehiculeId, setVehiculeId] = useState(AUCUN_VEHICULE);
  const [vehicule, setVehicule] = useState({ marque: "", modele: "", annee: "", immatriculation: "" });
  const [teinte, setTeinte] = useState<TeinteChoisie>({ teinte_origine: null, teinte_reference: null, tp_product_id: null });

  const [nbJantes, setNbJantes] = useState(4);
  const [diametre, setDiametre] = useState(19);
  const [largeur, setLargeur] = useState("");
  const [dessin, setDessin] = useState("standard");
  const [finition, setFinition] = useState("unie");
  const [teinteJeu, setTeinteJeu] = useState("");
  const [pneusMontes, setPneusMontes] = useState(true);
  const [tpms, setTpms] = useState(false);
  const [datePromise, setDatePromise] = useState("");
  const [deposePar, setDeposePar] = useState("");
  const [reserves, setReserves] = useState("");

  // Reprise depuis un devis signé (amélioration n°8) — état séparé du reste : ce n'est ni une
  // caractéristique du jeu, ni une donnée à enregistrer telle quelle, juste la provenance affichée.
  const [devisIdUrl, setDevisIdUrl] = useState<string | null>(null);
  const [devisOrigine, setDevisOrigine] = useState<{ id: string; numero: string | null } | null>(null);
  const [lignesASelectionner, setLignesASelectionner] = useState<LigneJanteDevis[]>([]);
  const [lignesDevisClient, setLignesDevisClient] = useState<LigneJanteDevis[]>([]);
  // Vrai dès que l'opérateur touche un champ du bloc « Le jeu » à la main : passé ce point, un
  // devis choisi ensuite (ou en cours de chargement) ne doit plus rien écraser (règle n°3 du
  // chantier — « ne préremplis jamais par-dessus une saisie existante »).
  const jeuToucheRef = useRef(false);
  // Véhicule à raccrocher une fois sa liste chargée (le devis peut arriver avant que le client,
  // donc ses véhicules, ne soit choisi) ; posé par `reprendreLigneDevis`, consommé plus bas.
  const pendingVehiculeIdRef = useRef<string | null>(null);
  // Index de la ligne de devis reprise, pour reposer `meta.jeu_jantes_id` dessus après création
  // (symétrique de `patch({ devis_id })` posé par `/jantes/[id]` quand le devis part du dossier).
  const devisItemIndexRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: membre }, { data: cls }, { data: pj }, { data: cf }, { data: grilles }] = await Promise.all([
        supabase.from("users").select("atelier_id").single(),
        supabase.from("clients").select("*").eq("archive", false).order("nom"),
        supabase.from("jante_paliers").select("*").order("diametre_min"),
        supabase.from("grille_coefs").select("*"),
        supabase.from("grilles_tarifaires").select("id, is_default").eq("actif", true),
      ]);
      setAtelierId(membre!.atelier_id);
      setClients((cls as Client[]) ?? []);
      setPaliers((pj as JantePalier[]) ?? []);
      setCoefs((cf as GrilleCoef[]) ?? []);
      setGrilleDefautId(((grilles ?? []) as { id: string; is_default: boolean }[]).find((g) => g.is_default)?.id ?? null);
      // Délai par défaut du métier : le garage travaille en 48–72 h, la voiture est immobilisée.
      setDatePromise(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
      setLoading(false);
    })();
  }, [supabase]);

  // Les véhicules suivent le client : un garage ne doit pas voir la flotte du concessionnaire voisin.
  useEffect(() => {
    (async () => {
      if (!clientId) { setVehicules([]); return; }
      const { data } = await supabase.from("vehicules").select("*").eq("client_id", clientId).order("marque");
      setVehicules((data as Vehicule[]) ?? []);
    })();
  }, [supabase, clientId]);

  // `?devis=<id>` posé par le bouton « Créer le jeu de jantes » de la fiche devis. Lu à la main
  // plutôt qu'avec `useSearchParams` : cette page reste ainsi rendable sans frontière `<Suspense>`,
  // comme le fait déjà `/bl` pour son propre `?client=`.
  useEffect(() => {
    const cible = new URLSearchParams(window.location.search).get("devis");
    if (cible) setDevisIdUrl(cible);
  }, []);

  // Devis désigné par l'URL : une seule ligne de jantes s'applique directement, plusieurs
  // demandent à l'opérateur de choisir laquelle (un devis peut chiffrer deux jeux, par exemple
  // les jantes d'origine ET une roue de secours dépareillée).
  useEffect(() => {
    if (!devisIdUrl) return;
    let annule = false;
    (async () => {
      const { data } = await supabase
        .from("devis")
        .select("id, numero, client_id, status, items")
        .eq("id", devisIdUrl)
        .maybeSingle();
      if (annule || !data) return;
      // Le préchargement ne vaut que pour un devis signé (règle du chantier) : avant signature,
      // rien ne garantit que la pièce chiffrée est celle qui sera réellement déposée.
      if (data.status !== "signe") {
        toast("Ce devis n'est pas (ou plus) signé : rien n'a été repris.", "error");
        return;
      }
      const lignes = lignesJantesOuvrables(data as { id: string; numero: string | null; items: DevisItem[] });
      if (!lignes.length) {
        toast("Ce devis ne contient aucun jeu de jantes à ouvrir.", "error");
        return;
      }
      // Le client vient du devis : pas d'écrasement si l'opérateur en a déjà choisi un autre
      // (formulaire arrivé pré-rempli, mais rechargé après une saisie manuelle).
      setClientId((c) => c || data.client_id);
      if (lignes.length === 1) reprendreLigneDevis(lignes[0]);
      else setLignesASelectionner(lignes);
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisIdUrl, supabase]);

  // Panneau « Reprendre un devis signé de ce client » — le chemin ordinaire quand l'opérateur
  // ouvre `/jantes/new` directement plutôt que depuis le bouton de la fiche devis (amélioration
  // n°8, même geste que « Reprendre le dernier devis de ce client » sur `/devis/new`). N'a pas
  // lieu d'être quand un devis est déjà imposé par l'URL.
  useEffect(() => {
    if (devisIdUrl || !clientId) { setLignesDevisClient([]); return; }
    let annule = false;
    supabase
      .from("devis")
      .select("id, numero, created_at, items")
      .eq("client_id", clientId)
      .eq("status", "signe")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (annule) return;
        const lignes = ((data ?? []) as { id: string; numero: string | null; created_at: string; items: DevisItem[] }[])
          .flatMap((d) => lignesJantesOuvrables(d));
        setLignesDevisClient(lignes.slice(0, 5));
      });
    return () => { annule = true; };
  }, [clientId, devisIdUrl, supabase]);

  // Raccroche le véhicule connu du devis dès que la liste du client est chargée — sans repasser
  // par `choisirVehicule`, qui irait aussi chercher le dernier jeu du véhicule et écraserait les
  // caractéristiques tout juste reprises du devis avec un historique plus ancien.
  useEffect(() => {
    const vid = pendingVehiculeIdRef.current;
    if (!vid) return;
    const v = vehicules.find((x) => x.id === vid);
    if (!v) return;
    pendingVehiculeIdRef.current = null;
    setVehiculeId(v.id);
    setTeinte((t) => (t.teinte_origine || t.teinte_reference ? t : { teinte_origine: v.teinte_origine, teinte_reference: v.teinte_reference, tp_product_id: v.tp_product_id }));
  }, [vehicules]);

  const clientCourant = clients.find((c) => c.id === clientId) ?? null;
  const grilleId = clientCourant?.grille_id ?? grilleDefautId;

  const dessins = coefs.filter((c) => c.grille_id === grilleId && c.categorie === "jante_dessin");
  const finitions = coefs.filter((c) => c.grille_id === grilleId && c.categorie === "jante_finition");
  const listeDessins = dessins.length ? dessins.map((c) => ({ code: c.code, libelle: c.libelle })) : DESSINS_JANTE_DEFAUT;
  const listeFinitions = finitions.length ? finitions.map((c) => ({ code: c.code, libelle: c.libelle })) : FINITIONS_JANTE_DEFAUT;

  const pu = prixJante({ diametre, dessin, finition, grilleId, paliers, coefs });
  const bareme = paliers.some((p) => p.grille_id === grilleId);

  /** Reprise du dernier jeu du véhicule : c'est le « en un geste » promis au garage récurrent. */
  async function choisirVehicule(id: string) {
    setVehiculeId(id);
    const v = vehicules.find((x) => x.id === id);
    if (!v) { setTeinte({ teinte_origine: null, teinte_reference: null, tp_product_id: null }); return; }
    setTeinte({ teinte_origine: v.teinte_origine, teinte_reference: v.teinte_reference, tp_product_id: v.tp_product_id });
    setTeinteJeu(v.teinte_origine ?? "");
    const { data: dernier } = await supabase
      .from("jeux_jantes")
      .select("nb_jantes, diametre_pouces, largeur_pouces, dessin, finition, teinte, tpms, pneus_montes")
      .eq("vehicule_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!dernier) return;
    setNbJantes(dernier.nb_jantes);
    setDiametre(Number(dernier.diametre_pouces));
    setLargeur(dernier.largeur_pouces != null ? String(dernier.largeur_pouces) : "");
    setDessin(dernier.dessin);
    setFinition(dernier.finition);
    setTeinteJeu(dernier.teinte ?? v.teinte_origine ?? "");
    setTpms(dernier.tpms);
    setPneusMontes(dernier.pneus_montes);
    toast("Caractéristiques reprises du dernier jeu de ce véhicule");
  }

  /**
   * Reprend une ligne « jeu de jantes » d'un devis signé (amélioration n°8, 07/09/2026).
   *
   * Ne pose que ce qui a le même sens des deux côtés (`prefillJanteDepuisDevis`) : nombre,
   * diamètre, dessin, finition, teinte demandée — jamais le prix ni la surface, recalculés au
   * barème du jour. La référence constructeur, si le devis en portait une, n'est qu'une suggestion
   * pour le sélecteur de teinte d'origine du véhicule : elle ne s'impose pas si l'atelier a déjà
   * renseigné autre chose, et rien n'est écrit en base tant que le dossier n'est pas enregistré.
   *
   * Règle n°3 du chantier : si l'opérateur a déjà touché un champ du bloc « Le jeu » à la main,
   * on ne reprend rien — la reprise silencieuse d'un devis par-dessus une saisie réelle serait
   * exactement la confusion qu'un « repris du devis » visible doit éviter.
   */
  function reprendreLigneDevis(ligne: LigneJanteDevis) {
    if (jeuToucheRef.current) {
      toast("Des caractéristiques sont déjà saisies : rien n'a été modifié.", "error");
      return;
    }
    const champs = prefillJanteDepuisDevis(ligne);
    setNbJantes(champs.nbJantes);
    if (champs.diametrePouces != null) setDiametre(champs.diametrePouces);
    if (champs.dessin) setDessin(champs.dessin);
    if (champs.finition) setFinition(champs.finition);
    if (champs.teinte) setTeinteJeu(champs.teinte);
    if (champs.teinteReference) {
      setTeinte((t) => (t.teinte_reference ? t : { ...t, teinte_reference: champs.teinteReference }));
    }
    pendingVehiculeIdRef.current = champs.vehiculeId;
    devisItemIndexRef.current = ligne.itemIndex;
    setDevisOrigine({ id: ligne.devisId, numero: ligne.devisNumero });
    setLignesASelectionner([]);
    toast(`Caractéristiques reprises du devis ${ligne.devisNumero ?? "signé"}`);
  }

  /** Marque une saisie manuelle sur le bloc « Le jeu » — verrouille la reprise automatique d'un devis. */
  function toucher<T>(setter: (v: T) => void, valeur: T) {
    jeuToucheRef.current = true;
    setter(valeur);
  }

  async function enregistrer() {
    setSaving(true);
    try {
      let idVehicule: string | null = vehiculeId === AUCUN_VEHICULE ? null : vehiculeId;

      if (idVehicule) {
        // La teinte d'origine se met à jour sur le véhicule : c'est là qu'elle doit vivre.
        // La teinte perdue en silence, c'est la reprise automatique du prochain jeu qui ne marche
        // plus — sans que personne ne comprenne pourquoi.
        const { error: errVeh } = await supabase.from("vehicules").update({
          teinte_origine: teinte.teinte_origine, teinte_reference: teinte.teinte_reference, tp_product_id: teinte.tp_product_id,
        }).eq("id", idVehicule);
        if (errVeh) throw errVeh;
      } else if (vehicule.marque.trim()) {
        const { data, error } = await supabase.from("vehicules").insert({
          atelier_id: atelierId, client_id: clientId,
          marque: vehicule.marque.trim(),
          modele: vehicule.modele.trim() || null,
          annee: vehicule.annee ? Number(vehicule.annee) : null,
          immatriculation: vehicule.immatriculation.trim() || null,
          teinte_origine: teinte.teinte_origine, teinte_reference: teinte.teinte_reference, tp_product_id: teinte.tp_product_id,
        }).select("id").single();
        if (error) throw error;
        idVehicule = data.id;
      }

      const { data: numero, error: errNum } = await supabase.rpc("next_numero", { p_type: "jantes" });
      if (errNum) throw errNum;
      const { data: jeu, error: errJeu } = await supabase.from("jeux_jantes").insert({
        atelier_id: atelierId, client_id: clientId, vehicule_id: idVehicule, numero,
        // Amélioration n°8 — le lien qui évite la double saisie au prochain « Chiffrer ce jeu »
        // ou à la recherche du devis d'origine : `jeux_jantes.devis_id` existait déjà, seule la
        // création manquait pour le renseigner.
        devis_id: devisOrigine?.id ?? null,
        nb_jantes: nbJantes, diametre_pouces: diametre,
        largeur_pouces: largeur === "" ? null : Number(largeur),
        dessin, finition,
        teinte: teinteJeu.trim() || teinte.teinte_origine,
        pneus_montes: pneusMontes, tpms,
        date_promise: datePromise || null,
        depose_par: deposePar.trim() || null,
        reserves: reserves.trim() || null,
      }).select("id").single();
      if (errJeu) throw errJeu;

      // Reboucle sur la ligne de devis reprise : sans ce marquage, `jeux_jantes.devis_id` n'ayant
      // pas de contrainte d'unicité, la même ligne resterait proposable et un second dossier
      // physique pourrait être ouvert pour des jantes déjà réceptionnées une fois.
      if (devisOrigine && devisItemIndexRef.current != null) {
        const idx = devisItemIndexRef.current;
        const { data: dv } = await supabase.from("devis").select("items").eq("id", devisOrigine.id).maybeSingle();
        const items = (dv?.items ?? null) as DevisItem[] | null;
        if (items && items[idx]) {
          const next = items.map((it, i) => (i === idx ? { ...it, meta: { ...it.meta, jeu_jantes_id: jeu.id } } : it));
          await supabase.from("devis").update({ items: next }).eq("id", devisOrigine.id);
        }
      }

      const { error: errJantes } = await supabase.from("jantes").insert(
        positionsParDefaut(nbJantes).map((position) => ({ atelier_id: atelierId, jeu_id: jeu.id, position })),
      );
      if (errJantes) throw errJantes;

      toast("Dossier créé — photographiez chaque jante maintenant");
      router.push(`/jantes/${jeu.id}`);
      router.refresh();
    } catch (e) {
      toast(errorFr(e as { message?: string }), "error");
      setSaving(false);
    }
  }

  useTitreDocument("Nouveau jeu de jantes");

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4 md:max-w-2xl">
      <PageTitle>Nouveau jeu de jantes</PageTitle>

      {/* Amélioration n°10 (07/09/2026) — réciproque de l'aiguillage posé sur /receptions/new :
          un portail, un meuble ou une pièce de menuiserie n'a rien à faire dans ce dossier
          dédié aux jantes (photos roue par roue, bon de prise en charge). */}
      <p className="rounded-lg border border-brand/25 bg-brand-light/40 p-3 text-sm text-brand-dark">
        Ce dépôt ne concerne pas des jantes (portail, mobilier, pièce de menuiserie…) ?{" "}
        <Link href="/receptions/new" className="font-medium underline">
          Ouvrir une réception
        </Link>{" "}
        plutôt.
      </p>

      {/* Amélioration n°8 (07/09/2026) — provenance visible et modifiable : l'opérateur doit
          savoir d'où viennent les valeurs pré-remplies, pas les découvrir en les changeant. */}
      {devisOrigine && (
        <p className="rounded-lg border border-success/25 bg-success-light/30 p-3 text-sm text-success-dark">
          Nombre, diamètre, dessin, finition et teinte repris du devis{" "}
          <Link href={`/devis/${devisOrigine.id}`} className="font-medium underline">
            {devisOrigine.numero ?? "signé"}
          </Link>{" "}
          — à corriger si la pièce reçue diffère de ce qui a été chiffré au téléphone.
        </p>
      )}

      {lignesASelectionner.length > 1 && (
        <Card className="flex flex-col gap-2 border-brand/25 bg-brand-light/30">
          <div className="text-sm font-semibold">Ce devis porte plusieurs jeux de jantes — lequel ouvrez-vous ?</div>
          {lignesASelectionner.map((l) => (
            <Button key={l.itemIndex} variant="secondary" onClick={() => reprendreLigneDevis(l)}>
              {l.libelle}
            </Button>
          ))}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <Select label="Client *" value={clientId} onChange={(e) => { setClientId(e.target.value); setVehiculeId(AUCUN_VEHICULE); }}>
          <option value="">— Choisir un client —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>

        {clientId && !devisIdUrl && lignesDevisClient.length > 0 && !devisOrigine && (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-2">
            <div className="text-xs font-medium text-gray-600">Reprendre un devis signé de ce client</div>
            {lignesDevisClient.map((l) => (
              <div key={`${l.devisId}-${l.itemIndex}`} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.devisNumero ?? "Devis"}</div>
                  <div className="truncate text-xs text-gray-500">{l.libelle}</div>
                </div>
                <Button variant="secondary" onClick={() => reprendreLigneDevis(l)}>
                  <span className="flex items-center gap-1.5"><Copy size={14} aria-hidden /> Reprendre</span>
                </Button>
              </div>
            ))}
          </div>
        )}

        {clientId && (
          <Select label="Véhicule" value={vehiculeId} onChange={(e) => choisirVehicule(e.target.value)}>
            <option value={AUCUN_VEHICULE}>+ Nouveau véhicule</option>
            {vehicules.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.marque, v.modele, v.immatriculation].filter(Boolean).join(" · ")}
              </option>
            ))}
          </Select>
        )}

        {clientId && vehiculeId === AUCUN_VEHICULE && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="Marque" value={vehicule.marque} placeholder="BMW" onChange={(e) => setVehicule({ ...vehicule, marque: e.target.value })} />
            <Input label="Modèle" value={vehicule.modele} placeholder="Série 3" onChange={(e) => setVehicule({ ...vehicule, modele: e.target.value })} />
            <Input label="Année" type="number" step="1" value={vehicule.annee} placeholder="2021" onChange={(e) => setVehicule({ ...vehicule, annee: e.target.value })} />
            <Input label="Immatriculation" value={vehicule.immatriculation} placeholder="AB-123-CD" onChange={(e) => setVehicule({ ...vehicule, immatriculation: e.target.value })} />
          </div>
        )}
      </Card>

      {clientId && <TeinteOrigineSelecteur valeur={teinte} onChange={setTeinte} />}

      <Card className="flex flex-col gap-3">
        <div className="text-sm font-semibold">Le jeu</div>
        <div className="grid grid-cols-3 gap-2">
          <Select label="Nombre" value={String(nbJantes)} onChange={(e) => toucher(setNbJantes, Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} jante{n > 1 ? "s" : ""}</option>)}
          </Select>
          <Input
            label="Diamètre (pouces)" type="number" step="0.5" min="12" max="26"
            value={diametre}
            // D5 — 0 pouce était saisissable et se chiffrait quand même. Bornée comme en base
            // (`jeux_jantes_diametre_pouces_check`, 12-26).
            onChange={(e) => toucher(setDiametre, e.target.value === "" ? 12 : Math.min(Math.max(Number(e.target.value) || 0, 12), 26))}
          />
          <Input
            label="Largeur (J)" type="number" step="0.5" min="4"
            value={largeur}
            placeholder="8"
            onChange={(e) => setLargeur(e.target.value === "" ? "" : String(Math.max(Number(e.target.value) || 0, 4)))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Dessin" value={dessin} onChange={(e) => toucher(setDessin, e.target.value)}>
            {listeDessins.map((d) => <option key={d.code} value={d.code}>{d.libelle}</option>)}
          </Select>
          <Select label="Finition" value={finition} onChange={(e) => toucher(setFinition, e.target.value)}>
            {listeFinitions.map((f) => <option key={f.code} value={f.code}>{f.libelle}</option>)}
          </Select>
        </div>
        <Input
          label="Teinte demandée"
          value={teinteJeu}
          placeholder={teinte.teinte_origine ?? "Teinte d'origine, ou autre demande du client"}
          onChange={(e) => toucher(setTeinteJeu, e.target.value)}
        />
        {teinte.teinte_origine && teinteJeu && teinteJeu !== teinte.teinte_origine && (
          <p className="-mt-1 text-xs text-amber-700">
            Cette teinte n&apos;est pas celle d&apos;origine du véhicule ({teinte.teinte_origine}) : les
            documents diront « teinte » et non « teinte d&apos;origine ».
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={pneusMontes} onChange={(e) => setPneusMontes(e.target.checked)} />
            Pneus montés (dépose et repose à prévoir)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={tpms} onChange={(e) => setTpms(e.target.checked)} />
            Capteurs TPMS
          </label>
        </div>
        {tpms && (
          <p className="-mt-1 rounded bg-amber-50 p-2 text-xs text-amber-900">
            Capteurs de pression fragiles : notez leur état sur chaque jante avant démontage. C&apos;est
            le litige le plus fréquent du métier, et le plus cher.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input label="À rendre le" type="date" value={datePromise} onChange={(e) => setDatePromise(e.target.value)} />
          <Input label="Déposé par" value={deposePar} placeholder="Nom du garagiste" onChange={(e) => setDeposePar(e.target.value)} />
        </div>
        <Textarea label="Réserves à la prise en charge" value={reserves} placeholder="Jante ARD voilée, choc de trottoir sur AVG…" onChange={(e) => setReserves(e.target.value)} />
      </Card>

      <Card className="flex flex-col gap-1 text-sm">
        {bareme ? (
          <>
            <div className="flex justify-between text-gray-500"><span>Prix indicatif à la jante</span><span>{eur(pu)}</span></div>
            <div className="flex justify-between"><span>Jeu de {nbJantes}</span><b>{eur(pu * nbJantes)} HT</b></div>
            <p className="text-xs text-gray-500">
              Surface estimée : {(surfaceJante(diametre) * nbJantes).toLocaleString("fr-FR")} m² pour le jeu.
              Ce prix est indicatif — c&apos;est le devis qui fait foi, et les opérations mécaniques s&apos;y ajoutent.
            </p>
          </>
        ) : (
          <p className="text-xs text-amber-700">
            Aucun barème au pouce n&apos;est réglé pour ce client. Renseignez-le dans Réglages → Jantes
            pour chiffrer un jeu en deux clics.
          </p>
        )}
      </Card>

      <Button disabled={saving || !clientId} onClick={enregistrer}>
        {saving ? "Enregistrement…" : `Créer le dossier et ses ${nbJantes} jante${nbJantes > 1 ? "s" : ""}`}
      </Button>
      <p className="-mt-2 text-center text-xs text-gray-500">
        {POSITIONS_JANTE.slice(0, nbJantes).map((p) => p.court).join(" · ")}
      </p>
    </div>
  );
}
