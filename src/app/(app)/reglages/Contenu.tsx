"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ecrire } from "@/lib/db";
import { Badge, Button, Card, Input, PageTitle, Select, Spinner, Textarea } from "@/components/ui";
import AdresseInput from "@/components/AdresseInput";
import { nombreFr, uniteFr } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { usePlan } from "@/components/PlanProvider";
import ConfirmModal from "@/components/Modal";
import { PRIX_SIEGE_ANNUEL, PRIX_SIEGE_MENSUEL, nomPlan, offre } from "@/lib/abonnement";
import {
  ACCES_COMPTABLES_INCLUS,
  LIBELLE_ROLE,
  ROLES_INTERNES,
  ROLES_INVITABLES,
  estRole,
  type Role,
} from "@/lib/roles";
import { REGLAGES_ALERTES_DEFAUT, type ReglagesAlertes } from "@/lib/alertes";
import { apercuNumero, motifRefusNumerotation, normaliserPrefixe, type LigneNumerotation } from "@/lib/numerotation";
import { VALIDITE_DEVIS_DEFAUT, VALIDITE_DEVIS_MAX, VALIDITE_DEVIS_MIN } from "@/lib/devis";
import { eur } from "@/lib/utils";
import { useEtatUrl } from "@/lib/urlState";
import { useTitreDocument } from "@/lib/titre";
import type { Atelier, AtelierFour, AtelierLot2, Grille, GrilleCoef, GrillePalier, JantePalier, PalierQuantite, PieceType, Prestation, TarifMl } from "@/lib/types";
import { errorFr } from "@/lib/errors";
import { ACCEPT_LOGO, TAILLE_MAX_LOGO, TYPES_LOGO, cheminLogo } from "@/lib/stockage";
import AstuceEcran from "@/components/AstuceEcran";
import {
  CODES_PRESTATION_JANTE,
  DESSINS_JANTE_DEFAUT,
  FINITIONS_JANTE_DEFAUT,
  OPERATIONS_JANTE,
  PALIERS_JANTE_DEFAUT,
} from "@/lib/jantes";

// D6 — les champs de coefficient s'affichent désormais en français (`nombreFr`, virgule
// décimale) : à la relecture, il faut donc accepter la virgule aussi bien que le point que
// `ChampDecimal` produit pendant la frappe (il convertit lui-même la virgule tapée en point).
function champVersNombre(v: string): number {
  return Number(v.replace(",", "."));
}

// Les coefficients sont stockés avec des codes techniques sans accent : à l'écran, l'atelier doit
// lire son métier, et dans l'ordre où il raisonne (finition, puis complexité, puis couches).
const CATEGORIES_COEF: Record<string, { libelle: string; ordre: number }> = {
  finition: { libelle: "Finition", ordre: 1 },
  complexite: { libelle: "Complexité de la pièce", ordre: 2 },
  couche: { libelle: "Nombre de couches", ordre: 3 },
};

/**
 * Les onglets, dans l'ordre où ils s'affichent — et la liste que `?onglet=` doit reconnaître.
 * Une seule source : une liste écrite deux fois finit par diverger, et le raccourci mène alors
 * sur le premier onglet sans rien dire.
 */
const ONGLETS = [
  "atelier", "numerotation", "alertes", "grille", "ml", "jantes", "pieces", "prestations", "equipe", "workflow", "compte",
] as const;

/**
 * Parcours de production d'un jeu de jantes, à l'identique de `_workflow_jantes` côté base.
 *
 * Les codes `cuisson`, `controle`, `pret` et `livre` sont ceux que le reste du produit reconnaît
 * (décompte de poudre au lot, bascule en « prêt », notification client) : les renommer casserait
 * la traçabilité en silence. C'est pourquoi seul le libellé est modifiable ci-dessous.
 */
const WORKFLOW_JANTES_DEFAUT = [
  { code: "reception", libelle: "Réception et état des jantes" },
  { code: "depose_pneu", libelle: "Dépose des pneus" },
  { code: "decapage", libelle: "Décapage / dévernissage" },
  { code: "redressage", libelle: "Dévoilage / redressage" },
  { code: "sablage", libelle: "Sablage" },
  { code: "poudrage", libelle: "Apprêt et laquage" },
  { code: "cuisson", libelle: "Cuisson" },
  { code: "diamantage", libelle: "Diamantage CNC" },
  { code: "vernis", libelle: "Vernis de protection" },
  { code: "repose_pneu", libelle: "Repose des pneus et équilibrage" },
  { code: "controle", libelle: "Contrôle" },
  { code: "pret", libelle: "Prêt" },
  { code: "livre", libelle: "Livré" },
];
const ORDRE_COEF: Record<string, number> = {
  mat: 1, brillant: 2, texture: 3, metallise: 4,
  simple: 1, moyenne: 2, complexe: 3,
  une: 1, deux: 2, trois: 3,
};

export default function ReglagesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  // D10 — l'onglet ne faisait que LIRE `?onglet=` au montage : cliquer un autre onglet ne changeait
  // pas l'URL, et Précédent quittait la page entière au lieu de revenir sur le précédent onglet.
  const [tab, setTab] = useEtatUrl<(typeof ONGLETS)[number]>("onglet", "atelier", ONGLETS);
  const { plan, essai, estProprietaire } = usePlan();
  const [atelier, setAtelier] = useState<Atelier | null>(null);
  /**
   * Toutes les grilles actives de l'atelier, et celle qu'on est en train de régler.
   *
   * L'écran ne chargeait que `is_default` : la grille dédiée qu'un client peut se voir affecter
   * sur sa fiche, que l'éditeur de devis applique et que le bandeau « Grille dédiée appliquée »
   * annonce, n'avait donc aucun endroit où être créée ni corrigée. Trois écrans parlaient d'une
   * chose que rien ne permettait de faire exister.
   */
  const [grilles, setGrilles] = useState<Grille[]>([]);
  const [grilleId, setGrilleId] = useState<string | null>(null);
  const [grille, setGrille] = useState<Grille | null>(null);
  /** Numérotation par type de document, telle que la base la rend (`ma_numerotation()`). */
  const [numerotation, setNumerotation] = useState<LigneNumerotation[] | null>(null);
  const [numBusy, setNumBusy] = useState(false);
  const [paliers, setPaliers] = useState<GrillePalier[]>([]);
  const [coefs, setCoefs] = useState<GrilleCoef[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [tarifsMl, setTarifsMl] = useState<TarifMl[]>([]);
  const [piecesTypes, setPiecesTypes] = useState<PieceType[]>([]);
  const [saved, setSaved] = useState(false);
  const [equipe, setEquipe] = useState<{ id: string; email: string | null; nom: string | null; role: string; actif: boolean }[]>([]);
  const [invitations, setInvitations] = useState<{ id: string; email: string; token: string; role: string; accepted_at: string | null; expires_at: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  /** Rôle proposé à l'invité. Moindre privilège par défaut : on invite un opérateur, pas un commercial. */
  const [inviteRole, setInviteRole] = useState<Role>("atelier");
  /** Coordonnées bancaires et paramètres de coût : deux tables à part, deux droits distincts. */
  const [bancaire, setBancaire] = useState<{ iban: string | null; bic: string | null } | null>(null);
  const [couts, setCouts] = useState<{ taux_horaire: number | null; frais_generaux_pct: number } | null>(null);
  /**
   * Taux horaire par membre (C2). `null` (état, pas valeur) = la RLS de `users_couts` n'a rendu
   * aucune ligne pour ce compte : un rôle atelier ne doit voir ni les taux ni le champ pour les
   * saisir, exactement comme `couts` ci-dessus pour le taux d'atelier.
   */
  const [coutsEquipe, setCoutsEquipe] = useState<Record<string, number | null> | null>(null);
  /**
   * Décompte des sièges rendu par la base (`mes_sieges()`), et non recalculé ici.
   *
   * `occupes` compte les utilisateurs actifs **et** les invitations en attente non expirées,
   * exactement comme le trigger `trg_limite_utilisateurs` qui refuse l'insertion : un écran qui
   * compterait autrement annoncerait une place libre que la base refuserait, et l'atelier
   * croirait à une panne.
   */
  const [sieges, setSieges] = useState<{ plan: string; inclus: number; supp: number; autorises: number; occupes: number } | null>(null);
  /** Achat ou retrait de siège en attente de confirmation : on ne facture jamais sur un clic non prévenu. */
  const [siegeDemande, setSiegeDemande] = useState<{ cible: number; sens: "ajout" | "retrait" } | null>(null);
  const [siegeBusy, setSiegeBusy] = useState(false);
  const [workflow, setWorkflow] = useState<{ code: string; libelle: string }[]>([]);
  const [workflowJantes, setWorkflowJantes] = useState<{ code: string; libelle: string }[]>([]);
  const [sousOngletWorkflow, setSousOngletWorkflow] = useState<"general" | "jantes">("general");
  const [janteP, setJanteP] = useState<JantePalier[]>([]);
  const [sub, setSub] = useState<{ plan: string; status: string; trial_end: string | null } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [monId, setMonId] = useState("");
  const [siege, setSiege] = useState({ adresse: "", code_postal: "", ville: "" });
  /**
   * Ligne de barème en attente de confirmation.
   *
   * Deux suppressions n'en avaient aucune : un `✕` de 12 px effaçait sans un mot une tranche de
   * prix à la jante ou un coefficient de majoration — c'est-à-dire une ligne de barème tarifaire
   * qui chiffre tous les devis à venir. Rien ne la recréait, et rien ne disait ce qui venait de
   * disparaître.
   */
  const [baremeASupprimer, setBaremeASupprimer] = useState<{ table: string; id: string; quoi: string; libelle: string } | null>(null);
  /** Réglages d'alerte : seuil de DLU, heure du courriel du matin, cadence des relances. */
  const [alertes, setAlertes] = useState<ReglagesAlertes | null>(null);
  /** Mon abonnement personnel au courriel du matin (`null` = jamais envoyé, donc pas encore de ligne). */
  const [monRecap, setMonRecap] = useState<{ actif: boolean } | null>(null);
  /** Aperçu du courriel du matin sur les données réelles de l'atelier, pour le lire avant de l'activer. */
  const [apercu, setApercu] = useState<{ vide: boolean; action: { titre: string; detail: string } | null } | null>(null);
  /**
   * Conditions générales de vente par défaut de l'atelier (migration 76).
   *
   * Contrôlé (et non `defaultValue`, à la différence du reste de ce formulaire) pour offrir un
   * aperçu de ce que le client verra sans aller-retour serveur : c'est le texte qui part sur la
   * page publique du devis/facture, mot pour mot.
   */
  const [cgvApercu, setCgvApercu] = useState("");
  const toast = useToast();

  async function loadAll() {
    const [{ data: a }, { data: gs }, { data: p }, { data: ml }, { data: pt }] = await Promise.all([
      supabase.from("ateliers").select("*").maybeSingle(),
      // Toutes les grilles actives, la standard en tête : c'est ce qui rend possible une seconde
      // grille, donc le tarif dédié d'un client sous contrat.
      supabase.from("grilles_tarifaires")
        .select("id, atelier_id, nom, forfait_minimum, is_default, actif")
        .eq("actif", true)
        .order("is_default", { ascending: false })
        .order("nom"),
      supabase.from("prestations").select("*").order("ordre"),
      supabase.from("tarifs_ml").select("*").eq("actif", true).order("ordre"),
      supabase.from("pieces_types").select("*").eq("actif", true).order("ordre"),
    ]);
    setAtelier(a as Atelier);
    setSiege({ adresse: a?.adresse ?? "", code_postal: a?.code_postal ?? "", ville: a?.ville ?? "" });
    setCgvApercu((a as Atelier | null)?.cgv ?? "");
    const listeGrilles = ((gs as Grille[]) ?? []);
    // La grille en cours d'édition survit au rechargement : sans ça, corriger un palier d'une
    // grille dédiée renvoyait sur la grille standard au champ suivant.
    const g = listeGrilles.find((x) => x.id === grilleId) ?? listeGrilles.find((x) => x.is_default) ?? listeGrilles[0] ?? null;
    setGrilles(listeGrilles);
    setGrilleId(g?.id ?? null);
    setGrille(g);
    setPrestations((p as Prestation[]) ?? []);
    setTarifsMl((ml as TarifMl[]) ?? []);
    setPiecesTypes((pt as PieceType[]) ?? []);
    const [{ data: eq }, { data: inv }, { data: sb }, { data: sg }, { data: me }, { data: bq }, { data: ct }] = await Promise.all([
      supabase.from("users").select("id, email, nom, role, actif").order("created_at"),
      supabase.from("invitations").select("id, email, token, role, accepted_at, expires_at").is("accepted_at", null).order("created_at", { ascending: false }),
      // `subscriptions` n'est lisible que par le responsable : on passe par la RPC, qui rend
      // l'état sans les identifiants Stripe, et ne laisse donc pas le bureau devant un écran
      // qui prétend que l'atelier n'a pas d'abonnement.
      supabase.rpc("mon_abonnement"),
      supabase.rpc("mes_sieges"),
      supabase.auth.getUser(),
      // Deux tables satellites, deux portes distinctes : l'IBAN au responsable, le prix de
      // revient au responsable et au bureau. Un rôle qui n'y a pas droit reçoit `null` — pas une
      // erreur : l'écran masque simplement le bloc.
      supabase.from("ateliers_bancaire").select("iban, bic").maybeSingle(),
      supabase.from("ateliers_couts").select("taux_horaire, frais_generaux_pct").maybeSingle(),
    ]);
    setEquipe((eq as typeof equipe) ?? []);
    setInvitations((inv as typeof invitations) ?? []);
    setSub(sb as typeof sub);
    setBancaire((bq as typeof bancaire) ?? null);
    setCouts((ct as typeof couts) ?? null);
    // C2 — taux horaire par membre. RLS (owner/bureau en lecture) filtre déjà ce qu'un rôle
    // atelier ne doit pas voir ; l'écran n'a qu'à convertir les lignes en table indexée par membre.
    const { data: uc } = await supabase.from("users_couts").select("user_id, taux_horaire");
    setCoutsEquipe(Object.fromEntries(((uc as { user_id: string; taux_horaire: number | null }[]) ?? []).map((u) => [u.user_id, u.taux_horaire])));
    setSieges((sg as typeof sieges) ?? null);
    setMonId(me.user?.id ?? "");
    // Réglages d'alerte et abonnement personnel au récapitulatif. La RPC sait retomber sur les
    // défauts si la ligne n'existe pas encore ; `recap_destinataires`, elle, n'est créée qu'au
    // premier envoi — son absence veut dire « abonné, mais rien n'est encore parti ».
    const [{ data: al }, { data: rec }, { data: ap }, { data: num }] = await Promise.all([
      supabase.rpc("mes_reglages_alertes"),
      me.user?.id
        ? supabase.from("recap_destinataires").select("actif").eq("user_id", me.user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.rpc("mon_recap_quotidien"),
      // Préfixe, prochain numéro et verrou par type : tout vient de la base, y compris l'aperçu.
      // Un écran qui recalculerait le numéro de son côté finirait par annoncer autre chose que
      // ce que `_next_numero()` délivrera.
      supabase.rpc("ma_numerotation"),
    ]);
    setAlertes((al as ReglagesAlertes | null) ?? null);
    setMonRecap((rec as { actif: boolean } | null) ?? null);
    setApercu((ap as typeof apercu) ?? null);
    setNumerotation((num as LigneNumerotation[] | null) ?? []);
    const wf = (a?.settings as Record<string, unknown> | null)?.["workflow_defaut"] as { code: string; libelle: string }[] | undefined;
    setWorkflow(wf ?? [
      { code: "reception", libelle: "Réception" }, { code: "preparation", libelle: "Préparation / sablage" },
      { code: "poudrage", libelle: "Poudrage" }, { code: "cuisson", libelle: "Cuisson" },
      { code: "controle", libelle: "Contrôle" }, { code: "pret", libelle: "Prêt" }, { code: "livre", libelle: "Livré" },
    ]);
    const wfj = (a?.settings as Record<string, unknown> | null)?.["workflow_jantes"] as { code: string; libelle: string }[] | undefined;
    setWorkflowJantes(wfj ?? WORKFLOW_JANTES_DEFAUT);
    await chargerBaremes(g);
  }

  /** Paliers, coefficients et barème jante de la grille affichée — d'une grille à l'autre. */
  async function chargerBaremes(g: Grille | null) {
    if (!g) { setPaliers([]); setCoefs([]); setJanteP([]); return; }
    const [{ data: pl }, { data: cf }, { data: jp }] = await Promise.all([
      supabase.from("grille_paliers").select("*").eq("grille_id", g.id).order("surface_min"),
      supabase.from("grille_coefs").select("*").eq("grille_id", g.id).order("categorie"),
      supabase.from("jante_paliers").select("*").eq("grille_id", g.id).order("diametre_min"),
    ]);
    setPaliers((pl as GrillePalier[]) ?? []);
    setCoefs((cf as GrilleCoef[]) ?? []);
    setJanteP((jp as JantePalier[]) ?? []);
  }

  /**
   * Passer d'une grille à l'autre. Le rechargement est ciblé et non un `loadAll()` : celui-ci
   * relirait la grille depuis l'état capturé au rendu précédent et ramènerait la standard.
   */
  async function choisirGrille(id: string) {
    const g = grilles.find((x) => x.id === id) ?? null;
    setGrilleId(id);
    setGrille(g);
    await chargerBaremes(g);
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // D10 — l'ouverture directe sur un onglet (`/reglages?onglet=equipe`, depuis le pied du courriel
  // du matin, la fiche d'un devis ou l'espace comptable) et l'écriture au clic sont maintenant le
  // même mécanisme (`useEtatUrl`, lib/urlState.ts) : la lecture initiale se fait toujours sur
  // `window.location.search`, jamais `useSearchParams()`, pour ne pas imposer de frontière
  // Suspense à cette page.

  useTitreDocument("Réglages");

  if (!atelier) return <Spinner />;

  // Colonnes `four_*` / `prix_kwh` / `taux_horaire` / `frais_generaux_pct` ajoutées en migration 21,
  // `four_cycles_jour` / `four_remplissage_moyen_pct` / `garantie_mois` en migration 22 — absentes du
  // type `Atelier` historique (cf. src/lib/types.ts) pour ne pas y toucher.
  const four = atelier as Atelier & AtelierFour & AtelierLot2;

  // Les coefficients de jante vivent dans la même table que ceux du m² — mais pas dans le même
  // écran : un atelier qui ne fait pas de jantes n'a pas à voir « dessin » sous sa grille au m².
  const coefsOrdonnes = Object.entries(
    coefs.filter((c) => !c.categorie.startsWith("jante_")).reduce<Record<string, GrilleCoef[]>>((acc, c) => {
      (acc[c.categorie] ??= []).push(c);
      return acc;
    }, {})
  )
    .sort(([a], [b]) => (CATEGORIES_COEF[a]?.ordre ?? 99) - (CATEGORIES_COEF[b]?.ordre ?? 99) || a.localeCompare(b))
    .map(([cat, liste]) => [
      cat,
      [...liste].sort((x, y) => (ORDRE_COEF[x.code] ?? 99) - (ORDRE_COEF[y.code] ?? 99) || Number(x.coef) - Number(y.coef)),
    ] as [string, GrilleCoef[]]);

  function flash() { toast("Enregistré"); setSaved(true); setTimeout(() => setSaved(false), 1500); }

  /**
   * Enregistrement d'un réglage au fil de la saisie.
   *
   * « Enregistré » ne s'affiche que si la base a bien pris : les quarante champs de cet écran
   * confirmaient l'enregistrement sans jamais lire l'erreur. Un prix au m² refusé par RLS ou par
   * le verrou d'abonnement laissait l'atelier facturer au tarif qu'il croyait avoir corrigé.
   */
  async function sauver(requete: PromiseLike<{ error: unknown }>) {
    if (await ecrire(requete, toast)) flash();
  }

  /** Écriture suivie d'un rechargement complet de l'écran (ajout, suppression, activation). */
  async function sauverEtRecharger(requete: PromiseLike<{ error: unknown }>) {
    if (await ecrire(requete, toast)) await loadAll();
  }

  /**
   * Création d'une grille pré-remplie.
   *
   * `parDefaut` n'est plus forcé : une seconde grille (« Grille contrat menuisier ») s'affecte à
   * un client depuis sa fiche et prend le pas sur la standard au chiffrage. C'était la coquille
   * C-4 — trois écrans annonçaient une grille dédiée qu'aucun bouton ne savait créer.
   */
  async function createGrille(options?: { nom?: string; parDefaut?: boolean }) {
    const parDefaut = options?.parDefaut ?? grilles.length === 0;
    const nom = options?.nom?.trim() || (parDefaut ? "Grille standard" : `Grille dédiée ${grilles.length}`);
    const { data: g, error: errGrille } = await supabase
      .from("grilles_tarifaires")
      .insert({ atelier_id: atelier!.id, nom, is_default: parDefaut, forfait_minimum: parDefaut ? 50 : 0 })
      .select("id, atelier_id, nom, forfait_minimum, is_default, actif")
      .single();
    if (errGrille) { toast(errorFr(errGrille), "error"); return; }
    if (!g) return;
    // Une grille sans palier ni coefficient chiffre tout à zéro : si l'un des deux blocs ne passe
    // pas, l'atelier doit l'apprendre ici, pas au premier devis.
    if (!(await ecrire(supabase.from("grille_paliers").insert([
      { atelier_id: atelier!.id, grille_id: g.id, surface_min: 0, surface_max: 1, prix_m2: 90 },
      { atelier_id: atelier!.id, grille_id: g.id, surface_min: 1, surface_max: 5, prix_m2: 60 },
      { atelier_id: atelier!.id, grille_id: g.id, surface_min: 5, surface_max: 20, prix_m2: 45 },
      { atelier_id: atelier!.id, grille_id: g.id, surface_min: 20, surface_max: null, prix_m2: 35 },
    ]), toast))) return;
    if (!(await ecrire(supabase.from("grille_coefs").insert([
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "finition", code: "mat", libelle: "Mat / satiné", coef: 1 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "finition", code: "brillant", libelle: "Brillant", coef: 1.05 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "finition", code: "texture", libelle: "Texturé", coef: 1.1 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "finition", code: "metallise", libelle: "Métallisé / candy", coef: 1.25 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "complexite", code: "simple", libelle: "Simple", coef: 1 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "complexite", code: "moyenne", libelle: "Moyenne", coef: 1.15 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "complexite", code: "complexe", libelle: "Complexe", coef: 1.35 },
      // Une seconde couche, c'est un second passage en cabine et une seconde cuisson : sans ces
      // coefficients, le sélecteur de couches du devis n'aurait rien à proposer.
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "couche", code: "une", libelle: "1 couche", coef: 1 },
      { atelier_id: atelier!.id, grille_id: g.id, categorie: "couche", code: "deux", libelle: "2 couches (primaire + finition)", coef: 1.7 },
    ]), toast))) return;
    // On se place sur la grille qu'on vient de créer : c'est celle qu'on va régler.
    await rechargerGrilles(g.id);
    toast(`« ${nom} » créée. Ajustez ses paliers.`);
  }

  /**
   * Poser la numérotation d'un type de document.
   *
   * Aucune règle n'est évaluée ici : la base refuse le préfixe mal formé, le rang hors bornes, le
   * rôle qui n'est pas responsable et surtout la série déjà ouverte. L'écran ne fait que relire
   * l'état après coup — c'est la base qui dit ce que sera le prochain numéro.
   */
  async function poserNumerotation(type: string, prefixe: string, prochain: number): Promise<boolean> {
    const { data, error } = await supabase.rpc("poser_numerotation", {
      p_type: type, p_prefixe: prefixe, p_prochain: prochain,
    });
    if (error) { toast(errorFr(error), "error"); return false; }
    const { data: num } = await supabase.rpc("ma_numerotation");
    setNumerotation((num as LigneNumerotation[] | null) ?? []);
    toast(`Enregistré — votre prochain document sera ${data}.`);
    return true;
  }

  /**
   * « Je n'ai rien à reprendre ». On repose la valeur proposée telle quelle : ce n'est pas un
   * geste vide, c'est la trace que le responsable a vu la question et y a répondu — sans quoi
   * l'étape de démarrage resterait ouverte indéfiniment chez un atelier qui n'a rien à migrer.
   */
  async function confirmerNumerotationProposee() {
    setNumBusy(true);
    let ok = 0;
    for (const n of (numerotation ?? []).filter((x) => !x.verrouille)) {
      const { error } = await supabase.rpc("poser_numerotation", {
        p_type: n.type, p_prefixe: n.prefixe, p_prochain: n.prochain,
      });
      if (error) { toast(errorFr(error), "error"); break; }
      ok++;
    }
    const { data: num } = await supabase.rpc("ma_numerotation");
    setNumerotation((num as LigneNumerotation[] | null) ?? []);
    await loadAll();
    setNumBusy(false);
    if (ok > 0) toast("Numérotation confirmée.");
  }

  /** Relit la liste des grilles et se pose sur `prefere` (celle qu'on vient de créer, en général). */
  async function rechargerGrilles(prefere?: string) {
    const { data } = await supabase
      .from("grilles_tarifaires")
      .select("id, atelier_id, nom, forfait_minimum, is_default, actif")
      .eq("actif", true)
      .order("is_default", { ascending: false })
      .order("nom");
    const liste = (data as Grille[]) ?? [];
    const g = liste.find((x) => x.id === (prefere ?? grilleId)) ?? liste.find((x) => x.is_default) ?? liste[0] ?? null;
    setGrilles(liste);
    setGrilleId(g?.id ?? null);
    setGrille(g);
    await chargerBaremes(g);
  }

  // Décompte des sièges. Tout vient de `mes_sieges()` : l'écran n'invente aucun chiffre, il ne
  // fait qu'éviter de proposer un bouton que la base refuserait.
  // Le comptable est hors barème : gratuit, hors siège. Le compter avec les salariés ferait
  // afficher « 3 sur 2 » à un atelier qui n'a que deux employés et un cabinet.
  const membresActifs = equipe.filter((m) => m.actif && m.role !== "comptable").length;
  // Une invitation expirée ne consomme plus de siège en base : l'afficher comme telle éviterait
  // qu'un exploitant achète un siège pour une invitation qui ne bloque plus rien.
  const invitationsVives = invitations.filter(
    (i) => new Date(i.expires_at).getTime() > Date.now() && i.role !== "comptable"
  );
  const comptables = equipe.filter((m) => m.role === "comptable" && m.actif);
  const invitationsComptables = invitations.filter(
    (i) => new Date(i.expires_at).getTime() > Date.now() && i.role === "comptable"
  );
  const comptablesOccupes = comptables.length + invitationsComptables.length;
  /**
   * Le rôle en cours de sélection est-il celui du cabinet ? Il ne change pas la couleur du
   * bouton, il change le BARÈME : c'est `plafond_comptables()` qui décide, pas les sièges.
   */
  const inviteComptable = inviteRole === "comptable";
  const placesRestantes = sieges ? sieges.autorises - sieges.occupes : null;
  /** Membres à désactiver avant qu'un siège payé puisse être rendu. 0 = le siège est libre. */
  const aLiberer = sieges ? Math.max(0, sieges.occupes - (sieges.autorises - 1)) : 0;
  const coutSiegesMois = (sieges?.supp ?? 0) * PRIX_SIEGE_MENSUEL;
  const prixFormuleMois = offre(sub?.plan)?.prixMensuel ?? 0;

  /**
   * Achat ou retrait de sièges. `sieges` est le nombre **total** de sièges supplémentaires voulu,
   * pas un delta : la route est idempotente, un double clic ne facture pas deux fois.
   *
   * L'appel part vers `/api/billing/sieges` et jamais vers `subscriptions` : la colonne
   * `sieges_supp` est écrite par le webhook Stripe, sans quoi l'atelier ouvrirait des places
   * qu'il ne paie pas.
   */
  async function changerSieges(cible: number) {
    setSiegeBusy(true);
    try {
      const res = await fetch("/api/billing/sieges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sieges: cible }),
      });
      const data = await res.json().catch(() => ({} as { error?: string; code?: string }));
      if (!res.ok) {
        // D3 — même garde-fou que sur /abonnement : « Paiement non configuré sur le serveur. »
        // ne dit rien à qui essaie juste d'ajouter un utilisateur.
        toast(
          data.code === "STRIPE_NON_CONFIGURE"
            ? "Le paiement en ligne n'est pas encore ouvert. Écrivez-nous à contact@thermopoudre.fr."
            : (data.error ?? "Le changement de sièges n'a pas abouti."),
          "error",
        );
        return;
      }
      await loadAll();
      toast(cible > (sieges?.supp ?? 0) ? "Siège ajouté — la place est disponible immédiatement." : "Siège retiré de votre abonnement.");
    } catch {
      toast("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "error");
    } finally {
      setSiegeBusy(false);
      setSiegeDemande(null);
    }
  }

  const prixVerifies = !!(atelier.settings as Record<string, unknown> | null)?.prix_verifies_at;

  return (
    // Pas de `md:max-w-2xl` : la barre d'onglets défilait horizontalement, flèche comprise, sur
    // un écran qui pouvait tous les afficher.
    <div className="flex flex-col gap-4">
      <PageTitle action={<Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); }}>Déconnexion</Button>}>Réglages</PageTitle>
      <AstuceEcran cle="reglages" />
      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible" role="tablist">
        {ONGLETS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${tab === t ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {{ atelier: "Atelier", numerotation: "Numérotation", alertes: "Alertes", grille: "Grille m²", ml: "Prix au ml", jantes: "Jantes", pieces: "Pièces types", prestations: "Prestations", equipe: "Équipe", workflow: "Étapes", compte: "Compte" }[t]}
          </button>
        ))}
      </div>
      {saved && <p className="text-sm text-success-dark">Enregistré</p>}

      {tab === "atelier" && (
        <form className="flex flex-col gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          // Le formulaire d'identité de l'atelier confirmait « Enregistré » sans jamais lire son
          // erreur : SIREN, IBAN et mentions légales pouvaient être refusés sans que rien ne le
          // dise, et repartaient tels quels sur chaque devis et chaque facture.
          const okAtelier = await ecrire(supabase.from("ateliers").update({
            nom: f.get("nom"), siren: f.get("siren") || null, siret: f.get("siret") || null, tva_intra: f.get("tva_intra") || null,
            forme_juridique: f.get("forme_juridique") || null,
            capital_social: f.get("capital_social") ? Number(f.get("capital_social")) : null,
            rcs_ville: f.get("rcs_ville") || null, rm_numero: f.get("rm_numero") || null, code_ape: f.get("code_ape") || null,
            adresse: f.get("adresse") || null, adresse_complement: f.get("adresse_complement") || null,
            code_postal: f.get("code_postal") || null, ville: f.get("ville") || null,
            telephone: f.get("telephone") || null, email: f.get("email") || null, couleur: f.get("couleur") || null,
            assurance_nom: f.get("assurance_nom") || null, assurance_contrat: f.get("assurance_contrat") || null,
            assurance_zone: f.get("assurance_zone") || null,
            mediateur_nom: (f.get("mediateur_nom") as string)?.trim() || null,
            mediateur_adresse: (f.get("mediateur_adresse") as string)?.trim() || null,
            delai_paiement_jours: Number(f.get("delai_paiement_jours") || 30),
            penalites_taux: Number(f.get("penalites_taux") || 10),
            // Vide = on ne décide rien, la base appliquera son défaut de 30 jours. On envoie
            // `null` plutôt que 30 : écrire 30 en dur ici recopierait une troisième fois une
            // valeur qui n'a qu'une source, et c'est exactement ce qui a fait dériver les CGU.
            devis_validite_jours: f.get("devis_validite_jours") === "" ? null : Number(f.get("devis_validite_jours")),
            escompte_texte: f.get("escompte_texte") || null,
            cgv: cgvApercu.trim() || null,
            tva_sur_debits: f.get("tva_sur_debits") === "on",
            assujetti_tva: f.get("assujetti_tva") === "on",
            four_capacite_m2: f.get("four_capacite_m2") === "" ? null : Number(f.get("four_capacite_m2")),
            four_longueur_m: f.get("four_longueur_m") === "" ? null : Number(f.get("four_longueur_m")),
            four_conso_kwh: f.get("four_conso_kwh") === "" ? null : Number(f.get("four_conso_kwh")),
            prix_kwh: f.get("prix_kwh") === "" ? null : Number(f.get("prix_kwh")),
            four_cycles_jour: Number(f.get("four_cycles_jour") || 0),
            four_remplissage_moyen_pct: Number(f.get("four_remplissage_moyen_pct") || 0),
            garantie_mois: Number(f.get("garantie_mois") || 0),
            avis_google_url: (f.get("avis_google_url") as string)?.trim() || null,
          }).eq("id", atelier.id), toast);
          if (!okAtelier) return;

          // Les deux blocs sensibles vivent dans leurs propres tables, protégées par leur propre
          // policy. On ne les écrit que si l'écran les a affichés — sinon on enverrait une
          // écriture que la base refusera, et l'exploitant lirait un message d'erreur pour un
          // champ qu'il n'a même pas vu.
          if (estProprietaire) {
            const okBanque = await ecrire(
              supabase.from("ateliers_bancaire").upsert({
                atelier_id: atelier.id,
                iban: (f.get("iban") as string)?.trim() || null,
                bic: (f.get("bic") as string)?.trim() || null,
              }),
              toast,
            );
            if (!okBanque) return;
          }
          if (couts) {
            const okCouts = await ecrire(
              supabase.from("ateliers_couts").upsert({
                atelier_id: atelier.id,
                taux_horaire: f.get("taux_horaire") === "" ? null : Number(f.get("taux_horaire")),
                frais_generaux_pct: Number(f.get("frais_generaux_pct") || 0),
              }),
              toast,
            );
            if (!okCouts) return;
          }
          if (estProprietaire) setBancaire({ iban: (f.get("iban") as string) || null, bic: (f.get("bic") as string) || null });
          if (couts) {
            setCouts({
              taux_horaire: f.get("taux_horaire") === "" ? null : Number(f.get("taux_horaire")),
              frais_generaux_pct: Number(f.get("frais_generaux_pct") || 0),
            });
          }
          flash();
        }}>
          <Input label="Nom" name="nom" defaultValue={atelier.nom} required />

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Identité légale</p>
          <p className="-mt-2 text-xs text-gray-500">
            Ces informations sont des mentions obligatoires sur vos devis et vos factures. À partir de
            septembre 2027, la facturation électronique les rendra indispensables pour émettre.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="SIREN" name="siren" defaultValue={atelier.siren ?? ""} inputMode="numeric" />
            <Input label="SIRET (siège)" name="siret" defaultValue={atelier.siret ?? ""} inputMode="numeric" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Forme juridique" name="forme_juridique" defaultValue={atelier.forme_juridique ?? ""} placeholder="SARL, SASU, EI…" />
            <Input label="Capital social (€)" name="capital_social" type="number" step="0.01" defaultValue={atelier.capital_social ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="RCS (ville du greffe)" name="rcs_ville" defaultValue={atelier.rcs_ville ?? ""} placeholder="Ex : Toulon" />
            <Input label="N° répertoire des métiers" name="rm_numero" defaultValue={atelier.rm_numero ?? ""} placeholder="Si artisan (CMA)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="TVA intracom." name="tva_intra" defaultValue={atelier.tva_intra ?? ""} />
            <Input label="Code APE" name="code_ape" defaultValue={atelier.code_ape ?? ""} />
          </div>
          {/* L'assujettissement était lu par les devis, les factures, les PDF et le XML Factur-X,
              mais n'était saisissable nulle part : un atelier en franchise en base ne pouvait pas
              faire apparaître la mention de l'article 293 B, pourtant obligatoire. */}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="assujetti_tva" defaultChecked={atelier.assujetti_tva ?? true} className="mt-0.5" />
            <span>
              Je suis assujetti à la TVA
              <span className="block text-xs text-gray-500">
                Décochez si vous êtes en franchise en base : la mention « TVA non applicable, art. 293 B du CGI »
                remplacera alors la TVA sur vos devis et vos factures.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="tva_sur_debits" defaultChecked={atelier.tva_sur_debits} className="mt-0.5" />
            <span>
              J&apos;ai opté pour le paiement de la TVA d&apos;après les débits
              <span className="block text-xs text-gray-500">Si vous avez fait ce choix, la mention devient obligatoire sur vos factures.</span>
            </span>
          </label>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Siège</p>
          {/* L'adresse du siège est une mention obligatoire des factures : l'autocomplétion BAN
              évite les saisies du type « 83150 bandol » collées dans le champ Ville. */}
          <AdresseInput
            valeur={siege.adresse}
            codePostal={siege.code_postal}
            onSaisieLibre={(v) => setSiege((p) => ({ ...p, adresse: v }))}
            onChoisir={(a) => setSiege({ adresse: a.adresse, code_postal: a.code_postal, ville: a.ville })}
          />
          <input type="hidden" name="adresse" value={siege.adresse} />
          <Input label="Complément (bâtiment, ZI…)" name="adresse_complement" defaultValue={atelier.adresse_complement ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code postal" name="code_postal" value={siege.code_postal} onChange={(e) => setSiege((p) => ({ ...p, code_postal: e.target.value }))} />
            <Input label="Ville" name="ville" value={siege.ville} onChange={(e) => setSiege((p) => ({ ...p, ville: e.target.value }))} />
          </div>
          {atelier.adresse_verifiee && (
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-success-dark"><Check size={14} aria-hidden /> Adresse vérifiée dans la Base Adresse Nationale</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Téléphone" name="telephone" defaultValue={atelier.telephone ?? ""} />
            <Input label="Email" name="email" type="email" defaultValue={atelier.email ?? ""} />
          </div>

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Règlement</p>
          {/* L'IBAN vit dans `ateliers_bancaire`, dont la policy ne s'ouvre qu'au responsable.
              Le champ n'est pas « grisé » : il n'existe pas pour les autres, exactement comme la
              donnée n'existe pas pour eux dans la base. */}
          {estProprietaire ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="IBAN" name="iban" defaultValue={bancaire?.iban ?? ""} placeholder="FR76…" />
              <Input label="BIC" name="bic" defaultValue={bancaire?.bic ?? ""} />
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Les coordonnées bancaires de l&apos;atelier sont réservées au responsable. Elles
              s&apos;impriment normalement sur vos factures.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              {/* Défaut n°1 (recette vague 3) — `min`/`max` sur ce champ n'ont jamais d'effet natif :
                  `ChampDecimal` le rend en `<input type="text">` (voir `ui.tsx`), donc rien
                  n'empêchait de taper 999 puis de l'envoyer tel quel, refusé par
                  `ateliers_delai_paiement_check` (migration 62) sans qu'aucun message ne le
                  dise — le formulaire entier passe par `ecrire()` (plus bas) mais seulement au
                  clic sur « Enregistrer », trop tard pour l'opérateur qui vient de taper. On borne
                  donc dès le blur, comme le taux horaire de l'onglet Équipe et les seuils de
                  l'onglet Alertes : la valeur affichée se corrige tout de suite, avec le message
                  qui explique pourquoi — la vérification serveur reste en place derrière comme
                  filet, via `ecrire()`/`errorFr` au moment d'enregistrer. */}
              <Input
                label="Délai de paiement (jours)"
                name="delai_paiement_jours"
                type="number"
                min="0"
                max="60"
                inputMode="numeric"
                defaultValue={atelier.delai_paiement_jours ?? 30}
                onBlur={(e) => {
                  const brut = e.target.value.trim();
                  if (brut === "") return;
                  const n = Number(brut.replace(",", "."));
                  if (!Number.isFinite(n)) return;
                  const v = Math.min(60, Math.max(0, Math.round(n)));
                  if (v !== n) toast(`Le délai de paiement est compris entre 0 et 60 jours (L441-10 du code de commerce) : ramené à ${v}.`, "error");
                  if (v !== (atelier.delai_paiement_jours ?? 30)) setAtelier({ ...atelier, delai_paiement_jours: v });
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                Repris par défaut sur un client sans condition négociée ; entre professionnels, la loi plafonne à 60 jours.
              </p>
            </div>
            <Input label="Pénalités de retard (% / an)" name="penalites_taux" type="number" step="0.01" defaultValue={atelier.penalites_taux ?? 10} />
          </div>
          <Input label="Escompte" name="escompte_texte" defaultValue={atelier.escompte_texte ?? ""} placeholder="Pas d'escompte pour paiement anticipé" />
          {/* La durée de validité était jusqu'ici imprimée sur chaque devis — « valable 30 jours » —
              sans qu'aucun écran ne permette de la décider. Depuis la migration 45 elle engage
              vraiment : passé ce délai, le client ne peut plus signer. */}
          <Input
            label="Validité des devis (jours)"
            name="devis_validite_jours"
            type="number"
            min={VALIDITE_DEVIS_MIN}
            max={VALIDITE_DEVIS_MAX}
            defaultValue={atelier.devis_validite_jours ?? ""}
            placeholder={String(VALIDITE_DEVIS_DEFAUT)}
          />
          <p className="-mt-1 text-xs text-gray-500">
            Appliquée aux <b>nouveaux</b> devis, et imprimée dessus. Passé ce délai, le lien de
            signature refuse la signature et le devis passe en « expiré » — vous pourrez toujours le
            repasser en brouillon pour relancer sa validité. Laissez vide pour {VALIDITE_DEVIS_DEFAUT} jours.
          </p>
          <p className="-mt-1 text-xs text-gray-500">
            Le délai légal maximum entre professionnels est de 60 jours (ou 45 jours fin de mois). Les
            pénalités ne peuvent pas être inférieures à trois fois le taux d&apos;intérêt légal. L&apos;indemnité
            forfaitaire de recouvrement de 40 € est ajoutée automatiquement.
          </p>

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Assurance</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Assureur" name="assurance_nom" defaultValue={atelier.assurance_nom ?? ""} />
            <Input label="N° de contrat" name="assurance_contrat" defaultValue={atelier.assurance_contrat ?? ""} />
          </div>
          <Input label="Couverture géographique" name="assurance_zone" defaultValue={atelier.assurance_zone ?? ""} placeholder="France métropolitaine" />
          <p className="-mt-1 text-xs text-gray-500">
            Obligatoire sur les factures si vous êtes artisan et intervenez sur des ouvrages de bâtiment
            (garde-corps, portails, menuiseries). Sans objet pour du laquage de pièces en atelier.
          </p>

          {/* C6 — mention obligatoire pour vos clients particuliers (art. L616-1 du code de la
              consommation). Vide par défaut : le PDF et la page publique du devis signalent
              l'absence tant que le champ n'est pas renseigné. */}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Médiateur de la consommation</p>
          <p className="-mt-2 text-xs text-gray-500">
            Obligatoire dès que vous vendez à des particuliers. Sans médiateur désigné, vos devis et
            factures adressés à un particulier le signalent.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nom du médiateur" name="mediateur_nom" defaultValue={atelier.mediateur_nom ?? ""} />
            <Input label="Adresse" name="mediateur_adresse" defaultValue={atelier.mediateur_adresse ?? ""} />
          </div>

          {/* Migration 76 — conditions générales de vente par défaut de l'atelier. Vide par défaut :
              aucun modèle n'est proposé ici, ce serait donner un conseil juridique à un atelier qui
              l'appliquerait sans le lire. Le texte figé sur un devis envoyé ou une facture émise ne
              bouge plus, quoi que vous changiez ici ensuite — voir l'aide sous le champ. */}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Conditions générales de vente</p>
          <p className="-mt-2 text-xs text-gray-500">
            Facultatif. Ce texte part sur tous vos devis et factures : en annexe du PDF, et sur la
            page publique consultée par le client — avant qu&apos;il ne signe un devis. Une fois un
            devis envoyé ou une facture émise, le texte alors en vigueur est figé sur ce document :
            le modifier ici n&apos;affecte plus rien de ce qui est déjà parti. Un client sous contrat
            particulier peut avoir ses propres conditions, qui remplacent celles-ci : voir sa fiche.
          </p>
          <Textarea
            name="cgv"
            rows={8}
            value={cgvApercu}
            onChange={(e) => setCgvApercu(e.target.value)}
            placeholder="Vos conditions générales de vente (garantie, responsabilité, rétractation, juridiction…). Laissez vide si vous n'en avez pas encore rédigé."
          />
          <p className="-mt-1 text-xs text-gray-500">{cgvApercu.length.toLocaleString("fr-FR")} / 20 000 caractères.</p>
          {cgvApercu.trim() && (
            <details className="rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-medium text-gray-700">
                Aperçu — ce que le client verra
              </summary>
              <p className="whitespace-pre-wrap border-t border-gray-100 px-3 py-3 text-xs leading-relaxed text-gray-600">
                {cgvApercu}
              </p>
            </details>
          )}

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Four & prix de revient</p>
          <p className="-mt-2 text-xs text-gray-500">
            Sert au planning des fournées (jauge de remplissage) et au calcul du prix de revient réel
            de chaque projet (quote-part d&apos;énergie, main d&apos;œuvre, frais généraux).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Capacité du four (m²)" name="four_capacite_m2" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={four.four_capacite_m2 ?? ""} placeholder="Ex : 8" />
            <Input label="Longueur utile (m)" name="four_longueur_m" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={four.four_longueur_m ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Conso. four (kWh / cycle)" name="four_conso_kwh" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={four.four_conso_kwh ?? ""} />
            <Input label="Prix du kWh (€)" name="prix_kwh" type="number" step="0.0001" min="0" inputMode="decimal" defaultValue={four.prix_kwh ?? ""} />
          </div>
          {/* Taux horaire et frais généraux sont sortis de `ateliers` : ils donnent le prix de
              revient, donc la marge. `ateliers_couts` ne s'ouvre qu'au responsable et au bureau. */}
          {couts ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Taux horaire main d'œuvre (€/h)" name="taux_horaire" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={couts.taux_horaire ?? ""} />
              <Input label="Frais généraux (%)" name="frais_generaux_pct" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={couts.frais_generaux_pct ?? 0} />
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Le taux horaire et les frais généraux servent au calcul de la marge : ils sont
              réservés au responsable et au bureau.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cycles de four par jour" name="four_cycles_jour" type="number" step="0.5" min="0" inputMode="decimal" defaultValue={four.four_cycles_jour ?? 3} />
            <Input label="Remplissage moyen du four (%)" name="four_remplissage_moyen_pct" type="number" step="1" min="0" max="100" inputMode="numeric" defaultValue={four.four_remplissage_moyen_pct ?? 75} />
          </div>
          <p className="-mt-1 text-xs text-gray-500">
            Ces deux chiffres, croisés avec la capacité du four, donnent les m² que vous pouvez laquer
            dans une journée — donc la date de livraison que <Link href="/pilotage" className="text-brand underline">Pilotage</Link> propose
            sur vos devis. Personne ne remplit un four à 100 % : le taux moyen réellement observé compte
            plus que la capacité théorique.
          </p>

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Certificat de conformité</p>
          <Input label="Durée de garantie du revêtement (mois)" name="garantie_mois" type="number" step="1" min="0" inputMode="numeric" defaultValue={four.garantie_mois ?? 24} />
          <p className="-mt-1 text-xs text-gray-500">
            Portée sur chaque certificat de conformité que vous remettez à un industriel ou à une
            collectivité. Vos labels et leurs échéances se gèrent dans <Link href="/qualite/certifications" className="text-brand underline">Qualité → Certifications</Link>.
          </p>

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Avis clients</p>
          <Input
            label="Lien de votre fiche Google"
            name="avis_google_url"
            type="url"
            defaultValue={atelier.avis_google_url ?? ""}
            placeholder="https://g.page/r/…/review"
          />
          <p className="-mt-1 text-xs text-gray-500">
            Deux jours après la signature d&apos;un bon de livraison, votre client reçoit un message qui
            lui propose de laisser un avis. Sans ce lien, rien n&apos;est envoyé. Un même client n&apos;est
            sollicité qu&apos;une fois par trimestre. Pour obtenir le lien : fiche Google de votre
            établissement → <b>Demander des avis</b>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Couleur de votre atelier</span>
              <input type="color" name="couleur" defaultValue={atelier.couleur ?? "#147085"} className="h-11 w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />
              <span className="mt-1 block text-xs text-gray-500">Appliquée sur vos devis et pages de suivi client.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Logo (PNG, JPEG ou WebP — 2 Mo max.)</span>
              {atelier.logo_url && <img src={atelier.logo_url} alt="Logo" className="mb-1 h-9 object-contain" />}
              {/* Le dépôt dans le bucket `logos` est réservé au responsable depuis la migration
                  `39_stockage_roles_familles_et_demo`, pour la raison suivante : le fichier
                  n'existe que pour être recopié dans `ateliers.logo_url`, et cette écriture-là
                  était DÉJÀ réservée au responsable. Ouvrir le champ plus large produisait un
                  fichier orphelin dans le bucket et un exploitant persuadé d'avoir changé son
                  logo. On affiche donc l'explication plutôt que le sélecteur. */}
              {!estProprietaire ? (
                <p className="rounded-lg bg-gray-50 p-2 text-2xs text-gray-600">
                  Le logo fait partie de l&apos;identité de l&apos;atelier : seul le responsable
                  peut le changer.
                </p>
              ) : (
              <input type="file" accept={ACCEPT_LOGO} className="w-full text-xs" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Refus prononcé avant l'envoi : le service de stockage plafonne aussi (2 Mo,
                // liste blanche), mais il répond « Payload too large » en anglais après avoir
                // encaissé le fichier entier.
                if (!(TYPES_LOGO as readonly string[]).includes(file.type)) {
                  toast("Le logo doit être un PNG, un JPEG ou un WebP.", "error"); e.target.value = ""; return;
                }
                if (file.size > TAILLE_MAX_LOGO) {
                  toast("Le logo dépasse 2 Mo. Un fichier plus léger s'affichera aussi bien et allégera chaque PDF.", "error");
                  e.target.value = ""; return;
                }
                const path = cheminLogo(atelier.id, file.name);
                const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type });
                if (upErr) { toast(errorFr(upErr), "error"); return; }
                const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
                if (!(await ecrire(supabase.from("ateliers").update({ logo_url: pub.publicUrl }).eq("id", atelier.id), toast))) {
                  // Sans ce rattrapage, un refus sur la table laisse dans un bucket PUBLIC un
                  // fichier que plus aucune ligne ne désigne — et que le produit ne sait pas
                  // retirer. C'est exactement l'état dans lequel l'audit a trouvé `logos`.
                  await supabase.storage.from("logos").remove([path]);
                  return;
                }
                await loadAll();
                toast("Logo mis à jour");
              }} />
              )}
            </label>
          </div>
          <Button type="submit">Enregistrer</Button>
        </form>
      )}

      {tab === "numerotation" && (
        <div className="flex flex-col gap-3">
          <Card>
            <div className="text-sm font-semibold">Reprenez votre numérotation</div>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Vous n&apos;en êtes pas à votre première facture. Si Thermogestion repart à 0001 alors que
              vous en êtes à 0347, votre exercice porte <b>deux séries pour la même année</b> : le
              fichier des écritures est refusé par votre comptable, et la numérotation continue
              qu&apos;impose l&apos;administration n&apos;est plus tenue. Posez ici le préfixe et le prochain
              numéro de chaque document — <b>avant</b> d&apos;en émettre un seul. Après, la série est
              ouverte et le compteur ne se déplace plus : ce serait un trou ou un doublon.
            </p>
            {!estProprietaire && (
              <p className="mt-2 text-xs text-danger">
                Seul le responsable de l&apos;atelier peut poser la numérotation : elle engage la
                comptabilité de l&apos;entreprise.
              </p>
            )}
          </Card>

          {numerotation === null ? (
            <Spinner />
          ) : (
            <>
              {numerotation.map((n) => (
                <CarteNumerotation
                  key={`${n.type}-${n.prefixe}-${n.prochain}`}
                  ligne={n}
                  modifiable={estProprietaire}
                  onPoser={poserNumerotation}
                />
              ))}
              {numerotation.some((n) => !n.verrouille) && (
                <Card>
                  <div className="text-sm font-semibold">Vous n&apos;avez rien à reprendre ?</div>
                  <p className="mt-1 text-xs text-gray-600">
                    Vous créez votre entreprise, ou vous n&apos;avez jamais facturé : gardez ce qui est
                    proposé ci-dessus. Confirmez-le une fois, et la question ne reviendra plus.
                  </p>
                  <Button
                    className="mt-3"
                    variant="secondary"
                    loading={numBusy}
                    disabled={!estProprietaire}
                    onClick={confirmerNumerotationProposee}
                  >
                    Garder la numérotation proposée
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {tab === "alertes" && (() => {
        // Repli sur les défauts pendant le chargement : l'écran ne doit pas afficher des champs
        // vides que l'exploitant prendrait pour « aucune alerte », alors que le courriel du matin
        // est actif par défaut.
        const a = alertes ?? { atelier_id: "", ...REGLAGES_ALERTES_DEFAUT };
        const enregistrer = (champs: Partial<ReglagesAlertes>) => {
          setAlertes({ ...a, ...champs } as ReglagesAlertes);
          // `upsert` et non `update` : la ligne peut ne pas exister pour un atelier créé après la
          // migration. Sans ça, le réglage serait accepté à l'écran et perdu en base.
          return sauver(
            supabase.from("reglages_alertes").upsert({ atelier_id: atelier.id, ...champs }, { onConflict: "atelier_id" }),
          );
        };
        return (
          <div className="flex flex-col gap-4 md:max-w-2xl">
            <Card className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Le courriel du matin</div>
              <p className="-mt-2 text-sm text-gray-600">
                Un seul message par jour, envoyé à toute l&apos;équipe : ce qui doit sortir et ce qui
                est en retard, ce qui est arrivé hier, ce qui va coincer, et l&apos;argent qui dort.
                Aucun message les jours où il n&apos;y a rien à dire — c&apos;est ce qui fait qu&apos;on
                le lit encore le jour où il y a quelque chose. Chacun voit ce que son rôle lui
                permet de voir : un compte d&apos;atelier n&apos;y lit ni devis, ni facture, ni montant.
              </p>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5"
                  checked={a.recap_actif}
                  onChange={(e) => enregistrer({ recap_actif: e.target.checked })}
                />
                <span>Envoyer le récapitulatif quotidien</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Heure d'envoi"
                  value={String(a.recap_heure)}
                  onChange={(e) => enregistrer({ recap_heure: Number(e.target.value) })}
                  disabled={!a.recap_actif}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")} h 00</option>
                  ))}
                </Select>
                <label className="flex items-start gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5"
                    checked={a.recap_jours_ouvres}
                    disabled={!a.recap_actif}
                    onChange={(e) => enregistrer({ recap_jours_ouvres: e.target.checked })}
                  />
                  <span>Jours ouvrés seulement<span className="block text-xs text-gray-500">Rien le samedi ni le dimanche.</span></span>
                </label>
              </div>

              {/* Amélioration n°7 : rappel mensuel de pesée de rendement, section du même
                  courriel — coupable indépendamment du reste, comme les autres alertes. */}
              <label className="flex items-start gap-2 border-t border-gray-100 pt-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5"
                  checked={a.rappel_pesee_actif}
                  disabled={!a.recap_actif}
                  onChange={(e) => enregistrer({ rappel_pesee_actif: e.target.checked })}
                />
                <span>
                  Rappeler la pesée de rendement des teintes
                  <span className="block text-xs text-gray-500">
                    Une fois par mois environ : les teintes jamais pesées, ou pesées il y a plus de
                    35 jours, avec un lien direct vers l&apos;écran de pesée. Rien si aucune teinte
                    n&apos;est concernée.
                  </span>
                </span>
              </label>

              {/* L'abonnement personnel : couper pour soi sans couper pour l'atelier. C'est
                  l'équivalent en ligne du lien « ne plus recevoir » du pied de message. */}
              <label className="flex items-start gap-2 border-t border-gray-100 pt-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5"
                  checked={monRecap?.actif ?? true}
                  onChange={async (e) => {
                    const actif = e.target.checked;
                    setMonRecap({ actif });
                    await sauver(
                      supabase.from("recap_destinataires").upsert(
                        { user_id: monId, atelier_id: atelier.id, actif, desinscrit_at: actif ? null : new Date().toISOString() },
                        { onConflict: "user_id" },
                      ),
                    );
                  }}
                />
                <span>
                  Me l&apos;envoyer, à moi
                  <span className="block text-xs text-gray-500">
                    Ne concerne que votre adresse. Vos collègues continuent de le recevoir.
                  </span>
                </span>
              </label>

              {/* L'aperçu sur les données réelles : on ne demande pas à un exploitant d'activer
                  un envoi automatique sans lui montrer d'abord ce qu'il dirait ce matin. */}
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ce que vous recevriez ce matin</div>
                {apercu == null ? (
                  <p className="mt-1 text-gray-500">Calcul en cours…</p>
                ) : apercu.vide ? (
                  <p className="mt-1 text-gray-600">
                    Rien à signaler aujourd&apos;hui — aucun message ne partirait.
                  </p>
                ) : (
                  <p className="mt-1">
                    <b>{apercu.action?.titre ?? "Plusieurs points à regarder"}</b>
                    {apercu.action?.detail ? <span className="block text-xs text-gray-500">{apercu.action.detail}</span> : null}
                  </p>
                )}
              </div>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="text-sm font-semibold">Ce qui déclenche une alerte</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Input
                    label="Poudre à écouler avant sa DLU (jours)"
                    type="number" min="1" max="365" inputMode="numeric"
                    defaultValue={a.seuil_dlu_jours}
                    onBlur={(e) => {
                      const v = Math.min(365, Math.max(1, Number(e.target.value) || REGLAGES_ALERTES_DEFAUT.seuil_dlu_jours));
                      if (v !== a.seuil_dlu_jours) enregistrer({ seuil_dlu_jours: v });
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Le même nombre colore les badges de vos écrans Stock et Lots et décide de ce que
                    le courriel du matin annonce. Un atelier de série n&apos;a pas les mêmes soixante
                    jours qu&apos;un atelier de pièce unique.
                  </p>
                </div>
                <div>
                  <Input
                    label="Devis sans réponse au bout de (jours)"
                    type="number" min="1" max="365" inputMode="numeric"
                    defaultValue={a.devis_sans_reponse_jours}
                    onBlur={(e) => {
                      const v = Math.min(365, Math.max(1, Number(e.target.value) || REGLAGES_ALERTES_DEFAUT.devis_sans_reponse_jours));
                      if (v !== a.devis_sans_reponse_jours) enregistrer({ devis_sans_reponse_jours: v });
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Au-delà, le devis remonte dans la rubrique « l&apos;argent » du récapitulatif.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Relances automatiques de vos clients</div>
                <Link href="/relances" className="text-xs text-brand underline underline-offset-2">Voir ce qui est parti →</Link>
              </div>
              <p className="-mt-2 text-sm text-gray-600">
                Ces réglages décident de ce que Thermogestion écrit <b>à vos clients</b>, en votre
                nom. Ils ne s&apos;appliquent jamais à un document mis à la corbeille, à une facture
                déjà soldée, ni à un client que vous avez exclu depuis sa fiche.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Devis : tous les (jours)"
                  type="number" min="1" max="90" inputMode="numeric"
                  defaultValue={a.relance_devis_jours}
                  onBlur={(e) => {
                    const v = Math.min(90, Math.max(1, Number(e.target.value) || REGLAGES_ALERTES_DEFAUT.relance_devis_jours));
                    if (v !== a.relance_devis_jours) enregistrer({ relance_devis_jours: v });
                  }}
                />
                <Input
                  label="Facture échue : tous les (jours)"
                  type="number" min="1" max="90" inputMode="numeric"
                  defaultValue={a.relance_facture_jours}
                  onBlur={(e) => {
                    const v = Math.min(90, Math.max(1, Number(e.target.value) || REGLAGES_ALERTES_DEFAUT.relance_facture_jours));
                    if (v !== a.relance_facture_jours) enregistrer({ relance_facture_jours: v });
                  }}
                />
                <Input
                  label="Relances maximum"
                  type="number" min="0" max="10" inputMode="numeric"
                  defaultValue={a.relance_max}
                  onBlur={(e) => {
                    const v = Math.min(10, Math.max(0, Number(e.target.value)));
                    if (v !== a.relance_max) enregistrer({ relance_max: v });
                  }}
                />
              </div>
              <p className="text-xs text-gray-500">
                Mettre <b>0</b> relance maximum coupe toutes les relances automatiques de
                l&apos;atelier, sans rien perdre de l&apos;historique déjà envoyé.
              </p>
            </Card>
          </div>
        );
      })()}

      {tab === "grille" && !grille && (
        <Card className="text-center">
          <p className="mb-3 text-sm text-gray-600">Pas encore de grille tarifaire. On vous en crée une pré-remplie (paliers + coefficients) que vous ajustez ensuite.</p>
          <Button onClick={() => createGrille({ parDefaut: true })}>Créer ma grille standard</Button>
        </Card>
      )}

      {tab === "grille" && grille && (
        <div className="flex flex-col gap-3">
          {/* Sélecteur de grille. Un atelier a une grille standard, et parfois une grille
              négociée avec un donneur d'ordre : c'est celle-là qu'on affecte à un client depuis
              sa fiche, et que le devis applique à sa place. */}
          <Card>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <Select
                  label="Grille à régler"
                  value={grille.id}
                  onChange={(e) => choisirGrille(e.target.value)}
                >
                  {grilles.map((g) => (
                    <option key={g.id} value={g.id}>{g.nom}{g.is_default ? " (standard)" : ""}</option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" onClick={() => createGrille({ parDefaut: false })}>
                Nouvelle grille dédiée
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Input
                label="Nom de cette grille"
                defaultValue={grille.nom}
                key={`nom-${grille.id}`}
                onBlur={(e) => {
                  const nom = e.target.value.trim();
                  if (!nom || nom === grille.nom) return;
                  sauverEtRecharger(supabase.from("grilles_tarifaires").update({ nom }).eq("id", grille.id));
                }}
              />
              {grille.is_default ? (
                <p className="text-xs text-gray-500">
                  C&apos;est votre grille standard : elle s&apos;applique à tout client qui n&apos;a pas de
                  grille dédiée sur sa fiche.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 text-xs text-gray-500">
                    Grille dédiée. Elle ne sert qu&apos;aux clients à qui vous l&apos;affectez, depuis
                    l&apos;onglet « Conditions commerciales » de leur fiche.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => sauverEtRecharger(supabase.from("grilles_tarifaires").update({ is_default: true }).eq("id", grille.id))}
                  >
                    En faire ma grille standard
                  </Button>
                </div>
              )}
            </div>
          </Card>
          {/* Une grille pré-remplie et jamais relue est plus dangereuse qu'une grille vide :
              l'atelier facture au tarif de quelqu'un d'autre sans s'en apercevoir. La checklist
              de démarrage se coche sur cet horodatage, et sur rien d'autre. */}
          {!prixVerifies && (
            <Card className="border-warning/40 bg-warning-light/40">
              <div className="text-sm font-semibold text-warning-dark">Ce sont des prix de départ, pas les vôtres</div>
              <p className="mt-1 text-xs text-gray-700">
                Les paliers et coefficients ci-dessous ont été posés à votre inscription avec des
                ordres de grandeur du marché français. Passez-les en revue, corrigez ce qui ne
                correspond pas à votre atelier, puis confirmez ici : tous vos devis en dépendent.
              </p>
              <Button
                className="mt-3"
                onClick={async () => {
                  const settings = { ...(atelier.settings as Record<string, unknown>), prix_verifies_at: new Date().toISOString() };
                  if (await ecrire(supabase.from("ateliers").update({ settings }).eq("id", atelier.id), toast, "Prix confirmés")) await loadAll();
                }}
              >
                J&apos;ai vérifié mes prix
              </Button>
            </Card>
          )}
          <Card>
            <div className="mb-1 text-sm font-semibold">Paliers de surface (prix €/m²)</div>
            <p className="mb-2 text-xs text-gray-500">Les modifications s&apos;enregistrent automatiquement quand vous quittez un champ.</p>
            {paliers.map((p) => (
              <div key={p.id} className="mb-2 grid grid-cols-3 gap-2">
                <Input type="number" step="0.01" defaultValue={p.surface_min} label="De (m²)" onBlur={(e) => sauver(supabase.from("grille_paliers").update({ surface_min: Number(e.target.value) }).eq("id", p.id))} />
                <Input type="number" step="0.01" defaultValue={p.surface_max ?? ""} label="À (m²)" placeholder="∞" onBlur={(e) => sauver(supabase.from("grille_paliers").update({ surface_max: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
                <Input type="number" step="0.01" defaultValue={p.prix_m2} label="€/m²" onBlur={(e) => sauver(supabase.from("grille_paliers").update({ prix_m2: Number(e.target.value) }).eq("id", p.id))} />
              </div>
            ))}
          </Card>
          <Card>
            <div className="mb-1 text-sm font-semibold">Coefficients</div>
            <p className="mb-3 text-xs text-gray-500">
              Multiplicateurs appliqués au prix au m² du palier, et qui se multiplient entre eux :
              finition × complexité × nombre de couches. 1,00 = pas de majoration. Chaque ligne au m²
              d&apos;un devis vous laisse choisir dans les trois listes.
            </p>
            {coefsOrdonnes.map(([categorie, liste]) => (
              <div key={categorie} className="mb-3 last:mb-0">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {CATEGORIES_COEF[categorie]?.libelle ?? categorie}
                </div>
                {liste.map((c) => (
                  <div key={c.id} className="mb-2 grid grid-cols-[1fr_100px] items-end gap-2">
                    <Input defaultValue={c.libelle} onBlur={(e) => sauver(supabase.from("grille_coefs").update({ libelle: e.target.value }).eq("id", c.id))} />
                    <Input
                      type="number" step="0.01" label="Coef."
                      // D6 — `defaultValue={c.coef}` affichait « 1.15 » (numeric PostgREST, en
                      // chaîne) : un coefficient en anglo-saxon au milieu d'un écran français.
                      defaultValue={nombreFr(Number(c.coef), 2)}
                      onBlur={(e) => sauver(supabase.from("grille_coefs").update({ coef: champVersNombre(e.target.value) }).eq("id", c.id))}
                    />
                  </div>
                ))}
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-1">
            <Input label="Forfait minimum de facturation (€)" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={grille.forfait_minimum} onBlur={(e) => sauver(supabase.from("grilles_tarifaires").update({ forfait_minimum: Number(e.target.value) }).eq("id", grille.id))} />
            <p className="text-xs text-gray-500">
              Plancher appliqué au total HT du devis, <b>après remise</b> : une pièce de 0,3 m² ne
              se facture pas 13,50 € quand votre minimum est à {Number(grille.forfait_minimum).toLocaleString("fr-FR")} €.
              Le complément apparaît en ligne « Forfait minimum » sur le devis, pour que le client
              comprenne le prix. Un devis sans aucune ligne au m² n&apos;est jamais relevé.
              Mettez 0 pour ne pas l&apos;appliquer.
            </p>
          </Card>
        </div>
      )}

      {tab === "ml" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Vos clients menuisiers alu raisonnent en mètres de profilé, pas en m². Déclarez ici vos
            familles de profilés et leur prix au mètre : vous chiffrerez leurs barres directement au ml
            dans un devis. Les modifications s&apos;enregistrent quand vous quittez un champ.
          </p>
          {tarifsMl.map((t) => (
            <Card key={t.id} className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label="Famille de profilé" defaultValue={t.famille} placeholder="Ex : Profilé fenêtre 60 mm" onBlur={(e) => sauver(supabase.from("tarifs_ml").update({ famille: e.target.value }).eq("id", t.id))} />
                </div>
                <button type="button" aria-label="Supprimer" className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => sauverEtRecharger(supabase.from("tarifs_ml").update({ actif: false }).eq("id", t.id))}><X size={16} aria-hidden /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Prix HT / ml (€)" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={t.prix_ml} onBlur={(e) => sauver(supabase.from("tarifs_ml").update({ prix_ml: Number(e.target.value) }).eq("id", t.id))} />
                <Input label="Périmètre développé (m)" type="number" step="0.001" min="0" inputMode="decimal" defaultValue={t.perimetre_developpe_m ?? ""} placeholder="0,45" onBlur={(e) => sauver(supabase.from("tarifs_ml").update({ perimetre_developpe_m: e.target.value === "" ? null : Number(e.target.value) }).eq("id", t.id))} />
              </div>
              <Input label="Description (facultatif)" defaultValue={t.description ?? ""} placeholder="Dormant, ouvrant, capot…" onBlur={(e) => sauver(supabase.from("tarifs_ml").update({ description: e.target.value || null }).eq("id", t.id))} />
            </Card>
          ))}
          <p className="-mt-1 text-xs text-gray-500">
            Le périmètre développé, c&apos;est le tour complet de la section du profilé (déroulé au mètre).
            Renseigné, il permet au devis d&apos;afficher la surface équivalente en m² — ce qu&apos;il vous faut
            pour estimer votre consommation de poudre. Laissez vide si vous ne le connaissez pas.
          </p>
          <Button variant="secondary" onClick={async () => {
            await sauverEtRecharger(supabase.from("tarifs_ml").insert({ atelier_id: atelier.id, famille: "Nouvelle famille", prix_ml: 0, ordre: tarifsMl.length }));
          }}>+ Ajouter une famille de profilé</Button>
          {tarifsMl.length === 0 && (
            <Card className="flex flex-col gap-2 border-dashed">
              <div className="text-sm font-semibold">Vous laquez de la menuiserie alu ?</div>
              <p className="text-xs text-gray-500">On vous pose les familles les plus courantes avec des périmètres réalistes — vous ajustez vos prix ensuite.</p>
              <Button variant="secondary" onClick={async () => {
                await sauverEtRecharger(supabase.from("tarifs_ml").insert([
                  { atelier_id: atelier.id, famille: "Profilé fenêtre 60 mm", prix_ml: 6, perimetre_developpe_m: 0.35, ordre: 0 },
                  { atelier_id: atelier.id, famille: "Profilé porte / dormant 75 mm", prix_ml: 8, perimetre_developpe_m: 0.45, ordre: 1 },
                  { atelier_id: atelier.id, famille: "Tube / cornière", prix_ml: 4.5, perimetre_developpe_m: 0.2, ordre: 2 },
                  { atelier_id: atelier.id, famille: "Tôle pliée / habillage", prix_ml: 9, perimetre_developpe_m: 0.6, ordre: 3 },
                ]));
              }}>+ Ajouter les 4 familles courantes</Button>
            </Card>
          )}
        </div>
      )}

      {tab === "jantes" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Un garage annonce ses jantes en pouces, jamais en m². Réglez ici votre prix à la jante par
            tranche de diamètre, puis les deux majorations du métier : le <b>dessin</b> (une
            multibranches fine demande bien plus de préparation qu&apos;une 5 branches pleines) et la
            <b> finition</b> (vernis, bicolore, diamantage). Le prix d&apos;une jante vaut
            palier × dessin × finition.
          </p>

          {!grille ? (
            <Card className="text-center">
              <p className="mb-3 text-sm text-gray-600">Créez d&apos;abord votre grille tarifaire dans l&apos;onglet « Grille m² » : le barème jantes s&apos;y rattache, ce qui fait qu&apos;un client sous contrat hérite de son propre prix à la jante.</p>
              <Button onClick={() => createGrille({ parDefaut: true })}>Créer ma grille standard</Button>
            </Card>
          ) : (
            <>
              <Card>
                <div className="mb-1 text-sm font-semibold">Prix à la jante par diamètre</div>
                <p className="mb-2 text-xs text-gray-500">
                  Borne basse incluse, borne haute exclue : une jante de 19 pouces pile tombe dans la
                  tranche qui commence à 19. Laissez le « À » vide sur la dernière.
                </p>
                {janteP.map((p) => (
                  <div key={p.id} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                    <Input type="number" step="0.5" label="De (″)" defaultValue={p.diametre_min} onBlur={(e) => sauver(supabase.from("jante_paliers").update({ diametre_min: Number(e.target.value) }).eq("id", p.id))} />
                    <Input type="number" step="0.5" label="À (″)" placeholder="∞" defaultValue={p.diametre_max ?? ""} onBlur={(e) => sauver(supabase.from("jante_paliers").update({ diametre_max: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
                    <Input type="number" step="0.01" label="€ HT / jante" defaultValue={p.prix_jante_ht} onBlur={(e) => sauver(supabase.from("jante_paliers").update({ prix_jante_ht: Number(e.target.value) }).eq("id", p.id))} />
                    <button
                      aria-label={`Supprimer la tranche ${p.diametre_min}″${p.diametre_max ? ` à ${p.diametre_max}″` : " et plus"}`}
                      className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      onClick={() => setBaremeASupprimer({
                        table: "jante_paliers",
                        id: p.id,
                        quoi: "cette tranche de diamètre",
                        libelle: `${p.diametre_min}″${p.diametre_max ? ` à ${p.diametre_max}″` : " et plus"} — ${eur(Number(p.prix_jante_ht))} HT par jante`,
                      })}
                    ><X size={16} aria-hidden /></button>
                  </div>
                ))}
                <Button variant="secondary" onClick={async () => {
                  await sauverEtRecharger(supabase.from("jante_paliers").insert({ atelier_id: atelier.id, grille_id: grille.id, diametre_min: 0, diametre_max: null, prix_jante_ht: 0 }));
                }}>+ Ajouter une tranche</Button>
                {janteP.length === 0 && (
                  <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
                    <div className="text-sm font-semibold">Démarrer avec un barème réaliste</div>
                    <p className="mb-2 text-xs text-gray-500">Quatre tranches de 15 à 22 pouces, à ajuster à vos tarifs.</p>
                    <Button variant="secondary" onClick={async () => {
                      await sauverEtRecharger(supabase.from("jante_paliers").insert(PALIERS_JANTE_DEFAUT.map((p) => ({ ...p, atelier_id: atelier.id, grille_id: grille.id }))));
                    }}>+ Poser le barème par défaut</Button>
                  </div>
                )}
              </Card>

              {(["jante_dessin", "jante_finition"] as const).map((categorie) => {
                const liste = coefs.filter((c) => c.categorie === categorie);
                const defauts = categorie === "jante_dessin" ? DESSINS_JANTE_DEFAUT : FINITIONS_JANTE_DEFAUT;
                return (
                  <Card key={categorie}>
                    <div className="mb-1 text-sm font-semibold">
                      {categorie === "jante_dessin" ? "Majoration selon le dessin" : "Majoration selon la finition"}
                    </div>
                    <p className="mb-2 text-xs text-gray-500">1,00 = pas de majoration. Ces coefficients se multiplient avec le prix de la tranche.</p>
                    {liste.map((c) => (
                      <div key={c.id} className="mb-2 grid grid-cols-[1fr_100px_auto] items-end gap-2">
                        <Input defaultValue={c.libelle} onBlur={(e) => sauver(supabase.from("grille_coefs").update({ libelle: e.target.value }).eq("id", c.id))} />
                        <Input
                          type="number" step="0.01" label="Coef."
                          defaultValue={nombreFr(Number(c.coef), 2)}
                          onBlur={(e) => sauver(supabase.from("grille_coefs").update({ coef: champVersNombre(e.target.value) }).eq("id", c.id))}
                        />
                        <button
                          aria-label={`Supprimer la majoration ${c.libelle}`}
                          className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          onClick={() => setBaremeASupprimer({
                            table: "grille_coefs",
                            id: c.id,
                            quoi: "ce coefficient de majoration",
                            libelle: `${c.libelle} — coefficient ${nombreFr(Number(c.coef), 2)}`,
                          })}
                        ><X size={16} aria-hidden /></button>
                      </div>
                    ))}
                    {liste.length === 0 && (
                      <Button variant="secondary" onClick={async () => {
                        await sauverEtRecharger(supabase.from("grille_coefs").insert(defauts.map((d) => ({
                          atelier_id: atelier.id, grille_id: grille.id, categorie, code: d.code, libelle: d.libelle, coef: d.coef,
                        }))));
                      }}>+ Poser les valeurs par défaut</Button>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Opérations mécaniques facturables</div>
            <p className="-mt-1 text-xs text-gray-500">
              Elles ne sont pas comprises dans le prix à la jante : sur un jeu de quatre, une seule est
              souvent voilée, et le garage doit lire « Dévoilage × 1 ». Chacune est une prestation
              ordinaire, reconnue par son code — modifiez librement les prix dans l&apos;onglet Prestations.
            </p>
            <ul className="text-xs text-gray-600">
              {(Object.keys(OPERATIONS_JANTE) as (keyof typeof OPERATIONS_JANTE)[]).map((code) => {
                const p = prestations.find((x) => x.code === CODES_PRESTATION_JANTE[code] && x.actif);
                return (
                  <li key={code} className="flex justify-between py-0.5">
                    <span>{OPERATIONS_JANTE[code]}</span>
                    <span className={p ? "text-gray-500" : "text-amber-700"}>
                      {p ? `${Number(p.prix_unitaire_ht).toLocaleString("fr-FR")} € HT` : "non déclarée"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {(Object.keys(OPERATIONS_JANTE) as (keyof typeof OPERATIONS_JANTE)[]).some((c) => !prestations.some((p) => p.code === CODES_PRESTATION_JANTE[c] && p.actif)) && (
              <Button variant="secondary" onClick={async () => {
                const manquantes = (Object.keys(OPERATIONS_JANTE) as (keyof typeof OPERATIONS_JANTE)[])
                  .filter((c) => !prestations.some((p) => p.code === CODES_PRESTATION_JANTE[c] && p.actif));
                const prixIndicatif: Record<string, number> = {
                  devoilage: 25, redressage: 35, soudure: 45, depose_pneu: 8,
                  repose_pneu: 8, equilibrage: 10, valve_tpms: 45, diamantage: 60,
                };
                if (!(await ecrire(supabase.from("prestations").insert(manquantes.map((c, i) => ({
                  atelier_id: atelier.id, code: CODES_PRESTATION_JANTE[c], nom: OPERATIONS_JANTE[c],
                  unite: "piece", prix_unitaire_ht: prixIndicatif[c] ?? 0, categorie: "jantes", ordre: prestations.length + i,
                }))), toast))) return;
                await loadAll();
                toast("Prestations jantes créées — ajustez vos prix dans l'onglet Prestations");
              }}>+ Créer les prestations manquantes</Button>
            )}
          </Card>
        </div>
      )}

      {tab === "pieces" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Les pièces que vous traitez en boucle : enregistrez-les une fois avec leur surface, leur temps
            et leur prix. Un devis se fait ensuite en un bouton, sans ressortir le mètre.
          </p>
          {piecesTypes.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label="Nom de la pièce" defaultValue={p.nom} placeholder={"Ex : Portail 3 m, Jante 19\""} onBlur={(e) => sauver(supabase.from("pieces_types").update({ nom: e.target.value }).eq("id", p.id))} />
                </div>
                <button type="button" aria-label="Supprimer" className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => sauverEtRecharger(supabase.from("pieces_types").update({ actif: false }).eq("id", p.id))}><X size={16} aria-hidden /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Catégorie" defaultValue={p.categorie ?? ""} placeholder="Jantes, portails…" onBlur={(e) => sauver(supabase.from("pieces_types").update({ categorie: e.target.value || null }).eq("id", p.id))} />
                <Input label="Prix HT (€)" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.prix_ht ?? ""} placeholder="Vide = grille m²" onBlur={(e) => sauver(supabase.from("pieces_types").update({ prix_ht: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input label="Surface m²" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.surface_m2 ?? ""} onBlur={(e) => sauver(supabase.from("pieces_types").update({ surface_m2: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
                <Input label="Longueur ml" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.longueur_ml ?? ""} onBlur={(e) => sauver(supabase.from("pieces_types").update({ longueur_ml: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
                <Input label="Temps (min)" type="number" step="1" min="0" inputMode="numeric" defaultValue={p.temps_minutes ?? ""} onBlur={(e) => sauver(supabase.from("pieces_types").update({ temps_minutes: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Périmètre profilé (mm)" type="number" step="1" min="0" inputMode="numeric" defaultValue={p.perimetre_mm ?? ""} placeholder="Si pièce au ml" onBlur={(e) => sauver(supabase.from("pieces_types").update({ perimetre_mm: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
                <Input label="Coef. complexité" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.coef_complexite ?? ""} placeholder="1" onBlur={(e) => sauver(supabase.from("pieces_types").update({ coef_complexite: e.target.value === "" ? null : Number(e.target.value) }).eq("id", p.id))} />
              </div>
              <p className="-mt-1 text-xs text-gray-500">
                Périmètre développé du profilé (mm) : convertit la longueur ml en surface équivalente pour
                l&apos;assistant de calcul au mètre linéaire du devis. Coefficient de complexité : multiplie
                le prix de cette pièce sur le devis, qu&apos;il vienne du prix ci-dessus ou de votre grille
                au m² — une jante à voile creux se laque plus lentement qu&apos;une jante plate de même
                surface. Laissez vide ou à 1 pour ne rien majorer.
              </p>
              <Input label="Note (facultatif)" defaultValue={p.note ?? ""} placeholder="Démontage pneu non compris…" onBlur={(e) => sauver(supabase.from("pieces_types").update({ note: e.target.value || null }).eq("id", p.id))} />
            </Card>
          ))}
          <p className="-mt-1 text-xs text-gray-500">
            Si vous laissez le prix vide, le devis reprendra la surface et la chiffrera avec votre grille
            au m². Le temps ne sort pas sur le devis client : il vous sert à mesurer votre rentabilité.
          </p>
          <Button variant="secondary" onClick={async () => {
            await sauverEtRecharger(supabase.from("pieces_types").insert({ atelier_id: atelier.id, nom: "Nouvelle pièce type", ordre: piecesTypes.length }));
          }}>+ Ajouter une pièce type</Button>
          {piecesTypes.length === 0 && (
            <Card className="flex flex-col gap-2 border-dashed">
              <div className="text-sm font-semibold">Démarrer avec les classiques</div>
              <p className="text-xs text-gray-500">Les pièces qui reviennent dans presque tous les ateliers — à ajuster à vos tarifs.</p>
              <Button variant="secondary" onClick={async () => {
                await sauverEtRecharger(supabase.from("pieces_types").insert([
                  { atelier_id: atelier.id, nom: "Jante 17\"", categorie: "jantes", surface_m2: 0.9, temps_minutes: 45, prix_ht: 80, ordre: 0 },
                  { atelier_id: atelier.id, nom: "Jante 19\"", categorie: "jantes", surface_m2: 1.1, temps_minutes: 50, prix_ht: 95, ordre: 1 },
                  { atelier_id: atelier.id, nom: "Portail 3 m", categorie: "portails", surface_m2: 9, longueur_ml: 3, temps_minutes: 180, prix_ht: 450, ordre: 2 },
                  { atelier_id: atelier.id, nom: "Garde-corps 1 m", categorie: "portails", surface_m2: 1.5, longueur_ml: 1, temps_minutes: 40, prix_ht: 90, ordre: 3 },
                  { atelier_id: atelier.id, nom: "Cadre de moto", categorie: "moto", surface_m2: 1.8, temps_minutes: 120, prix_ht: 220, ordre: 4 },
                ]));
              }}>+ Ajouter les 5 pièces courantes</Button>
            </Card>
          )}
        </div>
      )}

      {tab === "prestations" && (
        <div className="flex flex-col gap-3">
          {prestations.map((p) => (
            <Card key={p.id} className="grid grid-cols-[1fr_90px_90px_80px_120px_auto] items-end gap-2">
              <Input label="Nom" defaultValue={p.nom} onBlur={(e) => sauver(supabase.from("prestations").update({ nom: e.target.value }).eq("id", p.id))} />
              <Input label="Prix HT" type="number" step="0.01" defaultValue={p.prix_unitaire_ht} onBlur={(e) => sauver(supabase.from("prestations").update({ prix_unitaire_ht: Number(e.target.value) }).eq("id", p.id))} />
              <Select label="Unité" defaultValue={p.unite} onChange={(e) => sauver(supabase.from("prestations").update({ unite: e.target.value }).eq("id", p.id))}>
                {["piece", "m2", "ml", "kg", "heure", "forfait"].map((u) => <option key={u} value={u}>{uniteFr(u)}</option>)}
              </Select>
              {/* Le taux de TVA était lu partout (devis, BL, facture, Factur-X) mais ne pouvait
                  être renseigné que par un import CSV : toutes les prestations restaient bloquées
                  à 20 %, sans recours pour un atelier en 10 % ou en 0 %. */}
              <Select label="TVA" defaultValue={String(p.tva_rate)} onChange={(e) => sauver(supabase.from("prestations").update({ tva_rate: Number(e.target.value) }).eq("id", p.id))}>
                {["20", "10", "5.5", "0"].map((t) => <option key={t} value={t}>{t} %</option>)}
              </Select>
              {/* Depuis le 01/09/2026, chaque facture doit annoncer sa catégorie d'opération.
                  Elle n'est pas saisie sur la facture mais déduite de ses lignes : c'est donc ici,
                  une fois pour toutes, que se dit ce qui est un travail et ce qui est une pièce
                  revendue. Le laquage, le sablage, le dévoilage sont des services ; une valve, un
                  kilo de poudre, un accessoire sont des biens. */}
              <Select label="Nature" defaultValue={p.nature} onChange={(e) => sauver(supabase.from("prestations").update({ nature: e.target.value }).eq("id", p.id))}>
                <option value="services">Service</option>
                <option value="biens">Bien vendu</option>
              </Select>
              <button type="button" aria-label="Supprimer cette prestation" className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => sauverEtRecharger(supabase.from("prestations").update({ actif: false }).eq("id", p.id))}><X size={16} aria-hidden /></button>
              {p.categorie === "jantes" && <Badge tone="info" className="col-span-6 -mt-2 w-fit">Service jantes</Badge>}
              {/* C5 — prix dégressif par quantité : un devis qui atteint un palier reprend
                  automatiquement le prix indiqué, sans que le commercial ait à y penser. */}
              <div className="col-span-6">
                <PaliersQuantite
                  paliers={(p.paliers_quantite as PalierQuantite[]) ?? []}
                  onSave={(paliers) => sauver(supabase.from("prestations").update({ paliers_quantite: paliers }).eq("id", p.id))}
                />
              </div>
            </Card>
          ))}
          <Button variant="secondary" onClick={async () => {
            await sauverEtRecharger(supabase.from("prestations").insert({ atelier_id: atelier.id, nom: "Nouvelle prestation", unite: "piece", prix_unitaire_ht: 0, ordre: prestations.length }));
          }}>+ Ajouter une prestation</Button>
          {!prestations.some((p) => p.categorie === "jantes") && (
            <Card className="flex flex-col gap-2 border-dashed">
              <div className="text-sm font-semibold">Vous rénovez des jantes ?</div>
              <p className="text-xs text-gray-500">Ajoutez d&apos;un coup les 3 prestations les plus demandées — vous ajustez les prix ensuite.</p>
              <Button variant="secondary" onClick={async () => {
                await sauverEtRecharger(supabase.from("prestations").insert([
                  { atelier_id: atelier.id, nom: "Dévoilage", unite: "piece", prix_unitaire_ht: 25, categorie: "jantes", ordre: prestations.length },
                  { atelier_id: atelier.id, nom: "Redressage", unite: "piece", prix_unitaire_ht: 35, categorie: "jantes", ordre: prestations.length + 1 },
                  { atelier_id: atelier.id, nom: "CNC diamant", unite: "piece", prix_unitaire_ht: 60, categorie: "jantes", ordre: prestations.length + 2 },
                ]));
              }}>+ Ajouter dévoilage / redressage / CNC diamant</Button>
            </Card>
          )}
        </div>
      )}

      {tab === "equipe" && (
        <div className="flex flex-col gap-3">
          {/* Le mur des sièges. L'ancien message — « votre formule est complète, la formule Équipe
              ouvre les utilisateurs sans limite » — était devenu faux, et surtout c'était une
              impasse : on demandait 50 € de plus par mois pour un simple accès. Ici l'atelier lit
              son décompte exact, et la sortie coûte 5 €. */}
          {sieges && (
            <Card className={placesRestantes !== null && placesRestantes <= 0 ? "border-brand/30 bg-brand-light/30" : "bg-gray-50"}>
              <div className="text-sm font-semibold text-gray-900">
                Formule {nomPlan(plan)} — {sieges.occupes} siège{sieges.occupes > 1 ? "s" : ""} occupé
                {sieges.occupes > 1 ? "s" : ""} sur {sieges.autorises}
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-gray-700 sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-gray-500">Utilisateurs actifs</dt>
                  <dd className="font-medium">{membresActifs}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-gray-500">Invitations en attente</dt>
                  <dd className="font-medium">{invitationsVives.length}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-gray-500">Sièges compris dans la formule</dt>
                  <dd className="font-medium">{sieges.inclus}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-gray-500">Sièges supplémentaires payés</dt>
                  <dd className="font-medium">
                    {sieges.supp}
                    {sieges.supp > 0 && ` — ${eur(coutSiegesMois)} HT / mois`}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-gray-600">
                Une invitation en attente occupe un siège tant qu&apos;elle n&apos;a pas expiré : c&apos;est la
                base qui compte ainsi, et c&apos;est elle qui refuse l&apos;invitation de trop.
              </p>

              {/* Pendant l'essai, le plan effectif est « Certifié » : il n'y a rien à acheter, et
                  proposer un siège payant reviendrait à facturer une place déjà ouverte. */}
              {essai ? (
                <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-gray-700">
                  Pendant votre essai, {sieges.inclus} sièges sont ouverts — de quoi faire entrer toute
                  votre équipe pour de vrai. Les sièges supplémentaires ne s&apos;achètent qu&apos;une fois
                  votre formule souscrite, à {PRIX_SIEGE_MENSUEL} € HT par mois et par personne.
                </p>
              ) : !estProprietaire ? (
                <p className="mt-2 text-xs text-gray-500">
                  Seul le responsable de l&apos;atelier peut ajouter ou retirer un siège.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {/* Le prix est annoncé AVANT le clic : le bouton dit ce qu'il coûte, la
                      confirmation dit ce que devient la facture. */}
                  <Button
                    variant={placesRestantes !== null && placesRestantes <= 0 ? "primary" : "secondary"}
                    disabled={siegeBusy}
                    onClick={() => setSiegeDemande({ cible: sieges.supp + 1, sens: "ajout" })}
                  >
                    + Ajouter un siège — {PRIX_SIEGE_MENSUEL} € HT / mois
                  </Button>
                  {sieges.supp > 0 && (
                    <>
                      <Button
                        variant="secondary"
                        disabled={siegeBusy || aLiberer > 0}
                        onClick={() => setSiegeDemande({ cible: sieges.supp - 1, sens: "retrait" })}
                      >
                        − Retirer un siège — {PRIX_SIEGE_MENSUEL} € HT / mois en moins
                      </Button>
                      {aLiberer > 0 && (
                        <p className="text-xs text-amber-800">
                          Ce siège est occupé. Désactivez d&apos;abord {aLiberer} membre
                          {aLiberer > 1 ? "s" : ""} ou annulez {aLiberer > 1 ? "leurs" : "son"} invitation
                          {aLiberer > 1 ? "s" : ""} : la base refuse de rendre un siège sur lequel
                          quelqu&apos;un travaille encore.
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-xs text-gray-500">
                    {PRIX_SIEGE_MENSUEL} € HT par mois et par siège ({PRIX_SIEGE_ANNUEL} € HT par an si
                    votre abonnement est annuel). Le total de votre abonnement se lit sur{" "}
                    <Link href="/abonnement" className="font-medium text-brand underline">
                      la page Abonnement
                    </Link>
                    .
                  </p>
                </div>
              )}
            </Card>
          )}
          {/* `coutsEquipe` reste un objet même pour un rôle atelier (la RLS rend zéro ligne sans
              erreur) : on ne peut pas s'y fier pour savoir QUI peut voir le bloc. `monRole` le dit
              de façon fiable — et de toute façon la RLS, elle, protège réellement la donnée. */}
          {equipe.map((m) => {
            const role = estRole(m.role) ? m.role : "atelier";
            const monRole = equipe.find((x) => x.id === monId)?.role;
            const accesCommercialEquipe = monRole === "owner" || monRole === "bureau";
            return (
              <Card key={m.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.nom || m.email || "Membre"} {m.id === monId && <span className="text-xs text-gray-400">(moi)</span>}</div>
                    <div className="text-xs text-gray-500">{LIBELLE_ROLE[role].titre}{!m.actif && " · désactivé"}</div>
                  </div>
                  {m.id !== monId && (
                    <Button variant="secondary" onClick={() => sauverEtRecharger(supabase.from("users").update({ actif: !m.actif }).eq("id", m.id))}>
                      {m.actif ? "Désactiver" : "Réactiver"}
                    </Button>
                  )}
                </div>
                {/* C2 — taux horaire propre à cette personne, utilisé par le prix de revient
                    (`projet_temps_cout`). `coutsEquipe` vient d'une table dont la RLS n'ouvre la
                    lecture qu'au responsable et au bureau (comme `ateliers_couts`) : `null` veut
                    dire que ce compte n'y a pas accès, le bloc ne s'affiche alors pas du tout.
                    L'écriture, elle, est réservée au responsable seul — un membre ne fixe jamais
                    son propre taux ni celui d'un collègue. */}
                {accesCommercialEquipe && coutsEquipe && (
                  estProprietaire ? (
                    <Input
                      label="Taux horaire (€/h)"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      defaultValue={coutsEquipe[m.id] ?? ""}
                      placeholder="Réglage de l'atelier par défaut"
                      onBlur={(e) => {
                        const taux_horaire = e.target.value === "" ? null : Number(e.target.value);
                        sauver(supabase.from("users_couts").upsert({ user_id: m.id, atelier_id: atelier.id, taux_horaire }));
                        setCoutsEquipe((c) => ({ ...c, [m.id]: taux_horaire }));
                      }}
                    />
                  ) : (
                    <p className="text-xs text-gray-500">
                      Taux horaire : {coutsEquipe[m.id] != null ? `${coutsEquipe[m.id]} €/h` : "réglage de l'atelier par défaut"}
                    </p>
                  )
                )}
                {/* Le rôle se change après coup : une personne embauchée à l'atelier passe au
                    bureau, un responsable part. La base refuse la dernière rétrogradation
                    (`DERNIER_PROPRIETAIRE`) — l'atelier ne peut jamais se retrouver sans patron. */}
                {/* Le cabinet n'a pas de rôle à choisir : le sélecteur ne porte que les trois
                    rôles internes, et un comptable qu'on y ferait passer perdrait son accès sans
                    qu'on l'ait voulu. Pour changer, on retire et on réinvite. */}
                {estProprietaire && m.id !== monId && role !== "comptable" && (
                  <>
                    <Select
                      label="Rôle"
                      value={role}
                      onChange={(e) => sauverEtRecharger(supabase.from("users").update({ role: e.target.value }).eq("id", m.id))}
                    >
                      {ROLES_INTERNES.map((r) => (
                        <option key={r} value={r}>{LIBELLE_ROLE[r].titre}</option>
                      ))}
                    </Select>
                    <p className="text-xs text-gray-500">{LIBELLE_ROLE[role].phrase}</p>
                  </>
                )}
                {role === "comptable" && (
                  <p className="text-xs text-gray-500">{LIBELLE_ROLE.comptable.phrase}</p>
                )}
              </Card>
            );
          })}
          {/* UNE seule carte pour les quatre rôles, et le cabinet est dedans.
              Il y avait auparavant deux cartes : « Inviter un membre » avec trois rôles, puis une
              carte séparée « Inviter mon expert-comptable », placée après la liste des invitations
              en attente. L'argument était bon sur le papier — un cabinet extérieur n'est pas un
              salarié — mais le résultat à l'écran ne l'était pas : qui cherche à donner un accès
              au comptable ouvre le sélecteur de rôles, n'y trouve que trois lignes, et conclut
              que le produit ne sait pas le faire. C'est ce qui s'est produit en recette.
              Le cabinet reste hors barème (voir la branche `comptable` ci-dessous) ; il est
              simplement visible là où on le cherche. */}
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Inviter quelqu&apos;un</div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={inviteComptable ? "cabinet@exemple.fr" : "email@exemple.fr"}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              {/* Le bouton grisé n'est pas le verrou : le trigger `trg_limite_utilisateurs` refuse
                  l'insertion de toute façon — et il compte le comptable à part, sur
                  `plafond_comptables()`, jamais sur les sièges. On évite seulement de faire buter
                  l'atelier sur un refus sans explication. */}
              <Button
                disabled={
                  !inviteEmail ||
                  (inviteComptable ? comptablesOccupes >= ACCES_COMPTABLES_INCLUS : placesRestantes === 0)
                }
                onClick={async () => {
                  if (!(await ecrire(supabase.from("invitations").insert({ atelier_id: atelier.id, email: inviteEmail, role: inviteRole }), toast))) return;
                  setInviteEmail("");
                  await loadAll();
                  toast("Invitation créée — copiez le lien ci-dessous");
                }}
              >
                Inviter
              </Button>
            </div>
            {/* Le rôle se choisit AVANT d'envoyer le lien, et l'écran dit en une phrase ce que la
                personne verra. Sans cette phrase, « bureau » et « atelier » ne veulent rien dire :
                on invite au hasard, et on découvre le périmètre le jour d'un litige. */}
            <Select label="Rôle de la personne invitée" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
              {ROLES_INVITABLES.map((r) => (
                <option key={r} value={r}>{LIBELLE_ROLE[r].titre}</option>
              ))}
            </Select>
            <p className="-mt-1 text-xs text-gray-600">{LIBELLE_ROLE[inviteRole].phrase}</p>
            {inviteComptable ? (
              <>
                <p className="text-xs text-gray-600">
                  Votre cabinet récupère lui-même ses pièces au lieu de vous les réclamer.{" "}
                  <b>
                    Cet accès est gratuit et ne consomme aucun siège : il est plafonné à{" "}
                    {ACCES_COMPTABLES_INCLUS}
                  </b>{" "}
                  — de quoi couvrir l&apos;expert et son collaborateur de saisie.{" "}
                  {comptables.length > 0 &&
                    `${comptables.length} accès ouvert${comptables.length > 1 ? "s" : ""} sur ${ACCES_COMPTABLES_INCLUS}. `}
                  La cadence de remise — chaque mois ou chaque trimestre — se règle depuis{" "}
                  <Link href="/comptable" className="font-medium text-brand underline">
                    l&apos;espace comptable
                  </Link>
                  .
                </p>
                {comptablesOccupes >= ACCES_COMPTABLES_INCLUS && (
                  <p className="text-xs text-amber-800">
                    Vos {ACCES_COMPTABLES_INCLUS} accès comptables gratuits sont utilisés.
                    Retirez-en un pour en inviter un autre.
                  </p>
                )}
              </>
            ) : (
              placesRestantes === 0 && (
                <p className="text-xs text-amber-800">
                  Tous vos sièges sont occupés. Ajoutez un siège ci-dessus pour {PRIX_SIEGE_MENSUEL} € HT
                  par mois, ou désactivez un membre qui ne travaille plus chez vous.
                </p>
              )
            )}
            {invitations.map((inv) => (
              <div key={inv.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                <div className="font-medium">
                  {inv.email}
                  <span className="ml-2 font-normal text-gray-500">
                    · {LIBELLE_ROLE[estRole(inv.role) ? inv.role : "atelier"].titre}
                    {inv.role === "comptable" && " · gratuit, hors siège"}
                  </span>
                </div>
                <div className="break-all text-gray-500">{typeof window !== "undefined" ? `${window.location.origin}/signup?invite=${inv.token}` : ""}</div>
                <div className="mt-1 flex gap-3">
                  <button type="button" className="min-h-[44px] rounded px-1 font-medium text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${inv.token}`); toast("Lien copié"); }}>Copier le lien</button>
                  <button type="button" className="min-h-[44px] rounded px-1 text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => sauverEtRecharger(supabase.from("invitations").delete().eq("id", inv.id))}>Annuler</button>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500">Envoyez ce lien à la personne invitée : elle crée son compte et rejoint automatiquement votre atelier.</p>
          </Card>

          {/* Aucune facturation sur un clic non prévenu : l'écran annonce l'ancien montant, le
              nouveau, et le fait que le prorata part immédiatement. */}
          <ConfirmModal
            open={!!siegeDemande}
            busy={siegeBusy}
            title={siegeDemande?.sens === "retrait" ? "Retirer un siège ?" : "Ajouter un siège ?"}
            message={
              siegeDemande
                ? `Votre abonnement passera de ${eur(prixFormuleMois + coutSiegesMois)} à ${eur(prixFormuleMois + siegeDemande.cible * PRIX_SIEGE_MENSUEL)} HT par mois, facturé au prorata immédiatement. Vous passerez de ${sieges?.autorises ?? 0} à ${(sieges?.inclus ?? 0) + siegeDemande.cible} sièges (${sieges?.inclus ?? 0} compris dans la formule ${nomPlan(sub?.plan)} + ${siegeDemande.cible} payé${siegeDemande.cible > 1 ? "s" : ""}).`
                : undefined
            }
            confirmLabel={siegeDemande?.sens === "retrait" ? "Retirer le siège" : "Ajouter le siège"}
            onConfirm={() => siegeDemande && changerSieges(siegeDemande.cible)}
            onCancel={() => setSiegeDemande(null)}
          />
        </div>
      )}

      {tab === "workflow" && (() => {
        // Deux parcours, parce que les étapes d'une jante ne sont pas celles d'un portail : un
        // dossier de jantes n'a nulle part où pointer la dépose des pneus dans le parcours général.
        // Le devis choisit tout seul — dès qu'il porte une ligne de jantes, le projet ouvre le
        // parcours jantes.
        const jantes = sousOngletWorkflow === "jantes";
        const liste = jantes ? workflowJantes : workflow;
        const poser = jantes ? setWorkflowJantes : setWorkflow;
        return (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(["general", "jantes"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={sousOngletWorkflow === s} onClick={() => setSousOngletWorkflow(s)} className={`min-h-[44px] rounded-full px-3.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${sousOngletWorkflow === s ? "bg-brand text-white" : "bg-gray-100 text-gray-600"}`}>
                  {s === "general" ? "Parcours général" : "Parcours jantes"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {jantes
                ? "Appliqué automatiquement à tout devis qui contient un jeu de jantes. Les étapes Cuisson, Contrôle, Prêt et Livré pilotent le décompte de poudre et la notification au client : leur nom est libre, leur place dans l'ordre compte."
                : "Les étapes de production de vos futurs projets. Les modifications s'appliquent aux nouveaux projets uniquement."}
            </p>
            {liste.map((e, i) => (
              <Card key={i} className="flex items-center gap-2">
                <span className="w-6 text-center font-display text-sm font-bold text-gray-300">{i + 1}</span>
                <Input value={e.libelle} onChange={(ev) => { const w = [...liste]; w[i] = { ...w[i], libelle: ev.target.value }; poser(w); }} />
                <button type="button" aria-label="Monter" disabled={i === 0} className="flex h-11 w-11 flex-none items-center justify-center rounded text-gray-400 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => { const w = [...liste]; [w[i-1], w[i]] = [w[i], w[i-1]]; poser(w); }}><ArrowUp size={16} aria-hidden /></button>
                <button type="button" aria-label="Supprimer" disabled={liste.length <= 2} className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => poser(liste.filter((_, j) => j !== i))}><X size={16} aria-hidden /></button>
              </Card>
            ))}
            <Button variant="secondary" onClick={() => poser([...liste, { code: `etape_${Date.now()}`, libelle: "Nouvelle étape" }])}>+ Ajouter une étape</Button>
            {jantes && (
              <Button variant="secondary" onClick={() => setWorkflowJantes(WORKFLOW_JANTES_DEFAUT)}>Revenir au parcours jantes standard</Button>
            )}
            <Button onClick={async () => {
              const settings = { ...(atelier.settings as Record<string, unknown>), [jantes ? "workflow_jantes" : "workflow_defaut"]: liste };
              // Uniformisé sur `ecrire()` (audit vague 3) : l'écriture était déjà relue et
              // toastée à la main, mais un `update(` hors `ecrire()` est exactement le motif que
              // le défaut n°1 demandait de traquer dans tout cet écran.
              if (await ecrire(supabase.from("ateliers").update({ settings }).eq("id", atelier.id), toast)) flash();
            }}>Enregistrer les étapes</Button>
          </div>
        );
      })()}

      {tab === "compte" && (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-1">
            <div className="text-sm font-semibold">Abonnement</div>
            {/* Le libellé était figé sur deux formules disparues (« Solo 59 € », « Atelier 89 € ») :
                un atelier en formule Certifié lisait le prix d'une offre qui n'existe plus. Il est
                désormais lu dans `OFFRES`, la seule source de vérité des tarifs. */}
            <div className="text-sm">
              Formule <b>{nomPlan(sub?.plan)}{offre(sub?.plan) && ` (${offre(sub?.plan)!.prixMensuel} € HT/mois)`}</b>
              {(sieges?.supp ?? 0) > 0 && (
                <> + {sieges!.supp} siège{sieges!.supp > 1 ? "s" : ""} à {eur(coutSiegesMois)} HT/mois</>
              )}
              {sub?.status === "trialing" && sub.trial_end && (
                <> · essai gratuit jusqu&apos;au <b>{new Date(sub.trial_end).toLocaleDateString("fr-FR")}</b></>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Vous serez prévenu par email avant la fin de votre essai — rien ne sera facturé sans votre accord.
              Une question ? <a className="text-brand underline" href="mailto:contact@thermopoudre.fr">contact@thermopoudre.fr</a>
            </p>
            {/* Sans ce lien, un atelier dont l'abonnement est actif n'a plus aucun accès à la page
                d'abonnement ni au portail Stripe : il ne peut ni changer de carte, ni récupérer ses
                factures, ni résilier. Le bandeau d'essai, lui, disparaît dès le premier paiement. */}
            <Link href="/abonnement" className="mt-1 w-fit rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium">
              Gérer mon abonnement
            </Link>
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Paiement en ligne des factures (Stripe)</div>
            {atelier.stripe_account_id ? (
              <p className="flex items-center gap-1.5 text-sm text-success-dark"><Check size={16} aria-hidden className="flex-none" /> Stripe connecté — vos clients peuvent payer vos factures en ligne par carte.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">Connectez votre compte Stripe (2 minutes) pour proposer le paiement en ligne sur vos factures. L&apos;argent va directement sur votre compte, sans passer par Thermogestion.</p>
                <a href="/api/stripe/connect-start" className="rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-medium text-white">Connecter Stripe</a>
              </>
            )}
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Reprise de vos données</div>
            <p className="text-xs text-gray-500">
              Vous arrivez d&apos;un tableur ? Importez vos clients, vos poudres et vos prestations depuis
              un fichier CSV ou Excel. Vous voyez ce qui passera avant que quoi que ce soit ne soit enregistré.
            </p>
            <Link href="/import" className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium">
              Importer un fichier
            </Link>
          </Card>
          {/* Engagement des CGU : l'atelier récupère tout, quand il veut, sans nous le demander. */}
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Sauvegarde et export de vos données</div>
            <p className="text-xs text-gray-500">
              Téléchargez l&apos;intégralité de vos données — clients, devis, factures, projets, stock,
              registre qualité — dans une archive ZIP : un fichier CSV par table, ouvrable dans Excel,
              plus un fichier JSON complet sans perte. Vos données vous appartiennent et vous n&apos;avez
              rien à nous demander pour les reprendre.
            </p>
            <a
              href="/api/export/donnees"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium"
            >
              Télécharger toutes mes données (.zip)
            </a>
            <p className="text-[11px] text-gray-400">
              Les photos et le logo ne sont pas dans l&apos;archive : leurs chemins de stockage y figurent,
              les fichiers eux-mêmes se récupèrent sur simple demande.
            </p>
          </Card>
          {/* La corbeille vit ici plutôt que dans la barre de navigation : on ne la cherche qu'un
              jour sur cent, et ce jour-là on la cherche dans les réglages. */}
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Corbeille</div>
            <p className="text-xs text-gray-500">
              Clients, devis, factures, projets, bons de livraison et réceptions retirés des listes
              y restent <b>30 jours</b> avant d&apos;être effacés définitivement. Une facture émise ne
              s&apos;y trouvera jamais : c&apos;est une pièce comptable, elle s&apos;annule ou se corrige par un
              avoir.
            </p>
            <Link
              href="/corbeille"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium"
            >
              Ouvrir la corbeille
            </Link>
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Changer mon mot de passe</div>
            <div className="flex gap-2">
              <Input type="password" placeholder="Nouveau mot de passe (8 min.)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              <Button disabled={newPassword.length < 8} onClick={async () => {
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) { toast(errorFr(error), "error"); return; }
                setNewPassword("");
                toast("Mot de passe modifié");
              }}>OK</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Hors des onglets : la confirmation doit rester montée quel que soit l'onglet ouvert, et
          elle sert les deux barèmes — tranches de diamètre et coefficients de majoration. */}
      <ConfirmModal
        open={!!baremeASupprimer}
        title={`Supprimer ${baremeASupprimer?.quoi ?? "cette ligne"} ?`}
        message={
          baremeASupprimer
            ? `${baremeASupprimer.libelle}. Cette ligne de barème chiffre tous vos prochains devis : une fois supprimée, elle est à ressaisir de zéro. Les devis déjà établis, eux, gardent leurs montants.`
            : undefined
        }
        confirmLabel="Supprimer"
        danger
        onCancel={() => setBaremeASupprimer(null)}
        onConfirm={async () => {
          if (!baremeASupprimer) return;
          await sauverEtRecharger(supabase.from(baremeASupprimer.table).delete().eq("id", baremeASupprimer.id));
          setBaremeASupprimer(null);
        }}
      />
    </div>
  );
}

/**
 * Une ligne de numérotation : préfixe, prochain numéro, et l'aperçu de ce que ça donnera.
 *
 * L'aperçu n'est pas décoratif. « Prochain numéro 348 » ne dit rien à un exploitant ; « votre
 * prochaine facture sera FA-2026-0348 » se compare d'un coup d'œil au dernier carnet, et c'est ce
 * qu'on lui demande de vérifier. Le composant est remonté à chaque relecture de la base (`key` sur
 * les valeurs) : ce que l'on voit vient toujours du serveur, jamais d'un état local qui aurait
 * survécu à un refus.
 */
function CarteNumerotation({
  ligne, modifiable, onPoser,
}: {
  ligne: LigneNumerotation;
  modifiable: boolean;
  onPoser: (type: string, prefixe: string, prochain: number) => Promise<boolean>;
}) {
  const [prefixe, setPrefixe] = useState(ligne.prefixe);
  const [prochain, setProchain] = useState(String(ligne.prochain));
  const [busy, setBusy] = useState(false);

  const rang = Number(String(prochain).replace(",", "."));
  const motif = motifRefusNumerotation(prefixe, rang);
  const modifie = prefixe !== ligne.prefixe || rang !== ligne.prochain;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{ligne.libelle}</div>
        {ligne.verrouille && <Badge tone="neutral">Série ouverte</Badge>}
      </div>

      {ligne.verrouille ? (
        <p className="mt-1 text-xs text-gray-600">
          Un document de ce type est déjà parti en {ligne.annee}. Le compteur ne se déplace plus :
          le déplacer créerait un trou ou un doublon dans votre série. Le prochain sera{" "}
          <b>{ligne.apercu}</b>.
        </p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              label="Préfixe"
              value={prefixe}
              maxLength={6}
              onChange={(e) => setPrefixe(normaliserPrefixe(e.target.value))}
              disabled={!modifiable}
            />
            <Input
              label="Prochain numéro"
              type="number"
              value={prochain}
              onChange={(e) => setProchain(e.target.value)}
              disabled={!modifiable}
            />
          </div>
          <p className="mt-2 text-xs text-gray-600">
            {motif ? (
              <span className="text-danger">{motif}</span>
            ) : (
              <>
                Votre prochain document sera <b>{apercuNumero(prefixe, ligne.annee, rang)}</b>.
                {" "}Le compteur repart à 1 au 1<sup>er</sup> janvier, en gardant ce préfixe.
              </>
            )}
          </p>
          <Button
            className="mt-3"
            loading={busy}
            disabled={!modifiable || !!motif || !modifie}
            onClick={async () => {
              setBusy(true);
              await onPoser(ligne.type, prefixe, Math.trunc(rang));
              setBusy(false);
            }}
          >
            Enregistrer
          </Button>
        </>
      )}
    </Card>
  );
}

/**
 * Éditeur de paliers de quantité d'une prestation (C5) : un tableau court, modifiable en local,
 * et un bouton d'enregistrement explicite plutôt qu'un `onBlur` par champ — un palier n'a de sens
 * que complet (seuil ET prix), l'enregistrer ligne à ligne écrirait des états intermédiaires
 * incohérents (un seuil à 10 sans prix, par exemple).
 */
function PaliersQuantite({ paliers, onSave }: { paliers: PalierQuantite[]; onSave: (paliers: PalierQuantite[]) => Promise<void> | void }) {
  const [lignes, setLignes] = useState<PalierQuantite[]>(paliers);
  const [ouvert, setOuvert] = useState(paliers.length > 0);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-2">
      <button
        type="button"
        className="text-xs font-medium text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onClick={() => setOuvert((o) => !o)}
      >
        {ouvert ? "Masquer" : "Paliers de quantité"} {paliers.length > 0 && !ouvert ? `(${paliers.length})` : ""}
      </button>
      {ouvert && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-gray-500">
            À partir de la quantité indiquée, le prix unitaire de la ligne passe automatiquement à
            celui du palier. Laissez vide pour un prix catalogue fixe, quelle que soit la quantité.
          </p>
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Input
                label="À partir de"
                type="number"
                step="1"
                min="0"
                value={l.a_partir_de}
                onChange={(e) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, a_partir_de: Number(e.target.value) || 0 } : x)))}
              />
              <Input
                label="Prix HT"
                type="number"
                step="0.01"
                min="0"
                value={l.prix}
                onChange={(e) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, prix: Number(e.target.value) || 0 } : x)))}
              />
              <button
                type="button"
                aria-label="Supprimer ce palier"
                className="flex h-11 w-11 flex-none items-center justify-center rounded text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setLignes((ls) => [...ls, { a_partir_de: 0, prix: 0 }])}>
              + Ajouter un palier
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await onSave(lignes.filter((l) => l.a_partir_de > 0 && l.prix > 0));
                setBusy(false);
              }}
            >
              Enregistrer les paliers
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
