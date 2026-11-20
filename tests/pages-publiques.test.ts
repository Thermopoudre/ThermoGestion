import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { creerDevis, finaliserDevis, ligneM2, ligneLibre, chargerGrille } from "./helpers/devis";
import { calcTotaux, factureARegler, montantForfaitMinimum, montantRemise, remiseAffichee, round2, sousTotalRemisable } from "@/lib/utils";
import { euroL, textes } from "@/lib/i18n";
import type { DevisItem, GrilleCoef, GrillePalier } from "@/lib/types";
import { attendreLectureFermee } from "./helpers/refus";

/**
 * Les cinq pages publiques (lot 5, réserve R2) — `/d/`, `/f/`, `/bl/`, `/rc/`, `/s/`.
 *
 * Ce sont les seules pages que voit le client final de l'atelier, et les deux bugs les plus graves
 * du projet y ont été trouvés : une remise qui disparaissait de la facture, une remise invisible
 * sur le devis. Ce fichier ferme la troisième occurrence de la même famille — la remise absente du
 * bon de livraison — et surtout il **fige le contrat** : chaque RPC publique doit continuer à
 * servir les champs dont la page a besoin.
 *
 * Le principe : ce que la page affiche est recalculé ici avec les mêmes fonctions
 * (`calcTotaux`, `sousTotalRemisable`, `montantRemise`) à partir de ce que sert la RPC, et comparé
 * au centime aux totaux enregistrés en base. Une RPC qui cesse d'exposer la remise fait tomber le
 * test, au lieu de faire disparaître 12 % du prix sur l'écran d'un client.
 */

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;

const REMISE = { type: "pct", valeur: 12 } as const;

type Doc = { devisToken: string; factureToken: string; blToken: string; projetToken: string; receptionToken: string };
const doc = {} as Doc;
let items: DevisItem[];
let avoirToken = "";
let annuleeToken = "";
let zeroToken = "";
let remiseFixeToken = "";

/** Ce que la page affiche dans son bloc de totaux, reconstitué depuis les données servies. */
function blocTotaux(
  lignes: { total_ht: number | string; tva?: number; meta?: Record<string, unknown> | null }[],
  remise: { type: "pct" | "montant"; valeur: number } | null,
  totalHt?: number | string | null,
) {
  const sousTotal = sousTotalRemisable(lignes);
  // `remiseAffichee` est la fonction qu'appelle réellement le composant `BlocTotaux` des pages
  // publiques : c'est la remise imputée, pas la remise nominale. Sans elle, le bloc affiché ne
  // s'additionne pas dès qu'une remise est répartie entre deux taux de TVA.
  const remiseMontant = remiseAffichee(lignes, remise, totalHt ?? round2(sousTotal - montantRemise(lignes, remise)));
  return { sousTotal, remiseMontant, apresRemise: round2(sousTotal - remiseMontant) };
}

/**
 * Émet la facture, comme le fait le bouton « Émettre » de la fiche.
 *
 * POURQUOI ce détour depuis l'audit du 21/08 : les pages publiques ne servent plus les
 * brouillons. Le jeton public existe pourtant dès la création de la ligne — un brouillon de
 * facture était donc lisible avant émission si son jeton fuitait, avec des montants qui bougent
 * encore et sans date d'émission. Ce fichier créait ses factures et les lisait aussitôt en
 * anonyme : il décrivait un parcours qui n'existe pas. Une facture qu'un client peut ouvrir est
 * une facture émise.
 */
async function emettre(id: string) {
  const { error } = await sb.from("factures").update({ status: "emise" }).eq("id", id);
  if (error) throw new Error(`émission de la facture : ${error.message}`);
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const { paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleStandardId);
  items = [
    ligneM2({ surface: 5.4, finition: "brillant", complexite: "moyenne", grilleId: ctx.seed.grilleStandardId, paliers: paliers as GrillePalier[], coefs: coefs as GrilleCoef[] }),
    ligneLibre({ libelle: "Masquage filetages", qte: 8, pu: 3.5, tva: 20, unite: "piece" }),
  ];

  // Chaîne complète sur un même dossier remisé : devis → signature → projet → BL → facture.
  const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientRemiseId, items, remise: { ...REMISE }, notes: "Livraison sur palette." });
  const envoye = await finaliserDevis(sb, devis.id);
  doc.devisToken = envoye.public_token;

  const { data: signe } = await anon.rpc("signer_devis", {
    p_token: envoye.public_token, p_nom: "Patrick Testard",
    p_signature: { image: "data:,", at: new Date().toISOString() }, p_ip: "127.0.0.1",
  });
  expect(signe).toBe(true);

  const { data: projet } = await sb.from("projets").select("id, public_token").eq("devis_id", devis.id).single();
  doc.projetToken = projet!.public_token as string;

  // Le BL reprend les lignes du devis — et, depuis le lot 5, sa remise.
  const lignesBL = items.map((it) => ({
    libelle: it.libelle, qte: it.qte, unite: it.unite, pu_ht: it.pu_ht, tva: it.tva,
    total_ht: round2(it.qte * it.pu_ht),
  }));
  const { data: bl, error: errBl } = await sb
    .from("bons_livraison")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, projet_id: projet!.id,
      lignes: lignesBL, remise: { ...REMISE }, nb_colis: 2, poids_kg: 41.5, note: "2 colis fragiles",
      // Émis, et pas laissé en brouillon : un bon qu'on donne à signer au client a quitté la
      // préparation. `bl_public` et `signer_bl` refusent désormais les brouillons — même règle
      // qu'au portail client, qui les écartait déjà.
      status: "emis",
    })
    .select("*")
    .single();
  if (errBl) throw new Error(`BL : ${errBl.message}`);
  doc.blToken = bl!.public_token as string;

  const totaux = calcTotaux(items, { ...REMISE });
  const { data: facture, error: errF } = await sb
    .from("factures")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, devis_id: devis.id,
      projet_id: projet!.id, type: "solde", items, remise: { ...REMISE }, ...totaux,
    })
    .select("*")
    .single();
  if (errF) throw new Error(`facture : ${errF.message}`);
  await emettre(facture!.id as string);
  doc.factureToken = facture!.public_token as string;

  const { data: reception, error: errR } = await sb
    .from("receptions")
    .insert({
      atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, projet_id: projet!.id,
      nb_pieces: 14, designation: "Garde-corps 6 modules", etat_constate: "rayures",
      reserves: "Deux rayures profondes sur le module 3, signalées au dépôt.",
      depose_par: "Patrick Testard",
    })
    .select("public_token")
    .single();
  if (errR) throw new Error(`réception : ${errR.message}`);
  doc.receptionToken = reception!.public_token as string;

  // Cas limites : avoir, document annulé, montant nul, remise en montant fixe.
  const ligneAvoir = [ligneLibre({ libelle: "Retouche à notre charge", qte: 1, pu: 80, tva: 20 })];
  const { data: avoir } = await sb.from("factures").insert({
    atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientRemiseId, type: "avoir",
    items: ligneAvoir, remise: null, ...calcTotaux(ligneAvoir, null),
  }).select("id, public_token").single();
  await emettre(avoir!.id as string);
  avoirToken = avoir!.public_token as string;

  const { data: annulee } = await sb.from("factures").insert({
    atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, type: "libre",
    items: ligneAvoir, remise: null, ...calcTotaux(ligneAvoir, null), status: "annulee",
  }).select("public_token").single();
  annuleeToken = annulee!.public_token as string;

  const ligneZero = [ligneLibre({ libelle: "Geste commercial", qte: 1, pu: 0, tva: 20 })];
  const { data: zero } = await sb.from("factures").insert({
    atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, type: "libre",
    items: ligneZero, remise: null, ...calcTotaux(ligneZero, null),
  }).select("id, public_token").single();
  await emettre(zero!.id as string);
  zeroToken = zero!.public_token as string;

  const ligneFixe = [ligneLibre({ libelle: "Thermolaquage portail", qte: 1, pu: 340, tva: 20 })];
  const remiseFixe = { type: "montant", valeur: 40 } as const;
  const { data: fixe } = await sb.from("factures").insert({
    atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, type: "libre",
    items: ligneFixe, remise: { ...remiseFixe }, ...calcTotaux(ligneFixe, { ...remiseFixe }),
  }).select("id, public_token").single();
  await emettre(fixe!.id as string);
  remiseFixeToken = fixe!.public_token as string;
});

describe("contrat des RPC publiques — ce que la page a besoin de recevoir", () => {
  it("devis_public sert la remise, sans quoi elle redevient invisible sur le devis", async () => {
    const { data } = await anon.rpc("devis_public", { p_token: doc.devisToken });
    for (const cle of ["numero", "status", "items", "remise", "total_ht", "total_tva", "total_ttc", "validite_jours", "client", "atelier"]) {
      expect(data, `devis_public n'expose plus « ${cle} »`).toHaveProperty(cle);
    }
    expect(data.remise).toEqual({ type: "pct", valeur: 12 });
  });

  it("facture_public sert la remise, le type et le statut", async () => {
    const { data } = await anon.rpc("facture_public", { p_token: doc.factureToken });
    for (const cle of ["numero", "type", "status", "items", "remise", "total_ht", "total_tva", "total_ttc", "nature_operation", "client", "atelier"]) {
      expect(data, `facture_public n'expose plus « ${cle} »`).toHaveProperty(cle);
    }
    // L'identité légale de l'émetteur est une mention obligatoire : elle vient d'ici.
    for (const cle of ["siren", "forme_juridique", "capital_social", "rcs_ville", "tva_intra", "penalites_taux", "delai_paiement_jours"]) {
      expect(data.atelier, `facture_public n'expose plus atelier.${cle}`).toHaveProperty(cle);
    }
  });

  it("bl_public sert la remise reprise du devis (régression : elle n'y était pas)", async () => {
    const { data } = await anon.rpc("bl_public", { p_token: doc.blToken });
    expect(data).toHaveProperty("remise");
    expect(data.remise).toEqual({ type: "pct", valeur: 12 });
    expect(data).toHaveProperty("lignes");
    expect(data.atelier).toHaveProperty("nom");
  });

  it("projet_public et reception_public servent ce que leurs pages affichent", async () => {
    const { data: p } = await anon.rpc("projet_public", { p_token: doc.projetToken });
    for (const cle of ["numero", "nom", "status", "etapes", "date_promise", "atelier"]) expect(p).toHaveProperty(cle);
    const { data: r } = await anon.rpc("reception_public", { p_token: doc.receptionToken });
    for (const cle of ["numero", "nb_pieces", "designation", "etat_constate", "reserves", "depose_par", "photos", "client", "atelier"]) {
      expect(r).toHaveProperty(cle);
    }
  });

  it("un jeton inconnu ne renvoie rien, et les tables restent fermées à anon", async () => {
    for (const rpc of ["devis_public", "facture_public", "bl_public", "projet_public", "reception_public"]) {
      const { data, error } = await anon.rpc(rpc, { p_token: "jeton-qui-n-existe-pas" });
      expect(error).toBeNull();
      expect(data, `${rpc} a répondu à un jeton inconnu`).toBeNull();
    }
    for (const table of ["devis", "factures", "bons_livraison", "receptions", "projets"]) {
      attendreLectureFermee(await anon.from(table).select("id"), `${table} lue par un visiteur anonyme`);
    }
  });
});

describe("cohérence des totaux avec les lignes, au centime", () => {
  it("devis : sous-total − remise = total HT affiché, et le tout retombe sur la base", async () => {
    const { data } = await anon.rpc("devis_public", { p_token: doc.devisToken });
    const { sousTotal, remiseMontant, apresRemise } = blocTotaux(data.items, data.remise);
    expect(apresRemise).toBe(round2(nb(data.total_ht)));
    expect(sousTotal).toBeGreaterThan(nb(data.total_ht));
    // Montants épinglés, calculés à la main sur le devis semé : 5,4 m² à 24 €/m² (palier 3-10 m²),
    // × 1,05 (brillant) × 1,2 (moyenne) = 163,30 € ; plus 8 masquages à 3,50 € = 28,00 €. Sous-total
    // 191,30 €, remise de 12 % = 22,96 €, total HT 168,34 €. Recalculer la remise avec la formule du
    // code (`sousTotal * 12 / 100`) redisait l'implémentation et restait vrai même si la grille
    // tarifaire changeait sous les pieds du devis.
    expect(sousTotal).toBe(191.3);
    expect(remiseMontant).toBe(22.96);
    expect(round2(nb(data.total_ht))).toBe(168.34);
    // Ligne à ligne : la somme des totaux de ligne est bien le sous-total annoncé.
    expect(round2(data.items.reduce((s: number, i: DevisItem) => s + Number(i.total_ht), 0))).toBe(sousTotal);
    expect(round2(nb(data.total_ht) + nb(data.total_tva))).toBe(round2(nb(data.total_ttc)));
  });

  it("facture : mêmes lignes, même remise, même total que le devis dont elle est issue", async () => {
    const [{ data: d }, { data: f }] = await Promise.all([
      anon.rpc("devis_public", { p_token: doc.devisToken }),
      anon.rpc("facture_public", { p_token: doc.factureToken }),
    ]);
    expect(nb(f.total_ht)).toBe(nb(d.total_ht));
    expect(nb(f.total_ttc)).toBe(nb(d.total_ttc));
    expect(f.remise).toEqual(d.remise);
    const { apresRemise } = blocTotaux(f.items, f.remise);
    expect(apresRemise).toBe(round2(nb(f.total_ht)));
  });

  it("bon de livraison : le total affiché au client est celui de sa facture, pas le prix brut", async () => {
    const [{ data: bl }, { data: f }] = await Promise.all([
      anon.rpc("bl_public", { p_token: doc.blToken }),
      anon.rpc("facture_public", { p_token: doc.factureToken }),
    ]);
    // Le BL ne stocke pas ses totaux : la page les recalcule, exactement comme ici.
    const totaux = calcTotaux(bl.lignes, bl.remise);
    expect(totaux.total_ht, "le BL annonce un total que la facture dément").toBe(nb(f.total_ht));
    expect(totaux.total_ttc).toBe(nb(f.total_ttc));
    const { sousTotal, remiseMontant } = blocTotaux(bl.lignes, bl.remise);
    expect(round2(sousTotal - remiseMontant)).toBe(totaux.total_ht);
    // Sans remise, le même BL afficherait 12 % de trop : c'est l'écart que le bug produisait.
    expect(calcTotaux(bl.lignes, null).total_ht).toBeGreaterThan(totaux.total_ht);
  });

  it("forfait minimum + remise : le bloc de totaux se recalcule de tête", async () => {
    // Régression : le devis affichait « sous-total 13,50 € − remise 1,62 € » puis « total HT
    // 25,00 € ». Le plancher de facturation était compté sans être annoncé — un client ne pouvait
    // pas refaire l'addition de son propre devis.
    const { paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleStandardId);
    const petit = [ligneM2({ surface: 0.3, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleStandardId, paliers: paliers as GrillePalier[], coefs: coefs as GrilleCoef[] })];
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items: petit, remise: { type: "pct", valeur: 12 } });
    const envoye = await finaliserDevis(sb, devis.id);

    const { data } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    const sousTotal = sousTotalRemisable(data.items);
    const remiseMontant = montantRemise(data.items, data.remise);
    const forfait = montantForfaitMinimum(data.items);

    expect(forfait, "ce devis doit déclencher le plancher de facturation").toBeGreaterThan(0);
    expect(round2(sousTotal - remiseMontant + forfait), "le bloc de totaux ne retombe pas sur le total HT")
      .toBe(round2(nb(data.total_ht)));
    // Et le plancher est bien tenu : le total HT ne descend pas sous le forfait de la grille.
    expect(nb(data.total_ht)).toBeGreaterThanOrEqual(50);
  });

  it("devis_public sert l'identité légale de l'émetteur, comme le PDF du même devis", async () => {
    const { data } = await anon.rpc("devis_public", { p_token: doc.devisToken });
    for (const cle of ["adresse", "code_postal", "ville", "siren", "forme_juridique", "capital_social", "rcs_ville", "tva_intra", "assujetti_tva", "delai_paiement_jours", "penalites_taux"]) {
      expect(data.atelier, `devis_public n'expose plus atelier.${cle}`).toHaveProperty(cle);
    }
    expect(data.atelier.siren).toBe("900123456");
  });

  it("remise en montant fixe : 40 € retirés, pas 40 %", async () => {
    const { data } = await anon.rpc("facture_public", { p_token: remiseFixeToken });
    const { sousTotal, remiseMontant } = blocTotaux(data.items, data.remise);
    expect(sousTotal).toBe(340);
    expect(remiseMontant).toBe(40);
    expect(nb(data.total_ht)).toBe(300);
    expect(nb(data.total_ttc)).toBe(360);
  });
});

describe("cas limites du document facturé", () => {
  it("un avoir est titré « Avoir », pas « Facture », et n'appelle aucun règlement", async () => {
    const { data } = await anon.rpc("facture_public", { p_token: avoirToken });
    expect(data.type).toBe("avoir");
    expect(textes("fr").typesFacture[data.type]).toBe("Avoir");
    expect(textes("it").typesFacture[data.type]).toBe("Nota di credito");
    // Règle appliquée par la page : ni bouton de paiement, ni délai de paiement, ni pénalités.
    // La règle vient de la production (`factureARegler`), pas d'une copie locale : trois écrans
    // sur quatre l'écrivaient à leur façon, et trois oubliaient le cas du zéro euro.
    expect(factureARegler(data), "ce document ne doit appeler aucun règlement").toBe(false);
  });

  it("une facture annulée est signalée comme telle et ne propose plus de paiement", async () => {
    const { data } = await anon.rpc("facture_public", { p_token: annuleeToken });
    expect(data.status).toBe("annulee");
    // La règle vient de la production (`factureARegler`), pas d'une copie locale : trois écrans
    // sur quatre l'écrivaient à leur façon, et trois oubliaient le cas du zéro euro.
    expect(factureARegler(data), "ce document ne doit appeler aucun règlement").toBe(false);
    expect(textes("fr").factureAnnulee).toBe("Facture annulée");
    expect(textes("it").factureAnnulee).toBe("Fattura annullata");
  });

  it("un montant nul n'offre pas de paiement en ligne", async () => {
    const { data } = await anon.rpc("facture_public", { p_token: zeroToken });
    expect(nb(data.total_ttc)).toBe(0);
    // La règle vient de la production (`factureARegler`), pas d'une copie locale : trois écrans
    // sur quatre l'écrivaient à leur façon, et trois oubliaient le cas du zéro euro.
    expect(factureARegler(data), "ce document ne doit appeler aucun règlement").toBe(false);
  });

  it("client sans adresse et atelier sans logo : rien ne casse, les blocs disparaissent", async () => {
    // Client dédié plutôt que mutation du semis : un autre fichier de la suite vérifie l'adresse
    // des clients semés, et un test ne doit pas dépendre de son rang d'exécution.
    const { data: nu } = await sb
      .from("clients")
      .insert({ atelier_id: ctx.seed.atelierId, type: "particulier", nom: "Client sans adresse", email: null })
      .select("id")
      .single();
    const ligne = [ligneLibre({ libelle: "Laquage", qte: 1, pu: 50, tva: 20 })];
    const { data: f } = await sb
      .from("factures")
      .insert({ atelier_id: ctx.seed.atelierId, client_id: nu!.id, type: "libre", items: ligne, remise: null, ...calcTotaux(ligne, null) })
      .select("id, public_token")
      .single();
    await emettre(f!.id as string);

    const { data } = await anon.rpc("facture_public", { p_token: f!.public_token });
    expect(data.client.adresse).toBeNull();
    expect(data.client.adresse_livraison).toBeNull();
    expect(data.atelier.logo_url).toBeNull();
    // L'identité légale de l'émetteur, elle, reste servie : c'est une mention obligatoire.
    expect(data.atelier.siren).toBe("900123456");
  });
});

describe("bascule FR/IT", () => {
  it("les deux langues couvrent les mêmes clés — aucune ne retombe en français par accident", () => {
    const fr = textes("fr") as unknown as Record<string, unknown>;
    const it = textes("it") as unknown as Record<string, unknown>;
    expect(Object.keys(it).sort()).toEqual(Object.keys(fr).sort());
    for (const [cle, valeur] of Object.entries(fr)) {
      if (typeof valeur === "string") expect(typeof it[cle], `${cle} manquant en italien`).toBe("string");
      if (valeur && typeof valeur === "object") {
        expect(Object.keys(it[cle] as object).sort(), `sous-clés de ${cle} désalignées`).toEqual(Object.keys(valeur as object).sort());
      }
    }
  });

  it("les montants suivent la locale : 1 234,50 € en français, 1.234,50 € en italien", () => {
    // Les locales emploient des espaces insécables (U+00A0, U+202F) : on les normalise avant de comparer.
    const normal = (v: string) => v.replace(/[\u00a0\u202f]/g, " ");
    expect(normal(euroL(1234.5, "fr"))).toBe("1 234,50 €");
    // L'italien ne groupe pas les nombres à quatre chiffres (CLDR : minimumGroupingDigits = 2) —
    // « 1234,50 € » est la forme correcte, il faut cinq chiffres pour voir le séparateur.
    expect(normal(euroL(1234.5, "it"))).toBe("1234,50 €");
    expect(normal(euroL(12345.5, "it"))).toBe("12.345,50 €");
    expect(normal(euroL(12345.5, "fr"))).toBe("12 345,50 €");
  });

  it("le statut d'un devis non signable est un mot, pas un code interne", () => {
    expect(textes("fr").statutsDevis.refuse).toBe("refusé");
    expect(textes("it").statutsDevis.expire).toBe("scaduto");
    expect(textes("fr").devisNonSignable(textes("fr").statutsDevis.expire)).toContain("expiré");
  });
});
