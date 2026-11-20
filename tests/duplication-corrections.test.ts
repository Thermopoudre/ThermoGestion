import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { creerDevis, creerFactureDepuisDevis, finaliserDevis, ligneLibre, lignePrestation } from "./helpers/devis";
import { calcTotaux } from "@/lib/utils";
import type { DevisItem } from "@/lib/types";

/**
 * Chantier C3 — dupliquer, corriger, annuler, faire un avoir.
 *
 * Ce fichier ne regarde aucun écran : il tape sur PostgREST, avec les mêmes jetons que le
 * navigateur. C'est le seul niveau où la réponse a une valeur. Cacher un bouton ne cache rien —
 * ce projet s'est fait prendre huit fois à ce jeu-là, et la moitié des règles testées ici
 * (facture payée, cumul des avoirs, facture annulée définitive) n'auraient tenu qu'à un `if` dans
 * du React sans ces vingt-cinq assertions.
 *
 * Deux règles de méthode, reprises de `roles-rls.test.ts` :
 *
 *  1. **On vérifie l'état après coup, jamais le code de retour.** Sans policy, PostgREST répond
 *     204 en n'ayant modifié aucune ligne : un test qui se contente de `expect(error).toBeNull()`
 *     valide un verrou inexistant.
 *  2. **Chaque refus est rejoué depuis un client anonyme *et* depuis un compte connecté sans
 *     droits commerciaux.** Un refus qui ne tient que pour le visiteur non connecté ne tient pas.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const ctx = () => contexte();
const patron = () => clientConnecte();

type Doc = { id: string; [k: string]: unknown };

/** Compte les lignes d'une table, avec le compte du responsable : c'est le seul qui voit tout. */
async function compter(table: string): Promise<number> {
  const { count } = await patron().from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

async function lireDevis(id: string) {
  const { data } = await patron().from("devis").select("*").eq("id", id).single();
  return data as Doc & { status: string; numero: string | null; version: number; parent_id: string | null };
}

async function lireFacture(id: string) {
  const { data } = await patron().from("factures").select("*").eq("id", id).single();
  return data as Doc & { status: string; numero: string | null; type: string; total_ttc: number | string };
}

/** Fabrique un devis à deux lignes franches — assez cher pour ne pas déclencher le forfait minimum. */
async function devisDeuxLignes(clientId: string) {
  const { seed } = ctx();
  return creerDevis(patron(), {
    atelierId: seed.atelierId,
    clientId,
    items: [
      lignePrestation({ prestationId: seed.prestationSablageId, nom: "Sablage", unite: "piece", qte: 4, pu: 9, negocie: false }),
      ligneLibre({ libelle: "Thermolaquage châssis", qte: 1, pu: 480 }),
    ],
  });
}

/** Finalise puis marque le devis signé — c'est ce que fait « Marquer signé (accord verbal) ». */
async function signer(devisId: string) {
  await finaliserDevis(patron(), devisId);
  const { error } = await patron()
    .from("devis")
    .update({ status: "signe", signed_at: new Date().toISOString(), signed_by: "Recette C3" })
    .eq("id", devisId);
  if (error) throw new Error(`signature devis : ${error.message}`);
}

/** Émet une facture : numéro de série puis passage en « émise », comme la fiche facture. */
async function emettre(factureId: string) {
  const { data: numero, error: errNum } = await patron().rpc("next_numero", { p_type: "facture" });
  if (errNum) throw new Error(`next_numero : ${errNum.message}`);
  const { error } = await patron()
    .from("factures")
    .update({ status: "emise", numero, emise_at: new Date().toISOString() })
    .eq("id", factureId);
  if (error) throw new Error(`émission facture : ${error.message}`);
  return numero as string;
}

// ── Un compte d'atelier, pour rejouer chaque refus depuis un vrai jeton ───────

type Compagnon = { sb: SupabaseClient; id: string };

function adresseAtelier(): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  // Même adresse que `roles-rls.test.ts` : on ne crée pas un compte d'authentification de plus,
  // et les deux fichiers retirent la ligne `users` en fin de course.
  return `${locale}+role-atelier@${domaine}`;
}

async function rejoindreAtelier(): Promise<Compagnon> {
  const { url, anonKey, seed } = ctx();
  const email = adresseAtelier();
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let session = (await auth.auth.signInWithPassword({ email, password })).data.session;
  if (!session) {
    const inscription = await auth.auth.signUp({ email, password });
    if (inscription.error) throw new Error(`inscription ${email} : ${inscription.error.message}`);
    session = inscription.data.session;
  }
  if (!session) throw new Error(`aucun jeton pour ${email} (confirmation d'e-mail activée ?)`);

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const { data: dejaMembre } = await sb.from("users").select("atelier_id").eq("id", session.user.id).maybeSingle();
  if (dejaMembre) {
    if (dejaMembre.atelier_id !== seed.atelierId) {
      throw new Error(`${email} appartient déjà à un autre atelier — refus d'exécuter le fichier.`);
    }
  } else {
    const { data: inv, error: errInv } = await patron()
      .from("invitations")
      .insert({ atelier_id: seed.atelierId, email, role: "atelier" })
      .select("token")
      .single();
    if (errInv) throw new Error(`invitation atelier : ${errInv.message}`);
    const { error: errAccept } = await sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
    if (errAccept) throw new Error(`accept_invitation atelier : ${errAccept.message}`);
  }
  return { sb, id: session.user.id };
}

// ── Jeu de données ───────────────────────────────────────────────────────────

let operateur: Compagnon;
/** Devis signé, son projet et sa facture émise : la chaîne complète, pour les avoirs. */
let devisSigne: Doc & { items: DevisItem[]; remise: unknown; total_ttc: number | string };
let projetSigne = "";
let factureAvoir = "";
let factureAnnulation = "";
let facturePayee = "";
let facturePartielle = "";
let factureAcompte = "";
/** Devis « envoyé » et devis « refusé » : les deux entrées du retour en arrière. */
let devisEnvoye = "";
let devisRefuse = "";
let devisVersionne = "";
let devisFacture = "";

beforeAll(async () => {
  const { seed } = ctx();
  operateur = await rejoindreAtelier();

  // 1. La chaîne complète : devis signé → projet → facture émise.
  const d1 = await devisDeuxLignes(seed.clientRemiseId);
  await signer(d1.id);
  devisSigne = (await patron().from("devis").select("*").eq("id", d1.id).single()).data as never;
  const { data: proj } = await patron().from("projets").select("id").eq("devis_id", d1.id).maybeSingle();
  projetSigne = (proj as { id: string }).id;
  const f1 = await creerFactureDepuisDevis(patron(), devisSigne as never);
  factureAvoir = f1.id;
  await emettre(factureAvoir);

  // 2. Une facture libre émise, destinée à l'annulation.
  const { data: f2 } = await patron().from("factures").insert({
    atelier_id: seed.atelierId, client_id: seed.clientSimpleId, type: "libre",
    items: [ligneLibre({ libelle: "Laquage portail", qte: 1, pu: 300 })],
    ...calcTotaux([ligneLibre({ libelle: "Laquage portail", qte: 1, pu: 300 })], null),
  }).select("id").single();
  factureAnnulation = (f2 as { id: string }).id;
  await emettre(factureAnnulation);

  // 3. Une facture émise puis payée : elle ne s'annule plus, elle se crédite.
  const { data: f3 } = await patron().from("factures").insert({
    atelier_id: seed.atelierId, client_id: seed.clientSimpleId, type: "libre",
    items: [ligneLibre({ libelle: "Laquage garde-corps", qte: 1, pu: 250 })],
    ...calcTotaux([ligneLibre({ libelle: "Laquage garde-corps", qte: 1, pu: 250 })], null),
  }).select("id").single();
  facturePayee = (f3 as { id: string }).id;
  await emettre(facturePayee);
  await patron().from("factures").update({ status: "payee" }).eq("id", facturePayee);

  // 4. Une facture émise à deux lignes et remise : matière première de l'avoir partiel.
  const lignes = [
    ligneLibre({ libelle: "Cabine — poudrage", qte: 2, pu: 120 }),
    ligneLibre({ libelle: "Transport", qte: 1, pu: 60, tva: 20 }),
  ];
  const { data: f4 } = await patron().from("factures").insert({
    atelier_id: seed.atelierId, client_id: seed.clientSimpleId, type: "libre",
    items: lignes, remise: { type: "pct", valeur: 10 },
    ...calcTotaux(lignes, { type: "pct", valeur: 10 }),
  }).select("id").single();
  facturePartielle = (f4 as { id: string }).id;
  await emettre(facturePartielle);

  // 5. Un brouillon portant une ligne de déduction d'acompte : la duplication doit la retirer.
  const avecAcompte: DevisItem[] = [
    ligneLibre({ libelle: "Chantier complet", qte: 1, pu: 1000 }),
    {
      type: "libre", libelle: "Acompte FA-2026-0001 — déjà facturé", qte: 1, unite: "forfait",
      pu_ht: -300, tva: 20, total_ht: -300,
      meta: { deduction_acompte: true, facture_numero: "FA-2026-0001" },
    },
  ];
  const { data: f5 } = await patron().from("factures").insert({
    atelier_id: seed.atelierId, client_id: seed.clientRemiseId, type: "solde",
    items: avecAcompte, ...calcTotaux(avecAcompte, null),
  }).select("id").single();
  factureAcompte = (f5 as { id: string }).id;

  // 6. Trois devis pour les retours en arrière : envoyé, refusé, à versionner.
  devisEnvoye = (await devisDeuxLignes(seed.clientSimpleId)).id;
  await finaliserDevis(patron(), devisEnvoye);

  devisRefuse = (await devisDeuxLignes(seed.clientSimpleId)).id;
  await finaliserDevis(patron(), devisRefuse);
  await patron().from("devis").update({ status: "refuse" }).eq("id", devisRefuse);

  devisVersionne = (await devisDeuxLignes(seed.clientSimpleId)).id;
  await finaliserDevis(patron(), devisVersionne);

  // 7. Un devis signé et déjà facturé : il ne se versionne plus.
  devisFacture = (await devisDeuxLignes(seed.clientSimpleId)).id;
  await signer(devisFacture);
  const dF = (await patron().from("devis").select("*").eq("id", devisFacture).single()).data;
  const fF = await creerFactureDepuisDevis(patron(), dF as never);
  await emettre(fF.id);
});

afterAll(async () => {
  // Le siège doit repartir : `sieges.test.ts` et `droits-formules.test.ts` comptent les places
  // occupées, et un compte oublié ici les ferait échouer sans rapport avec eux.
  //
  // Les deux nettoyages sont nécessaires : `sieges_occupes()` additionne les membres actifs **et**
  // les invitations encore en attente. Supprimer le membre sans son invitation laisserait une
  // place prise par un e-mail que plus personne n'utilise.
  //
  // Les projets créés par l'opérateur doivent partir en premier : `projets_created_by_fkey`
  // référence `users(id)` sans `ON DELETE SET NULL`, et la suppression du membre échoue tant
  // qu'il reste un chantier à son nom. (C'est un vrai défaut du produit, hors de ce chantier :
  // huit tables portent la même contrainte, un employé qui a créé un devis ou pris une photo
  // n'est aujourd'hui pas supprimable depuis Réglages → Équipe. Signalé au rapport.)
  if (operateur?.id) {
    await patron().from("projets").delete().eq("created_by", operateur.id);
    await patron().from("users").delete().eq("id", operateur.id);
  }
  await patron().from("invitations").delete().eq("email", adresseAtelier()).is("accepted_at", null);
});

// ═════════════════════════════════════════════════════════════════════════════
describe("A — Dupliquer", () => {
  it("un devis dupliqué repart en brouillon, sans numéro, sans signature et sans le jeton du client", async () => {
    const { data: id, error } = await patron().rpc("dupliquer_devis", { p_id: devisSigne.id });
    expect(error, error?.message).toBeNull();
    const copie = await lireDevis(id as string);
    const source = await lireDevis(devisSigne.id);

    expect(copie.status).toBe("brouillon");
    expect(copie.numero).toBeNull();
    expect(copie.items).toEqual(source.items);
    expect(copie.remise).toEqual(source.remise);
    expect(nb(copie.total_ttc)).toBe(nb(source.total_ttc));
    // Ce qui ne se duplique jamais.
    expect(copie.signed_at).toBeNull();
    expect(copie.signed_by).toBeNull();
    expect(copie.signature_data).toBeNull();
    expect(copie.envoye_at).toBeNull();
    expect(copie.relance_count).toBe(0);
    expect(copie.public_token).not.toBe(source.public_token);
    // Une copie n'est pas une version : elle ne s'accroche à rien.
    expect(copie.parent_id).toBeNull();
    expect(copie.version).toBe(1);
    // La source n'a pas bougé.
    expect(source.status).toBe("signe");
  });

  it("une facture dupliquée ne vole ni le projet, ni le devis, ni les bons de livraison de sa jumelle", async () => {
    const { data: id, error } = await patron().rpc("dupliquer_facture", { p_id: factureAvoir });
    expect(error, error?.message).toBeNull();
    const copie = await lireFacture(id as string);
    const source = await lireFacture(factureAvoir);

    expect(copie.status).toBe("brouillon");
    expect(copie.numero).toBeNull();
    expect(copie.emise_at).toBeNull();
    // Le cœur de la règle : `trg_facture_consomme_bl` rattache les bons de livraison du projet à
    // toute facture qui porte un `projet_id`, brouillon compris. La copie n'en porte pas.
    expect(copie.projet_id).toBeNull();
    expect(copie.devis_id).toBeNull();
    expect(copie.facture_liee_id).toBeNull();
    expect(copie.stripe_payment_link).toBeNull();
    expect(source.projet_id).toBe(projetSigne);
  });

  it("l'échéance de la copie repart d'aujourd'hui, au délai négocié avec le client (45 jours)", async () => {
    const { data: id } = await patron().rpc("dupliquer_facture", { p_id: factureAvoir });
    const copie = await lireFacture(id as string);
    const jours = Math.round(
      (new Date(`${copie.due_date}T00:00:00Z`).getTime() - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()) / 86_400_000,
    );
    // 45 jours pour ce client, à un jour près pour absorber un passage de minuit pendant la suite.
    expect(Math.abs(jours - 45)).toBeLessThanOrEqual(1);
  });

  it("la copie d'une facture de solde perd la déduction d'acompte, et ses totaux sont refaits en base", async () => {
    const source = await lireFacture(factureAcompte);
    const { data: id, error } = await patron().rpc("dupliquer_facture", { p_id: factureAcompte });
    expect(error, error?.message).toBeNull();
    const copie = await lireFacture(id as string);

    const items = copie.items as DevisItem[];
    expect(items).toHaveLength(1);
    expect(items.some((i) => i.meta?.deduction_acompte === true)).toBe(false);
    // La source portait 1 000 − 300 = 700 € HT ; la copie porte le chantier seul.
    expect(nb(source.total_ht)).toBe(700);
    expect(nb(copie.total_ht)).toBe(1000);
    // Et le pied retombe exactement sur la somme des lignes — BR-CO-15.
    const attendu = calcTotaux(items, null);
    expect(nb(copie.total_ht)).toBe(attendu.total_ht);
    expect(nb(copie.total_tva)).toBe(attendu.total_tva);
    expect(nb(copie.total_ttc)).toBe(attendu.total_ttc);
  });

  it("un avoir ne se duplique pas : il n'existe que par rapport à une facture", async () => {
    const { data: avoirId } = await patron().rpc("avoir_depuis_facture", { p_id: facturePayee, p_lignes: null });
    const avant = await compter("factures");
    const { error } = await patron().rpc("dupliquer_facture", { p_id: avoirId as string });
    expect(error?.message ?? "").toContain("AVOIR_NON_DUPLICABLE");
    expect(await compter("factures")).toBe(avant);
  });

  it("un projet dupliqué repart à zéro : nouveau numéro, étapes vierges, aucun rattachement au devis", async () => {
    const { data: id, error } = await patron().rpc("dupliquer_projet", { p_id: projetSigne });
    expect(error, error?.message).toBeNull();
    const { data: copie } = await patron().from("projets").select("*").eq("id", id as string).single();
    const { data: source } = await patron().from("projets").select("*").eq("id", projetSigne).single();

    expect(copie!.numero).not.toBe(source!.numero);
    expect(copie!.numero).toMatch(/^PR-\d{4}-\d{4}$/);
    expect(copie!.status).toBe("en_attente");
    expect(copie!.nom).toBe(source!.nom);
    // L'avancement ne se duplique jamais : le chantier ne naît pas déjà cuit et contrôlé.
    expect((copie!.etapes as { code: string; done_at?: unknown }[]).every((e) => e.done_at === undefined)).toBe(true);
    expect(copie!.etape_courante).toBe((copie!.etapes as { code: string }[])[0].code);
    // Deux projets sur le même devis feraient tomber la fiche devis (`maybeSingle()`).
    expect(copie!.devis_id).toBeNull();
    expect(copie!.date_livraison).toBeNull();
    expect(copie!.stock_decremente_at).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("A bis — La duplication respecte les rôles et ferme la porte au visiteur", () => {
  it("un opérateur d'atelier ne duplique ni devis ni facture, et rien n'apparaît en base", async () => {
    const avantDevis = await compter("devis");
    const avantFactures = await compter("factures");

    const d = await operateur.sb.rpc("dupliquer_devis", { p_id: devisSigne.id });
    const f = await operateur.sb.rpc("dupliquer_facture", { p_id: factureAvoir });
    expect(d.error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");
    expect(f.error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");

    // C'est ici que le test a de la valeur : PostgREST peut répondre sans erreur en n'ayant rien
    // fait, et une erreur peut masquer une écriture déjà passée.
    expect(await compter("devis")).toBe(avantDevis);
    expect(await compter("factures")).toBe(avantFactures);
  });

  it("un opérateur d'atelier ne peut ni annuler une facture, ni en faire l'avoir", async () => {
    const avant = await compter("factures");
    const a = await operateur.sb.rpc("annuler_facture", { p_id: factureAnnulation, p_motif: "essai" });
    const v = await operateur.sb.rpc("avoir_depuis_facture", { p_id: factureAnnulation, p_lignes: null });
    expect(a.error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");
    expect(v.error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");
    expect((await lireFacture(factureAnnulation)).status).toBe("emise");
    expect(await compter("factures")).toBe(avant);
  });

  it("un opérateur d'atelier duplique en revanche un projet — la production lui appartient", async () => {
    const { data: id, error } = await operateur.sb.rpc("dupliquer_projet", { p_id: projetSigne });
    expect(error, error?.message).toBeNull();
    const { data } = await patron().from("projets").select("status").eq("id", id as string).single();
    expect(data?.status).toBe("en_attente");
  });

  it("un visiteur non connecté n'appelle aucune de ces RPC, et rien ne bouge", async () => {
    const anon = clientAnonyme();
    const avantDevis = await compter("devis");
    const avantFactures = await compter("factures");

    for (const [nom, args] of [
      ["dupliquer_devis", { p_id: devisSigne.id }],
      ["dupliquer_facture", { p_id: factureAvoir }],
      ["dupliquer_projet", { p_id: projetSigne }],
      ["nouvelle_version_devis", { p_id: devisVersionne }],
      ["rouvrir_devis", { p_id: devisEnvoye }],
      ["annuler_facture", { p_id: factureAnnulation, p_motif: "essai" }],
      ["avoir_depuis_facture", { p_id: factureAnnulation, p_lignes: null }],
    ] as [string, Record<string, unknown>][]) {
      const { error } = await anon.rpc(nom, args);
      expect(error, `${nom} doit être refusée à un visiteur non connecté`).not.toBeNull();
    }

    expect(await compter("devis")).toBe(avantDevis);
    expect(await compter("factures")).toBe(avantFactures);
    expect((await lireFacture(factureAnnulation)).status).toBe("emise");
    expect((await lireDevis(devisEnvoye)).status).toBe("envoye");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("B — Nouvelle version d'un devis", () => {
  it("crée la version 2 en brouillon et fait passer l'original en « remplacé »", async () => {
    const { data: id, error } = await patron().rpc("nouvelle_version_devis", { p_id: devisVersionne });
    expect(error, error?.message).toBeNull();
    const v2 = await lireDevis(id as string);
    const v1 = await lireDevis(devisVersionne);

    expect(v2.version).toBe(2);
    expect(v2.parent_id).toBe(devisVersionne);
    expect(v2.status).toBe("brouillon");
    expect(v2.numero).toBeNull(); // numérotation propre, attribuée à la finalisation
    expect(v2.items).toEqual(v1.items);
    expect(v1.status).toBe("remplace");
    // L'original garde son numéro : on ne réécrit pas le passé, on dit qu'il est passé.
    expect(v1.numero).toMatch(/^DV-\d{4}-\d{4}$/);
  });

  it("refuse une deuxième version du même devis, et aucun troisième devis n'est créé", async () => {
    const avant = await compter("devis");
    const { error } = await patron().rpc("nouvelle_version_devis", { p_id: devisVersionne });
    expect(error?.message ?? "").toContain("DEVIS_DEJA_REMPLACE");
    expect(await compter("devis")).toBe(avant);
  });

  it("refuse de versionner un brouillon — un brouillon se modifie", async () => {
    const { data: brouillonId } = await patron().rpc("dupliquer_devis", { p_id: devisSigne.id });
    const avant = await compter("devis");
    const { error } = await patron().rpc("nouvelle_version_devis", { p_id: brouillonId as string });
    expect(error?.message ?? "").toContain("DEVIS_BROUILLON_MODIFIABLE");
    expect(await compter("devis")).toBe(avant);
    expect((await lireDevis(brouillonId as string)).status).toBe("brouillon");
  });

  it("refuse de versionner un devis déjà facturé : c'est un avoir qu'il faut", async () => {
    const avant = await compter("devis");
    const { error } = await patron().rpc("nouvelle_version_devis", { p_id: devisFacture });
    expect(error?.message ?? "").toContain("DEVIS_DEJA_FACTURE");
    expect(await compter("devis")).toBe(avant);
    expect((await lireDevis(devisFacture)).status).toBe("signe");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("C — Repasser un devis en brouillon", () => {
  it("rouvre un devis envoyé, remet le compteur de relances à zéro et efface la date d'envoi", async () => {
    await patron().from("devis").update({ relance_count: 2, derniere_relance_at: new Date().toISOString() }).eq("id", devisEnvoye);
    const { error } = await patron().rpc("rouvrir_devis", { p_id: devisEnvoye });
    expect(error, error?.message).toBeNull();

    const d = await lireDevis(devisEnvoye);
    expect(d.status).toBe("brouillon");
    expect(d.envoye_at).toBeNull();
    expect(d.relance_count).toBe(0);
    expect(d.derniere_relance_at).toBeNull();
    // Le numéro déjà attribué est conservé : un devis n'est pas une pièce comptable séquencée,
    // et en brûler un à chaque correction serait absurde.
    expect(d.numero).toMatch(/^DV-\d{4}-\d{4}$/);
  });

  it("rouvre un devis refusé — un clic malheureux n'est plus un cul-de-sac", async () => {
    expect((await lireDevis(devisRefuse)).status).toBe("refuse");
    const { error } = await patron().rpc("rouvrir_devis", { p_id: devisRefuse });
    expect(error, error?.message).toBeNull();
    expect((await lireDevis(devisRefuse)).status).toBe("brouillon");
  });

  it("refuse de rouvrir un devis signé, et le statut reste « signé »", async () => {
    const { error } = await patron().rpc("rouvrir_devis", { p_id: devisSigne.id });
    expect(error?.message ?? "").toContain("DEVIS_SIGNE_VERROUILLE");
    expect((await lireDevis(devisSigne.id)).status).toBe("signe");
  });

  it("refuse de rouvrir un devis remplacé", async () => {
    const { error } = await patron().rpc("rouvrir_devis", { p_id: devisVersionne });
    expect(error?.message ?? "").toContain("DEVIS_REMPLACE");
    expect((await lireDevis(devisVersionne)).status).toBe("remplace");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("D — Annuler une facture", () => {
  it("pose enfin le statut « annulée », avec son motif, sans libérer le numéro", async () => {
    const avant = await lireFacture(factureAnnulation);
    const { error } = await patron().rpc("annuler_facture", { p_id: factureAnnulation, p_motif: "  Émise sur le mauvais client  " });
    expect(error, error?.message).toBeNull();

    const apres = await lireFacture(factureAnnulation);
    expect(apres.status).toBe("annulee");
    expect(apres.motif_annulation).toBe("Émise sur le mauvais client");
    expect(apres.annulee_at).not.toBeNull();
    // Le numéro reste consommé : une numérotation comptable est chronologique et continue
    // (art. 242 nonies A ann. II CGI). Le recycler crée un doublon dans le FEC.
    expect(apres.numero).toBe(avant.numero);
  });

  it("refuse un motif vide, et la facture reste émise", async () => {
    const { data: f } = await patron().from("factures").insert({
      atelier_id: ctx().seed.atelierId, client_id: ctx().seed.clientSimpleId, type: "libre",
      items: [ligneLibre({ libelle: "Test motif", qte: 1, pu: 100 })],
      ...calcTotaux([ligneLibre({ libelle: "Test motif", qte: 1, pu: 100 })], null),
    }).select("id").single();
    const id = (f as { id: string }).id;
    await emettre(id);

    const { error } = await patron().rpc("annuler_facture", { p_id: id, p_motif: "   " });
    expect(error?.message ?? "").toContain("MOTIF_ANNULATION_REQUIS");
    expect((await lireFacture(id)).status).toBe("emise");
  });

  it("refuse d'annuler une facture payée : c'est un avoir qu'il faut", async () => {
    const { error } = await patron().rpc("annuler_facture", { p_id: facturePayee, p_motif: "erreur" });
    expect(error?.message ?? "").toContain("FACTURE_PAYEE_AVOIR");
    expect((await lireFacture(facturePayee)).status).toBe("payee");
  });

  it("refuse d'annuler une facture déjà partiellement encaissée", async () => {
    const lignes = [ligneLibre({ libelle: "Acompte encaissé", qte: 1, pu: 200 })];
    const { data: f } = await patron().from("factures").insert({
      atelier_id: ctx().seed.atelierId, client_id: ctx().seed.clientSimpleId, type: "libre",
      items: lignes, ...calcTotaux(lignes, null),
    }).select("id").single();
    const id = (f as { id: string }).id;
    await emettre(id);
    await patron().from("paiements").insert({ atelier_id: ctx().seed.atelierId, facture_id: id, montant: 50, moyen: "virement" });

    const { error } = await patron().rpc("annuler_facture", { p_id: id, p_motif: "erreur de saisie" });
    expect(error?.message ?? "").toContain("FACTURE_ENCAISSEE");
    expect((await lireFacture(id)).status).toBe("emise");
  });

  it("refuse d'annuler un brouillon — il n'a jamais existé pour le client", async () => {
    const { data: id } = await patron().rpc("dupliquer_facture", { p_id: facturePayee });
    const { error } = await patron().rpc("annuler_facture", { p_id: id as string, p_motif: "erreur" });
    expect(error?.message ?? "").toContain("FACTURE_BROUILLON_SUPPRIMABLE");
    expect((await lireFacture(id as string)).status).toBe("brouillon");
  });

  it("une facture annulée ne se modifie plus et ne redevient jamais émise", async () => {
    const avant = await lireFacture(factureAnnulation);

    // Retour arrière tenté en direct sur PostgREST, comme depuis la console du navigateur.
    const retour = await patron().from("factures").update({ status: "emise" }).eq("id", factureAnnulation);
    expect(retour.error?.message ?? "").toContain("FACTURE_ANNULEE_DEFINITIVE");

    const retouche = await patron().from("factures").update({ total_ttc: 1 }).eq("id", factureAnnulation);
    expect(retouche.error?.message ?? "").toContain("DOCUMENT_FIGE");

    const apres = await lireFacture(factureAnnulation);
    expect(apres.status).toBe("annulee");
    expect(nb(apres.total_ttc)).toBe(nb(avant.total_ttc));
  });

  it("refuse une seconde annulation", async () => {
    const { error } = await patron().rpc("annuler_facture", { p_id: factureAnnulation, p_motif: "encore" });
    expect(error?.message ?? "").toContain("FACTURE_DEJA_ANNULEE");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("E — Avoir depuis une facture", () => {
  it("l'avoir total reprend les lignes, la remise et les mentions, et pose `facture_liee_id`", async () => {
    const source = await lireFacture(factureAvoir);
    const { data: id, error } = await patron().rpc("avoir_depuis_facture", { p_id: factureAvoir, p_lignes: null });
    expect(error, error?.message).toBeNull();
    const avoir = await lireFacture(id as string);

    expect(avoir.type).toBe("avoir");
    expect(avoir.status).toBe("brouillon");
    expect(avoir.facture_liee_id).toBe(factureAvoir);
    expect(avoir.items).toEqual(source.items);
    expect(avoir.remise).toEqual(source.remise);
    expect(avoir.nature_operation).toBe(source.nature_operation);
    expect(nb(avoir.total_ttc)).toBe(nb(source.total_ttc));
    // Le rattachement au chantier : c'est lui qui fait retomber l'avoir dans la marge du projet.
    expect(avoir.projet_id).toBe(projetSigne);
    // Un avoir n'appelle aucun règlement : pas d'échéance.
    expect(avoir.due_date).toBeNull();
    // LE SIGNE. Les montants sont positifs, c'est le `type` qui dit la déduction. Des lignes
    // négatives feraient basculer `ventilationTva()` sur une tranche unique à 0 % et le FEC
    // écrirait l'avoir à l'envers.
    expect(nb(avoir.total_ttc)).toBeGreaterThan(0);
    expect((avoir.items as DevisItem[]).every((i) => Number(i.total_ht) >= 0)).toBe(true);
  });

  it("le cumul des avoirs ne dépasse jamais la facture d'origine — et c'est la base qui le dit", async () => {
    // Un avoir total existe déjà (test précédent) : le second doit être refusé, brouillon compris.
    const avant = await compter("factures");
    const { error } = await patron().rpc("avoir_depuis_facture", { p_id: factureAvoir, p_lignes: null });
    expect(error?.message ?? "").toContain("AVOIR_SUPERIEUR_FACTURE");
    expect(await compter("factures")).toBe(avant);

    const { count } = await patron()
      .from("factures")
      .select("id", { count: "exact", head: true })
      .eq("facture_liee_id", factureAvoir)
      .eq("type", "avoir");
    expect(count).toBe(1);
  });

  it("l'avoir partiel ne reprend que les lignes choisies, et ses totaux sont recalculés en base", async () => {
    const source = await lireFacture(facturePartielle);
    const lignes = source.items as DevisItem[];
    // On ne crédite que la seconde ligne (le transport).
    const { data: id, error } = await patron().rpc("avoir_depuis_facture", { p_id: facturePartielle, p_lignes: [1] });
    expect(error, error?.message).toBeNull();
    const avoir = await lireFacture(id as string);

    expect(avoir.items).toEqual([lignes[1]]);
    const attendu = calcTotaux([lignes[1]], { type: "pct", valeur: 10 });
    expect(nb(avoir.total_ht)).toBe(attendu.total_ht);
    expect(nb(avoir.total_tva)).toBe(attendu.total_tva);
    expect(nb(avoir.total_ttc)).toBe(attendu.total_ttc);
    expect(nb(avoir.total_ttc)).toBeLessThan(nb(source.total_ttc));
  });

  it("un avoir partiel de plus refuse dès que le cumul dépasserait la facture", async () => {
    const source = await lireFacture(facturePartielle);
    const avant = await compter("factures");
    // Cette fois toutes les lignes : ajouté au partiel déjà émis, le cumul déborde.
    const { error } = await patron().rpc("avoir_depuis_facture", { p_id: facturePartielle, p_lignes: null });
    expect(error?.message ?? "").toContain("AVOIR_SUPERIEUR_FACTURE");
    expect(await compter("factures")).toBe(avant);
    expect(nb((await lireFacture(facturePartielle)).total_ttc)).toBe(nb(source.total_ttc));
  });

  it("refuse une sélection de lignes vide", async () => {
    const avant = await compter("factures");
    const { error } = await patron().rpc("avoir_depuis_facture", { p_id: facturePartielle, p_lignes: [] });
    expect(error?.message ?? "").toContain("AVOIR_SANS_LIGNE");
    expect(await compter("factures")).toBe(avant);
  });

  it("refuse l'avoir d'un brouillon et l'avoir d'un avoir", async () => {
    const avant = await compter("factures");
    const brouillon = await patron().rpc("avoir_depuis_facture", { p_id: factureAcompte, p_lignes: null });
    expect(brouillon.error?.message ?? "").toContain("FACTURE_NON_EMISE");

    const { data: avoirId } = await patron()
      .from("factures")
      .select("id")
      .eq("facture_liee_id", factureAvoir)
      .eq("type", "avoir")
      .limit(1)
      .single();
    const surAvoir = await patron().rpc("avoir_depuis_facture", { p_id: (avoirId as { id: string }).id, p_lignes: null });
    expect(surAvoir.error?.message ?? "").toContain("AVOIR_SUR_AVOIR");

    expect(await compter("factures")).toBe(avant);
  });

  it("refuse l'avoir d'une facture annulée : elle n'a rien produit", async () => {
    const avant = await compter("factures");
    const { error } = await patron().rpc("avoir_depuis_facture", { p_id: factureAnnulation, p_lignes: null });
    expect(error?.message ?? "").toContain("FACTURE_NON_EMISE");
    expect(await compter("factures")).toBe(avant);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("Le jumeau SQL de calcTotaux dit la même chose que le TypeScript", () => {
  /**
   * `_totaux_document` reproduit `calcTotaux` en SQL, parce qu'un avoir partiel et une copie de
   * facture de solde changent les lignes et ne peuvent pas recopier les totaux. Les deux
   * implémentations doivent tomber au centime — sinon le pied du document ne retombe pas sur ses
   * lignes, et la facture électronique est rejetée (BR-CO-15).
   */
  const cas: { nom: string; items: DevisItem[]; remise: { type: "pct" | "montant"; valeur: number } | null }[] = [
    { nom: "un seul taux, sans remise", items: [ligneLibre({ libelle: "A", qte: 3, pu: 120 })], remise: null },
    {
      nom: "deux taux et une remise en pourcentage",
      items: [ligneLibre({ libelle: "A", qte: 1, pu: 400 }), ligneLibre({ libelle: "B", qte: 1, pu: 400, tva: 5.5 })],
      remise: { type: "pct", valeur: 12 },
    },
    {
      nom: "une remise en euros supérieure au sous-total, ramenée au plancher",
      items: [ligneLibre({ libelle: "A", qte: 1, pu: 90 })],
      remise: { type: "montant", valeur: 500 },
    },
    {
      nom: "un forfait minimum hors assiette de remise",
      items: [
        ligneLibre({ libelle: "A", qte: 1, pu: 13.5 }),
        { type: "libre", libelle: "Forfait minimum", qte: 1, unite: "forfait", pu_ht: 36.5, tva: 20, total_ht: 36.5, meta: { forfait_minimum: true, plancher: 50 } },
      ],
      remise: { type: "pct", valeur: 10 },
    },
    {
      nom: "une déduction d'acompte, hors assiette et hors ventilation",
      items: [
        ligneLibre({ libelle: "Chantier", qte: 1, pu: 1000 }),
        { type: "libre", libelle: "Acompte déjà facturé", qte: 1, unite: "forfait", pu_ht: -300, tva: 20, total_ht: -300, meta: { deduction_acompte: true } },
      ],
      remise: { type: "pct", valeur: 5 },
    },
  ];

  for (const c of cas) {
    it(c.nom, async () => {
      const { data, error } = await patron().rpc("_totaux_document", { p_items: c.items, p_remise: c.remise });
      expect(error, error?.message).toBeNull();
      const sql = (data as { total_ht: string; total_tva: string; total_ttc: string }[])[0];
      const ts = calcTotaux(c.items, c.remise);
      expect(nb(sql.total_ht)).toBe(ts.total_ht);
      expect(nb(sql.total_tva)).toBe(ts.total_tva);
      expect(nb(sql.total_ttc)).toBe(ts.total_ttc);
    });
  }
});
