import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { DevisDocument, FactureDocument } from "@/lib/pdf/document";
import { POLICE } from "@/lib/pdf/polices";
import type { Atelier, Client, Devis, Facture } from "@/lib/types";

/**
 * Incorporation des polices — condition de la conformité PDF/A-3.
 *
 * PDF/A interdit les 14 polices standard du format : leur programme n'est pas dans le fichier,
 * donc le document ne se rend pas de la même façon partout. Tant que le PDF s'appuyait sur
 * Helvetica, veraPDF échouait sur la seule règle ISO 19005-3 clause 6.2.11.4.1.
 *
 * Le verdict de conformité vient d'un outil externe (veraPDF 1.30.2, cf. RECETTE-LOT4.md) ;
 * ce test garde la condition que cet outil vérifiait, pour qu'une retouche de style ne fasse pas
 * repasser un `fontFamily: "Helvetica"` sans que personne ne s'en aperçoive.
 */

const atelier = {
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

const client = {
  id: "c",
  nom: "Menuiserie Aluval",
  adresse: "3 rue de l'Étang",
  code_postal: "13400",
  ville: "Aubagne",
  siren: "812345678",
  adresse_livraison: null,
  delai_paiement_jours: null,
} as unknown as Client;

/** Accents, ligature, symboles monétaires et unités : ce qui manquerait à un sous-ensemble bâclé. */
const LIBELLE_ACCENTUE = "Thermolaquage portail — RAL 7016 satiné · 80 µm · œuvre à 200 °C · 45 €/m²";

const facture = {
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
  items: [{ libelle: LIBELLE_ACCENTUE, qte: 4.2, unite: "m2", pu_ht: 31.2, total_ht: 131.04, type: "m2" }],
} as unknown as Facture;

const devis = {
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
  items: [{ libelle: LIBELLE_ACCENTUE, qte: 4.2, unite: "m2", pu_ht: 31.2, total_ht: 131.04, type: "prestation" }],
} as unknown as Devis;

async function texteDuPdf(document: Parameters<typeof renderToBuffer>[0]) {
  return Buffer.from(await renderToBuffer(document)).toString("latin1");
}

describe("polices incorporées dans les PDF", () => {
  it("n'utilise aucune des 14 polices standard, interdites par PDF/A", async () => {
    const pdf = await texteDuPdf(FactureDocument({ facture, client, atelier, logo: null }));
    for (const interdite of ["/Helvetica", "/Times-Roman", "/Courier", "/Symbol", "/ZapfDingbats"]) {
      expect(pdf).not.toContain(interdite);
    }
  });

  it("embarque le programme de chaque police réellement employée", async () => {
    const pdf = await texteDuPdf(FactureDocument({ facture, client, atelier, logo: null }));
    // Une facture emploie le romain et le gras : les deux programmes doivent être dans le fichier.
    expect(pdf.match(/\/FontFile2/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pdf).toContain("LiberationSans");
    expect(pdf).toContain("LiberationSans-Bold");
  });

  it("applique la même règle au devis, qui part aussi chez le client", async () => {
    const pdf = await texteDuPdf(DevisDocument({ devis, client, atelier, logo: null }));
    expect(pdf).not.toContain("/Helvetica");
    expect(pdf).toContain("/FontFile2");
  });

  it("expose un nom de famille unique, pour qu'aucun style ne retombe sur le défaut", () => {
    expect(POLICE).toBe("Liberation Sans");
  });
});
