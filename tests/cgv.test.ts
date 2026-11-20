import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { DevisDocument, FactureDocument } from "@/lib/pdf/document";
import { errorFr } from "@/lib/errors";
import type { Atelier, Client, Devis, Facture, GrilleCoef, GrillePalier } from "@/lib/types";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { chargerGrille, creerDevis, finaliserDevis, ligneM2 } from "./helpers/devis";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";

/**
 * Conditions générales de vente par atelier, avec surcharge par client (migration 76).
 *
 * Le point qui compte le plus n'est pas le champ de saisie, c'est le FIGEAGE : le texte recopié
 * sur un devis à son envoi et sur une facture à son émission ne doit plus jamais bouger, même si
 * l'atelier ou le client changent leurs conditions ensuite. C'est `trg_figer_cgv` (migration 76)
 * qui le fait, en base, au même titre que `trg_figer_document` verrouille le reste du document
 * une fois signé/émis (documents-figes.test.ts).
 */

// ── Annexe PDF — aucune base de données, juste le rendu ──────────────────────

const atelierPdf = {
  id: "a",
  nom: "ThermoTest",
  adresse: "12 avenue des Ateliers",
  code_postal: "83150",
  ville: "Bandol",
  telephone: "04 94 00 00 00",
  email: "contact@thermotest.fr",
  siren: "900123456",
  siret: "90012345600018",
  tva_intra: "FR12900123456",
  assujetti_tva: true,
  tva_sur_debits: false,
  pays: "FR",
  forme_juridique: "SARL",
  capital_social: 10000,
  rcs_ville: "Toulon",
  rm_numero: null,
  delai_paiement_jours: 30,
  penalites_taux: 10.5,
  escompte_texte: null,
  assurance_nom: null,
  assurance_contrat: null,
  assurance_zone: null,
  iban: null,
  bic: null,
  couleur: "#147085",
  logo_url: null,
} as unknown as Atelier;

const clientPdf = {
  id: "c",
  nom: "Menuiserie Aluval",
  adresse: "3 rue de l'Étang",
  code_postal: "13400",
  ville: "Aubagne",
  siren: "812345678",
  adresse_livraison: null,
  delai_paiement_jours: null,
} as unknown as Client;

const facturePdf = {
  id: "f",
  numero: "FA-2026-0004",
  type: "solde",
  emise_at: "2026-08-18T09:12:00.000Z",
  created_at: "2026-08-18T09:00:00.000Z",
  due_date: "2026-09-17",
  nature_operation: "services",
  total_ht: 131.04,
  total_tva: 26.21,
  total_ttc: 157.25,
  remise: null,
  items: [{ libelle: "Thermolaquage portail", qte: 4.2, unite: "m2", pu_ht: 31.2, total_ht: 131.04, type: "m2" }],
} as unknown as Facture;

const devisPdf = {
  id: "d",
  numero: "DV-2026-0007",
  created_at: "2026-08-18T09:00:00.000Z",
  validite_jours: 30,
  total_ht: 131.04,
  total_tva: 26.21,
  total_ttc: 157.25,
  remise: null,
  notes: null,
  signed_at: null,
  signed_by: null,
  items: [{ libelle: "Thermolaquage portail", qte: 4.2, unite: "m2", pu_ht: 31.2, total_ht: 131.04, type: "prestation" }],
} as unknown as Devis;

async function nbPages(document: Parameters<typeof renderToBuffer>[0]) {
  const { PDFDocument } = await import("pdf-lib");
  return (await PDFDocument.load(await renderToBuffer(document))).getPageCount();
}

const CGV_LONGUES = "Article 1 — Objet. Les présentes conditions générales de vente régissent les relations contractuelles entre l'atelier et son client. ".repeat(4);

describe("annexe des conditions générales dans le PDF", () => {
  it("n'ajoute pas d'annexe quand le texte est absent, nul ou blanc", async () => {
    expect(await nbPages(FactureDocument({ facture: facturePdf, client: clientPdf, atelier: atelierPdf, logo: null }))).toBe(1);
    expect(await nbPages(FactureDocument({ facture: facturePdf, client: clientPdf, atelier: atelierPdf, logo: null, cgvTexte: null }))).toBe(1);
    expect(await nbPages(FactureDocument({ facture: facturePdf, client: clientPdf, atelier: atelierPdf, logo: null, cgvTexte: "   " }))).toBe(1);
    expect(await nbPages(DevisDocument({ devis: devisPdf, client: clientPdf, atelier: atelierPdf, logo: null, cgvTexte: "" }))).toBe(1);
  });

  it("ajoute une page d'annexe dédiée quand le texte est renseigné, sur la facture comme sur le devis", async () => {
    expect(await nbPages(FactureDocument({ facture: facturePdf, client: clientPdf, atelier: atelierPdf, logo: null, cgvTexte: CGV_LONGUES }))).toBeGreaterThanOrEqual(2);
    expect(await nbPages(DevisDocument({ devis: devisPdf, client: clientPdf, atelier: atelierPdf, logo: null, cgvTexte: CGV_LONGUES }))).toBeGreaterThanOrEqual(2);
  });
});

describe("errorFr traduit le refus de longueur", () => {
  it("nomme la borne quel que soit le champ concerné", () => {
    for (const contrainte of [
      "ateliers_cgv_longueur_check",
      "clients_cgv_longueur_check",
      "devis_cgv_texte_longueur_check",
      "factures_cgv_texte_longueur_check",
    ]) {
      const msg = errorFr({ message: `new row for relation violates check constraint "${contrainte}"` });
      expect(msg, contrainte).toMatch(/20 000 caractères/);
    }
  });
});

// ── Base de données ────────────────────────────────────────────────────────

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let paliers: GrillePalier[];
let coefs: GrilleCoef[];
let cgvAtelierOriginal: string | null = null;

async function poserCgvAtelier(texte: string | null) {
  const { error } = await sb.from("ateliers").update({ cgv: texte }).eq("id", ctx.seed.atelierId);
  expect(error, `pose du cgv atelier : ${error?.message}`).toBeNull();
}

async function poserCgvClient(texte: string | null) {
  const { error } = await sb.from("clients").update({ cgv: texte }).eq("id", ctx.seed.clientSimpleId);
  expect(error, `pose du cgv client : ${error?.message}`).toBeNull();
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  ({ paliers, coefs } = await chargerGrille(sb, ctx.seed.grilleContratId));
  const { data } = await sb.from("ateliers").select("cgv").eq("id", ctx.seed.atelierId).single();
  cgvAtelierOriginal = data?.cgv ?? null;
});

afterAll(async () => {
  // On rend l'atelier partagé exactement comme on l'a trouvé : d'autres fichiers de la suite
  // relisent cet atelier sans s'attendre à des conditions générales laissées par celui-ci.
  await sb.from("ateliers").update({ cgv: cgvAtelierOriginal }).eq("id", ctx.seed.atelierId);
  await sb.from("clients").update({ cgv: null }).eq("id", ctx.seed.clientSimpleId);
});

async function nouveauDevisEnvoye() {
  const items = [ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
  const brouillon = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
  return { brouillon, envoye: await finaliserDevis(sb, brouillon.id) };
}

async function nouvelleFactureEmise() {
  const { envoye } = await nouveauDevisEnvoye();
  const { data: brouillonFacture, error: errCreation } = await sb
    .from("factures")
    .insert({
      atelier_id: envoye.atelier_id, client_id: envoye.client_id, devis_id: envoye.id, type: "solde",
      items: envoye.items, remise: envoye.remise,
      total_ht: envoye.total_ht, total_tva: envoye.total_tva, total_ttc: envoye.total_ttc,
      due_date: "2026-12-31",
    })
    .select("*")
    .single();
  expect(errCreation, `création facture : ${errCreation?.message}`).toBeNull();
  const { data: numero, error: errNum } = await sb.rpc("next_numero", { p_type: "facture" });
  expect(errNum, `next_numero : ${errNum?.message}`).toBeNull();
  const { data: emise, error: errEmission } = await sb
    .from("factures")
    .update({ status: "emise", numero, emise_at: new Date().toISOString() })
    .eq("id", brouillonFacture!.id)
    .select("*")
    .single();
  expect(errEmission, `émission facture : ${errEmission?.message}`).toBeNull();
  return { brouillon: brouillonFacture!, emise: emise! };
}

describe("le figeage : un devis envoyé et une facture émise gardent leur texte", () => {
  it("un devis brouillon n'a pas de texte figé, même si l'atelier a des conditions", async () => {
    await poserCgvAtelier("CGV atelier — brouillon.");
    await poserCgvClient(null);
    const items = [ligneM2({ surface: 2, finition: "mat", complexite: "simple", grilleId: ctx.seed.grilleContratId, paliers, coefs })];
    const brouillon = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: ctx.seed.clientSimpleId, items });
    expect(brouillon.cgv_texte).toBeNull();
  });

  it("recopie les conditions de l'atelier sur le devis à l'envoi, et ne les met plus à jour ensuite", async () => {
    const texteInitial = "CGV atelier — version A, celle qui doit rester sur ce devis.";
    await poserCgvAtelier(texteInitial);
    await poserCgvClient(null);

    const { envoye } = await nouveauDevisEnvoye();
    expect(envoye.cgv_texte).toBe(texteInitial);

    // L'atelier change ses conditions après coup : le devis déjà envoyé ne doit pas bouger — c'est
    // exactement le cas d'usage qui motive tout ce chantier (le client a signé sur un texte précis).
    await poserCgvAtelier("CGV atelier — version B, complètement différente.");
    const { data: relu } = await sb.from("devis").select("cgv_texte").eq("id", envoye.id).single();
    expect(relu!.cgv_texte).toBe(texteInitial);
  });

  it("recopie les conditions de l'atelier sur la facture à l'émission, et ne les met plus à jour ensuite", async () => {
    const texteInitial = "CGV atelier — celle qui doit rester sur cette facture.";
    await poserCgvAtelier(texteInitial);
    await poserCgvClient(null);

    const { emise } = await nouvelleFactureEmise();
    expect(emise.cgv_texte).toBe(texteInitial);

    await poserCgvAtelier("CGV atelier — encore une autre version.");
    const { data: relue } = await sb.from("factures").select("cgv_texte").eq("id", emise.id).single();
    expect(relue!.cgv_texte).toBe(texteInitial);
  });

  it("une facture brouillon n'a pas de texte figé", async () => {
    await poserCgvAtelier("CGV atelier — présente mais pas encore figée.");
    const { envoye } = await nouveauDevisEnvoye();
    const { data: brouillonFacture } = await sb
      .from("factures")
      .insert({
        atelier_id: envoye.atelier_id, client_id: envoye.client_id, devis_id: envoye.id, type: "solde",
        items: envoye.items, remise: envoye.remise,
        total_ht: envoye.total_ht, total_tva: envoye.total_tva, total_ttc: envoye.total_ttc,
        due_date: "2026-12-31",
      })
      .select("*")
      .single();
    expect(brouillonFacture!.cgv_texte).toBeNull();
  });
});

describe("la surcharge du client remplace celle de l'atelier", () => {
  it("le devis porte le texte du client, jamais les deux concaténés", async () => {
    const texteAtelier = "CGV atelier — texte par défaut, ne doit pas apparaître.";
    const texteClient = "CGV négociées avec ce client — texte particulier attendu.";
    await poserCgvAtelier(texteAtelier);
    await poserCgvClient(texteClient);

    const { envoye } = await nouveauDevisEnvoye();
    expect(envoye.cgv_texte).toBe(texteClient);
    expect(envoye.cgv_texte).not.toContain("par défaut");
  });

  it("la facture porte le texte du client, jamais les deux concaténés", async () => {
    const texteAtelier = "CGV atelier — texte par défaut, ne doit pas apparaître sur la facture.";
    const texteClient = "CGV négociées avec ce client, applicables à sa facture.";
    await poserCgvAtelier(texteAtelier);
    await poserCgvClient(texteClient);

    const { emise } = await nouvelleFactureEmise();
    expect(emise.cgv_texte).toBe(texteClient);
    expect(emise.cgv_texte).not.toContain("par défaut");
  });

  it("sans surcharge, le devis retombe sur les conditions de l'atelier", async () => {
    await poserCgvAtelier("CGV atelier — seule source possible ici.");
    await poserCgvClient(null);
    const { envoye } = await nouveauDevisEnvoye();
    expect(envoye.cgv_texte).toBe("CGV atelier — seule source possible ici.");
  });

  it("sans aucune condition nulle part, le document reste sans texte figé", async () => {
    await poserCgvAtelier(null);
    await poserCgvClient(null);
    const { envoye } = await nouveauDevisEnvoye();
    expect(envoye.cgv_texte).toBeNull();
  });
});

describe("borne de longueur (20 000 caractères)", () => {
  afterAll(async () => {
    await poserCgvAtelier(cgvAtelierOriginal);
  });

  it("refuse un texte de plus de 20 000 caractères sur l'atelier et sur le client", async () => {
    const trop = "a".repeat(20001);
    const { error: errAtelier } = await sb.from("ateliers").update({ cgv: trop }).eq("id", ctx.seed.atelierId);
    expect(errAtelier?.message ?? "", "l'atelier a accepté un texte de 20 001 caractères").toMatch(/cgv.*longueur_check|check constraint/i);
    const { error: errClient } = await sb.from("clients").update({ cgv: trop }).eq("id", ctx.seed.clientSimpleId);
    expect(errClient?.message ?? "", "le client a accepté un texte de 20 001 caractères").toMatch(/cgv.*longueur_check|check constraint/i);
  });

  it("accepte exactement 20 000 caractères", async () => {
    const pile = "a".repeat(20000);
    const { error } = await sb.from("ateliers").update({ cgv: pile }).eq("id", ctx.seed.atelierId);
    expect(error, `20 000 caractères refusés : ${error?.message}`).toBeNull();
  });
});

describe("une fois le document verrouillé, le texte figé ne se réécrit plus", () => {
  it("un devis signé refuse une réécriture directe de cgv_texte", async () => {
    await poserCgvAtelier("CGV atelier — celles du devis signé.");
    await poserCgvClient(null);
    const { envoye } = await nouveauDevisEnvoye();
    const { data: signeOk } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Signataire CGV", p_signature: {}, p_ip: null,
    });
    expect(signeOk).toBe(true);

    const { error } = await sb.from("devis").update({ cgv_texte: "texte falsifié" }).eq("id", envoye.id);
    expect(error, "la réécriture de cgv_texte sur un devis signé a été acceptée").not.toBeNull();

    const { data: relu } = await sb.from("devis").select("cgv_texte").eq("id", envoye.id).single();
    expect(relu!.cgv_texte).toBe("CGV atelier — celles du devis signé.");
  });

  it("une facture émise refuse une réécriture directe de cgv_texte", async () => {
    await poserCgvAtelier("CGV atelier — celles de la facture émise.");
    await poserCgvClient(null);
    const { emise } = await nouvelleFactureEmise();

    const { error } = await sb.from("factures").update({ cgv_texte: "texte falsifié" }).eq("id", emise.id);
    expect(error, "la réécriture de cgv_texte sur une facture émise a été acceptée").not.toBeNull();

    const { data: relue } = await sb.from("factures").select("cgv_texte").eq("id", emise.id).single();
    expect(relue!.cgv_texte).toBe("CGV atelier — celles de la facture émise.");
  });
});

describe("rendu public par jeton", () => {
  it("devis_public() rend le texte figé sous la clé cgv", async () => {
    await poserCgvAtelier("CGV publiques — visibles sur la page du devis.");
    await poserCgvClient(null);
    const { envoye } = await nouveauDevisEnvoye();
    const { data, error } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect(error, `devis_public : ${error?.message}`).toBeNull();
    expect(data.cgv).toBe("CGV publiques — visibles sur la page du devis.");
  });

  it("devis_public() ne rend rien de plus que le texte figé (pas les colonnes brutes de l'atelier/du client)", async () => {
    await poserCgvAtelier("CGV publiques — atelier.");
    await poserCgvClient("CGV publiques — client, doit primer.");
    const { envoye } = await nouveauDevisEnvoye();
    const { data } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect(data.cgv).toBe("CGV publiques — client, doit primer.");
    expect(data.atelier.cgv).toBeUndefined();
    expect(data.client.cgv).toBeUndefined();
  });

  it("facture_public() rend le texte figé sous la clé cgv", async () => {
    await poserCgvAtelier("CGV publiques — visibles sur la page de la facture.");
    await poserCgvClient(null);
    const { emise } = await nouvelleFactureEmise();
    const { data, error } = await anon.rpc("facture_public", { p_token: emise.public_token });
    expect(error, `facture_public : ${error?.message}`).toBeNull();
    expect(data.cgv).toBe("CGV publiques — visibles sur la page de la facture.");
  });
});

describe("RLS — un atelier ne lit pas les conditions générales d'un autre", () => {
  let jetable: AtelierJetable;

  beforeAll(async () => {
    jetable = await ouvrirAtelierJetable("cgv-rls");
  }, 120_000);

  afterAll(async () => {
    if (jetable) await jetable.fermer();
  });

  it("l'atelier B ne voit ni l'atelier A, ni son cgv, ni les devis qui le portent", async () => {
    await poserCgvAtelier("Secret de l'atelier A — ne doit fuiter nulle part.");
    await nouveauDevisEnvoye();

    const { data: ateliersVus } = await jetable.sb.from("ateliers").select("id, cgv").eq("id", ctx.seed.atelierId);
    expect(ateliersVus ?? [], "l'atelier B a lu une ligne de l'atelier A").toHaveLength(0);

    const { data: clientsVus } = await jetable.sb.from("clients").select("id, cgv").eq("id", ctx.seed.clientSimpleId);
    expect(clientsVus ?? [], "l'atelier B a lu la fiche client de l'atelier A").toHaveLength(0);

    const { data: devisVus } = await jetable.sb.from("devis").select("id, cgv_texte").eq("atelier_id", ctx.seed.atelierId);
    expect(devisVus ?? [], "l'atelier B a lu des devis de l'atelier A").toHaveLength(0);
  });
});

describe("démonstration — les conditions générales ne s'écrivent pas non plus", () => {
  const EMAIL_DEMO = process.env.DEMO_EMAIL ?? "demo@thermogestion.internal";
  const MOT_DE_PASSE_DEMO = process.env.DEMO_PASSWORD ?? "";
  const decrire = MOT_DE_PASSE_DEMO ? describe : describe.skip;
  let sbDemo: SupabaseClient;
  let atelierDemo: string | null = null;

  beforeAll(async () => {
    if (!MOT_DE_PASSE_DEMO) return;
    const auth = createClient(ctx.url, ctx.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: EMAIL_DEMO, password: MOT_DE_PASSE_DEMO });
    if (error || !data.session) throw new Error(`connexion au compte de démonstration impossible : ${error?.message}`);
    sbDemo = createClient(ctx.url, ctx.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
    const { data: at } = await sbDemo.from("ateliers").select("id").maybeSingle();
    atelierDemo = at?.id ?? null;
  });

  decrire("l'atelier de démonstration", () => {
    it("refuse de poser des conditions générales par défaut", async () => {
      const { error } = await sbDemo.from("ateliers").update({ cgv: "Conditions pirates" }).eq("id", atelierDemo!);
      expect(error?.message ?? "").toContain("DEMO_LECTURE_SEULE");
    });

    it("refuse de poser une surcharge sur une fiche client", async () => {
      const { data: cli } = await sbDemo.from("clients").select("id").limit(1).maybeSingle();
      expect(cli?.id, "la démonstration doit contenir au moins un client").toBeTruthy();
      const { error } = await sbDemo.from("clients").update({ cgv: "Conditions pirates" }).eq("id", cli!.id);
      expect(error?.message ?? "").toContain("DEMO_LECTURE_SEULE");
    });
  });
});
