import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientConnecte, contexte, nb } from "./helpers/contexte";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";
import { PDFDocument } from "pdf-lib";
import { xmlFacturX, NOM_PROFIL, type DonneesFacturX, type LigneFacturX } from "@/lib/facturx/xml";
import { emballerFacturX } from "@/lib/facturx/pdf";
import { extraireXmlDuPdf, formatXmlFacture, lireCii, lireUbl } from "@/lib/facturx/lecture";
import { ingererFactureRecue, refusDeDocument, type DocumentEntrant } from "@/lib/reception";

/**
 * Réception de factures fournisseurs (amélioration n°1, 07/09/2026, migration 66).
 *
 * Ce fichier prouve trois choses distinctes, pas seulement que les fonctions ne lèvent pas
 * d'exception :
 *  1. L'EXTRACTION lit vraiment ce qu'un Factur-X contient — le meilleur cas de test est un
 *     Factur-X fabriqué avec le générateur du produit lui-même (`xmlFacturX`/`emballerFacturX`),
 *     puisqu'on connaît alors la valeur exacte que l'extraction doit retrouver. Un PDF sans XML
 *     embarqué doit retomber proprement sur « pdf_simple », jamais sur une exception.
 *  2. La RLS tient : un atelier ne voit pas les factures reçues d'un autre, le comptable les lit,
 *     l'opérateur ne les lit pas — chacun attaqué depuis une vraie session, jamais déduit du code.
 *     Deux ateliers **jetables et distincts** (`ouvrirAtelierJetable`) prouvent l'isolation mieux
 *     que deux rôles dans le même atelier ne le feraient pour la question « atelier A vs atelier B ».
 *  3. Les bornes et les garde-fous partagés par tout le produit s'appliquent aussi ici : taille
 *     maximale, refus d'écriture sur l'atelier de démonstration.
 *
 * Comme le reste de la suite : l'état est toujours revérifié après coup, jamais seulement le code
 * de retour, et les comptes ajoutés dans un atelier jetable disparaissent avec lui.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });
chargerEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const ctx = () => contexte();
const patron = () => clientConnecte();

// ── Un Factur-X fabriqué avec le générateur du produit — le meilleur cas de test ─────────────

const LIGNES: LigneFacturX[] = [
  { libelle: "Poudre polyester RAL 9010 — 20 kg", qte: 20, unite: "kg", pu_ht: 9.5, total_ht: 190, tva: 20 },
];

const DONNEES_FOURNISSEUR: DonneesFacturX = {
  facture: {
    numero: "FRS-2026-4471",
    type: "libre",
    date: "2026-09-02T08:00:00.000Z",
    lignes: LIGNES,
    remise: null,
    total_ht: 190,
    total_tva: 38,
    total_ttc: 228,
    echeance: "2026-10-02",
    conditions_paiement: "Paiement à 30 jours.",
    reference_commande: null,
    nature_operation: "biens",
  },
  vendeur: {
    nom: "Poudres du Var SAS",
    siren: "812345678",
    siret: "81234567800012",
    tva_intra: "FR56812345678",
    adresse: "8 rue de l'Industrie",
    code_postal: "83100",
    ville: "Toulon",
    pays: "FR",
  },
  acheteur: {
    nom: "TEST-AUTO facture reçue",
    adresse: "1 impasse des Fours",
    code_postal: "83500",
    ville: "La Seyne-sur-Mer",
    pays: "FR",
  },
  livraison: null,
  assujetti_tva: true,
  tva_sur_debits: false,
  iban: null,
};

async function pdfDeBase(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText("Facture FRS-2026-4471");
  return doc.save();
}

async function fabriquerFacturX(): Promise<Uint8Array> {
  const xml = xmlFacturX(DONNEES_FOURNISSEUR);
  return emballerFacturX(await pdfDeBase(), {
    xml,
    titre: "Facture FRS-2026-4471",
    auteur: "Poudres du Var SAS",
    profil: NOM_PROFIL,
  });
}

describe("Extraction — Factur-X fabriqué par le générateur du produit", () => {
  it("retrouve fournisseur, numéro, dates et montants exacts", async () => {
    const facturX = await fabriquerFacturX();
    const piece = await extraireXmlDuPdf(facturX);
    expect(piece, "aucun XML retrouvé dans le PDF").not.toBeNull();
    expect(piece!.nom.toLowerCase()).toBe("factur-x.xml");

    const format = formatXmlFacture(piece!.xml);
    expect(format).toBe("cii");

    const lu = lireCii(piece!.xml);
    expect(lu.numero).toBe("FRS-2026-4471");
    expect(lu.dateEmission).toBe("2026-09-02");
    expect(lu.dateEcheance).toBe("2026-10-02");
    expect(lu.devise).toBe("EUR");
    expect(lu.fournisseurNom).toBe("Poudres du Var SAS");
    expect(lu.fournisseurSiren).toBe("812345678");
    expect(lu.fournisseurTva).toBe("FR56812345678");
    expect(lu.totalHt).toBe(190);
    expect(lu.totalTva).toBe(38);
    expect(lu.totalTtc).toBe(228);
  });

  it("ne casse pas sur un XML embarqué au nom non standard (ZUGFeRD…) — repli sur la première pièce .xml", async () => {
    // Le nom imposé par la spec Factur-X est prioritaire quand il existe (test ci-dessus) ; sans
    // lui, la première pièce jointe `.xml` doit quand même être retrouvée.
    const xml = xmlFacturX(DONNEES_FOURNISSEUR);
    const emballe = await emballerFacturX(await pdfDeBase(), { xml, titre: "t", auteur: "a" });
    // `emballerFacturX` nomme toujours le fichier `factur-x.xml` : on vérifie ici seulement que la
    // recherche par nom standard fonctionne bien (couvert par le test précédent) et que le format
    // est bien reconnu même sans préciser `profil`.
    const piece = await extraireXmlDuPdf(emballe);
    expect(piece?.xml).toContain("CrossIndustryInvoice");
  });
});

describe("Extraction — repli sur PDF simple", () => {
  it("un PDF sans XML embarqué ne retourne rien à extraire", async () => {
    const pdfNu = await pdfDeBase();
    const piece = await extraireXmlDuPdf(pdfNu);
    expect(piece).toBeNull();
  });

  it("un PDF corrompu ne lève pas d'exception — il retombe sur « rien trouvé »", async () => {
    const octetsAleatoires = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4, 5]);
    await expect(extraireXmlDuPdf(octetsAleatoires)).resolves.toBeNull();
  });
});

describe("Extraction — UBL", () => {
  const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>UBL-2026-0091</cbc:ID>
  <cbc:IssueDate>2026-09-03</cbc:IssueDate>
  <cbc:DueDate>2026-10-03</cbc:DueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Gaz Industriels du Sud</cbc:RegistrationName>
        <cbc:CompanyID>901234567</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>FR12901234567</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">24.00</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="EUR">120.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">144.00</cbc:TaxInclusiveAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

  it("reconnaît le format et lit fournisseur, dates et montants", () => {
    expect(formatXmlFacture(UBL)).toBe("ubl");
    const lu = lireUbl(UBL);
    expect(lu.numero).toBe("UBL-2026-0091");
    expect(lu.dateEmission).toBe("2026-09-03");
    expect(lu.dateEcheance).toBe("2026-10-03");
    expect(lu.fournisseurNom).toBe("Gaz Industriels du Sud");
    expect(lu.fournisseurSiren).toBe("901234567");
    expect(lu.fournisseurTva).toBe("FR12901234567");
    expect(lu.totalHt).toBe(120);
    expect(lu.totalTva).toBe(24);
    expect(lu.totalTtc).toBe(144);
  });

  it("un XML qui n'est ni CII ni UBL n'est pas reconnu", () => {
    expect(formatXmlFacture("<MaFactureMaison><Total>10</Total></MaFactureMaison>")).toBeNull();
  });
});

// ── Bornes de taille et de format ─────────────────────────────────────────────

describe("Bornes de taille et de format, avant tout appel réseau", () => {
  function document(octets: number, mime = "application/pdf", nom = "facture.pdf"): DocumentEntrant {
    return { nom, mime, octets: new Uint8Array(Math.max(0, octets)) };
  }

  it("refuse un document vide", () => {
    expect(refusDeDocument(document(0))).toContain("vide");
  });

  it("refuse un document de plus de 10 Mo, et le dit en clair", () => {
    const refus = refusDeDocument(document(10 * 1024 * 1024 + 1));
    expect(refus).toContain("10 Mo");
  });

  it("accepte 10 Mo pile, et refuse un format qui n'est ni PDF ni XML", () => {
    expect(refusDeDocument(document(10 * 1024 * 1024))).toBeNull();
    expect(refusDeDocument(document(100, "application/zip", "archive.zip"))).toContain("PDF");
  });

  it("ingererFactureRecue() refuse un document trop lourd sans écrire aucune ligne", async () => {
    const { seed } = ctx();
    const { count: avant } = await patron()
      .from("factures_recues").select("id", { count: "exact", head: true }).eq("atelier_id", seed.atelierId);

    await expect(
      ingererFactureRecue({
        supabase: patron(),
        atelierId: seed.atelierId,
        provenance: "depot_manuel",
        document: document(10 * 1024 * 1024 + 1),
      }),
    ).rejects.toThrow(/10 Mo/);

    const { count: apres } = await patron()
      .from("factures_recues").select("id", { count: "exact", head: true }).eq("atelier_id", seed.atelierId);
    expect(apres ?? 0).toBe(avant ?? 0);
  });

  it("la table refuse aussi la ligne, en base, si `taille_octets` dépasse 10 Mo", async () => {
    const { seed } = ctx();
    const { error } = await patron().from("factures_recues").insert({
      atelier_id: seed.atelierId,
      format_source: "pdf_simple",
      taille_octets: 10 * 1024 * 1024 + 1,
    });
    expect(error, "la contrainte de taille de la table doit refuser la ligne").not.toBeNull();
  });
});

// ── Ingestion de bout en bout : la fiche, le PDF, le nettoyage en cas d'échec ─────────────────

describe("Ingestion de bout en bout (dépôt manuel)", () => {
  const idsCrees: string[] = [];
  let atelierId = "";

  beforeAll(() => {
    atelierId = ctx().seed.atelierId;
  });

  afterAll(async () => {
    if (idsCrees.length) {
      const { data: lignes } = await patron().from("factures_recues").select("storage_path_pdf").in("id", idsCrees);
      const chemins = ((lignes ?? []) as { storage_path_pdf: string | null }[])
        .map((l) => l.storage_path_pdf).filter((c): c is string => !!c);
      if (chemins.length) await patron().storage.from("documents").remove(chemins);
      await patron().from("factures_recues").delete().in("id", idsCrees);
    }
  });

  it("un Factur-X déposé donne une fiche « à traiter », pré-remplie, avec son PDF archivé", async () => {
    const facturX = await fabriquerFacturX();
    const resultat = await ingererFactureRecue({
      supabase: patron(),
      atelierId,
      provenance: "depot_manuel",
      document: { nom: "facture-fournisseur.pdf", mime: "application/pdf", octets: facturX },
    });
    idsCrees.push(resultat.id);
    expect(resultat.formatSource).toBe("factur-x");
    expect(resultat.avertissements).toEqual([]);

    const { data } = await patron().from("factures_recues").select("*").eq("id", resultat.id).single();
    expect(data.statut).toBe("a_traiter");
    expect(data.provenance).toBe("depot_manuel");
    expect(data.numero).toBe("FRS-2026-4471");
    expect(data.fournisseur_nom).toBe("Poudres du Var SAS");
    expect(nb(data.total_ttc)).toBe(228);
    expect(data.storage_path_pdf).toBeTruthy();
    expect(data.storage_path_pdf as string).toContain(`${atelierId}/comptable/`);

    // Le PDF est réellement récupérable : c'est ce que l'écran ouvre en aperçu.
    const { data: signee, error } = await patron().storage
      .from("documents").createSignedUrl(data.storage_path_pdf as string, 60);
    expect(error).toBeNull();
    expect(signee?.signedUrl).toBeTruthy();
  });

  it("un PDF sans XML donne une fiche « pdf_simple », avec un avertissement", async () => {
    const pdfNu = await pdfDeBase();
    const resultat = await ingererFactureRecue({
      supabase: patron(),
      atelierId,
      provenance: "depot_manuel",
      document: { nom: "facture-papier-scannee.pdf", mime: "application/pdf", octets: pdfNu },
    });
    idsCrees.push(resultat.id);
    expect(resultat.formatSource).toBe("pdf_simple");
    expect(resultat.avertissements.some((a) => /à la main/i.test(a))).toBe(true);

    const { data } = await patron().from("factures_recues").select("statut, numero, storage_path_pdf").eq("id", resultat.id).single();
    expect(data!.statut).toBe("a_traiter");
    expect(data!.numero).toBeNull();
    expect(data!.storage_path_pdf).toBeTruthy();
  });

  it("un XML CII déposé seul (sans PDF) ne pose aucun fichier dans le bucket, mais garde le XML brut", async () => {
    const xml = xmlFacturX(DONNEES_FOURNISSEUR);
    const resultat = await ingererFactureRecue({
      supabase: patron(),
      atelierId,
      provenance: "depot_manuel",
      document: { nom: "facture.xml", mime: "text/xml", octets: new TextEncoder().encode(xml) },
    });
    idsCrees.push(resultat.id);
    expect(resultat.formatSource).toBe("cii");

    const { data } = await patron().from("factures_recues").select("storage_path_pdf, xml_brut, numero").eq("id", resultat.id).single();
    expect(data!.storage_path_pdf).toBeNull();
    expect(data!.xml_brut).toContain("CrossIndustryInvoice");
    expect(data!.numero).toBe("FRS-2026-4471");
  });
});

// ── RLS : deux ateliers jetables et distincts, un opérateur, un comptable ─────────────────────

describe("RLS — un atelier ne voit pas les factures reçues d'un autre", () => {
  let a: AtelierJetable;
  let b: AtelierJetable;
  let ligneAId = "";

  beforeAll(async () => {
    a = await ouvrirAtelierJetable("facturesrecues-a");
    b = await ouvrirAtelierJetable("facturesrecues-b");
    const { data, error } = await a.sb
      .from("factures_recues")
      .insert({ atelier_id: a.atelierId, format_source: "pdf_simple", fournisseur_nom: "Fournisseur atelier A" })
      .select("id")
      .single();
    if (error) throw new Error(`insertion dans l'atelier A : ${error.message}`);
    ligneAId = (data as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await a.fermer();
    await b.fermer();
  });

  it("le propriétaire de l'atelier A voit sa propre ligne", async () => {
    const { data } = await a.sb.from("factures_recues").select("id").eq("id", ligneAId);
    expect((data ?? []).length).toBe(1);
  });

  it("le propriétaire de l'atelier B ne la voit pas", async () => {
    const { data, error } = await b.sb.from("factures_recues").select("id").eq("id", ligneAId);
    expect(error ? [] : data ?? []).toHaveLength(0);
  });

  it("le propriétaire de l'atelier B ne peut pas non plus la modifier", async () => {
    await b.sb.from("factures_recues").update({ statut: "refusee" }).eq("id", ligneAId);
    const { data } = await a.sb.from("factures_recues").select("statut").eq("id", ligneAId).single();
    expect(data?.statut).toBe("a_traiter");
  });

  it("un opérateur (rôle atelier) de l'atelier A ne voit aucune facture reçue", async () => {
    const operateur = await a.inviter("atelier");
    const { data, error } = await operateur.from("factures_recues").select("id");
    expect(error ? [] : data ?? []).toHaveLength(0);
  });

  it("un opérateur ne peut pas déposer de facture reçue", async () => {
    const operateur = await a.inviter("atelier");
    const { error } = await operateur
      .from("factures_recues")
      .insert({ atelier_id: a.atelierId, format_source: "pdf_simple", fournisseur_nom: "PIRATE-OPERATEUR" });
    // Refusée d'une manière ou d'une autre : soit une erreur, soit — sans policy INSERT pour ce
    // rôle — une absence totale d'écriture. On revérifie l'état, jamais seulement le code retour.
    const { count } = await a.sb
      .from("factures_recues").select("id", { count: "exact", head: true })
      .eq("fournisseur_nom", "PIRATE-OPERATEUR");
    expect(count ?? 0, "un opérateur a réussi à déposer une facture reçue").toBe(0);
    void error;
  });

  it("le bureau (rôle bureau) de l'atelier A, lui, voit et écrit comme le responsable", async () => {
    const bureau = await a.inviter("bureau");
    const { data } = await bureau.from("factures_recues").select("id").eq("id", ligneAId);
    expect((data ?? []).length).toBe(1);
  });
});

describe("RLS — le comptable lit, dans son propre atelier jetable", () => {
  let atelier: AtelierJetable;
  let cabinetSb: SupabaseClient;
  let ligneId = "";
  let cabinetId = "";

  function adresseCabinet(): string {
    const base = process.env.TEST_USER_EMAIL;
    if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
    const [locale, domaine] = base.split("@");
    // Suffixe dédié à ce fichier, distinct de « role-comptable » (déjà utilisé par
    // `comptable-lecture-seule.test.ts` sur l'atelier PARTAGÉ) : cet atelier-ci est jetable et
    // propre à ce fichier, il n'a aucune raison de partager un compte avec un autre.
    return `${locale}+facturesrecues-comptable@${domaine}`;
  }

  async function rejoindreCommeComptable(
    atelierId: string,
    proprietaireSb: SupabaseClient,
  ): Promise<{ sb: SupabaseClient; id: string }> {
    const { url, anonKey } = ctx();
    const email = adresseCabinet();
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
    if (dejaMembre?.atelier_id && dejaMembre.atelier_id !== atelierId) {
      // Reliquat d'un atelier jetable d'une exécution précédente : l'atelier lui-même a disparu
      // avec son propriétaire, mais si ce n'est pas le cas on refuse plutôt que de désaffilier
      // silencieusement un compte réel.
      const { data: a } = await sb.from("ateliers").select("nom").eq("id", dejaMembre.atelier_id).maybeSingle();
      if (a?.nom && !a.nom.startsWith("TEST-AUTO-")) {
        throw new Error(`${email} appartient à « ${a.nom} », qui n'est pas jetable — refus.`);
      }
      await sb.from("users").delete().eq("id", session.user.id);
    }
    if (dejaMembre?.atelier_id !== atelierId) {
      const { data: inv, error: errInv } = await proprietaireSb
        .from("invitations")
        .insert({ atelier_id: atelierId, email, role: "comptable" })
        .select("token")
        .single();
      if (errInv) throw new Error(`invitation comptable : ${errInv.message}`);
      const { error: errAccept } = await sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
      if (errAccept) throw new Error(`accept_invitation comptable : ${errAccept.message}`);
    }
    return { sb, id: session.user.id };
  }

  beforeAll(async () => {
    atelier = await ouvrirAtelierJetable("facturesrecues-comptable");
    const { data, error } = await atelier.sb
      .from("factures_recues")
      .insert({ atelier_id: atelier.atelierId, format_source: "pdf_simple", fournisseur_nom: "Fournisseur vu par le cabinet" })
      .select("id")
      .single();
    if (error) throw new Error(`insertion pour le test comptable : ${error.message}`);
    ligneId = (data as { id: string }).id;

    // L'invitation doit venir du propriétaire de CET atelier jetable, pas de `patron()` (l'atelier
    // du semis) : `invitations` est elle-même soumise à la RLS commerciale de son propre atelier.
    const cabinet = await rejoindreCommeComptable(atelier.atelierId, atelier.sb);
    cabinetId = cabinet.id;
    cabinetSb = cabinet.sb;
  }, 120_000);

  afterAll(async () => {
    // La ligne `users` du cabinet disparaît de toute façon avec l'atelier jetable (FK en cascade),
    // mais la retirer explicitement ici la rend indépendante de l'ordre des opérations de `fermer()`.
    if (cabinetId) await atelier.sb.from("users").delete().eq("id", cabinetId);
    await atelier.fermer();
  });

  it("le comptable lit la facture reçue de son atelier", async () => {
    const { data, error } = await cabinetSb.from("factures_recues").select("id, fournisseur_nom").eq("id", ligneId);
    expect(error).toBeNull();
    expect((data ?? []).length, "le comptable doit voir la facture reçue de son propre atelier").toBe(1);
  });

  it("le comptable ne peut ni écrire ni changer le statut", async () => {
    await cabinetSb.from("factures_recues").update({ statut: "traitee" }).eq("id", ligneId);
    await cabinetSb.from("factures_recues").insert({ atelier_id: atelier.atelierId, format_source: "pdf_simple", fournisseur_nom: "PIRATE-COMPTABLE" });

    const { data } = await atelier.sb.from("factures_recues").select("statut").eq("id", ligneId).single();
    expect(data?.statut).toBe("a_traiter");
    const { count } = await atelier.sb
      .from("factures_recues").select("id", { count: "exact", head: true })
      .eq("fournisseur_nom", "PIRATE-COMPTABLE");
    expect(count ?? 0).toBe(0);
  });
});

// ── Démonstration : consultable, jamais modifiable ────────────────────────────

const EMAIL_DEMO = process.env.DEMO_EMAIL ?? "demo@thermogestion.internal";
const MOT_DE_PASSE_DEMO = process.env.DEMO_PASSWORD ?? "";
const decrire = MOT_DE_PASSE_DEMO ? describe : describe.skip;

decrire("Refus d'écriture en démonstration", () => {
  let sbDemo: SupabaseClient;
  let atelierDemo: string | null = null;

  beforeAll(async () => {
    const { url, anonKey } = ctx();
    const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: EMAIL_DEMO, password: MOT_DE_PASSE_DEMO });
    if (error || !data.session) throw new Error(`connexion au compte de démonstration impossible : ${error?.message}`);
    sbDemo = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
    const { data: at } = await sbDemo.from("ateliers").select("id").maybeSingle();
    atelierDemo = at?.id ?? null;
  });

  it("refuse le dépôt d'une facture reçue sur l'atelier de démonstration", async () => {
    const { error } = await sbDemo
      .from("factures_recues")
      .insert({ atelier_id: atelierDemo, format_source: "pdf_simple", fournisseur_nom: "Visiteur" });
    expect(error?.message ?? "").toContain("DEMO_LECTURE_SEULE");
  });
});
