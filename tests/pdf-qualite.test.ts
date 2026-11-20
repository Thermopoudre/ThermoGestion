import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { CertificatDocument, FicheCuissonDocument, ecartTemperature } from "@/lib/pdf/qualite";
import type { CertificatProps, FicheCuissonProps } from "@/lib/pdf/qualite";
import type { Atelier, Certification, Controle, Fournee } from "@/lib/types";

/**
 * Certificat de conformité et fiche de cuisson : les deux documents du lot 2 qui sortent de
 * l'atelier. Le certificat part chez un donneur d'ordre industriel — il doit se rendre à
 * l'identique partout, donc obéir à la même règle d'incorporation des polices que la facture
 * (PDF/A interdit les 14 polices standard, dont le programme n'est pas dans le fichier).
 */

const atelier = {
  id: "a",
  nom: "ThermoTest",
  adresse: "12 quai du Port",
  code_postal: "83150",
  ville: "Bandol",
  siren: "900123456",
  siret: "90012345600018",
  forme_juridique: "SARL",
  logo_url: null,
  garantie_mois: 24,
  four_capacite_m2: 9,
} as unknown as Atelier & { garantie_mois: number; four_capacite_m2: number | null };

const certification: Certification = {
  id: "cert", atelier_id: "a", label: "Qualicoat", organisme: "AFNOR Certification", numero: "QC-1187",
  obtenue_le: "2024-03-01", expire_le: "2027-02-28", document_url: null, note: null, actif: true, created_at: "2024-03-01",
};

const fournee = {
  id: "f1", atelier_id: "a", numero: "F-20260817-1", date_prevue: "2026-08-17", statut: "terminee",
  poudre_id: "po", temp_consigne: 200, duree_min: 18, temp_relevee: 198, conso_kwh: 18.5,
  operateur_id: "u1", demarree_at: "2026-08-17T08:00:00Z", terminee_at: "2026-08-17T09:00:00Z",
  note: "Four à moitié chargé.", created_at: "2026-08-17T07:00:00Z",
  poudres: { reference: "RAL 7016 texturé", ral: "7016" },
  users: { nom: "Karim B." },
} as unknown as Fournee & { users: { nom: string } };

// Accents, ligature, µ, °, ² et € : ce qui manquerait à un sous-ensemble de police bâclé.
const controles = [
  {
    id: "c1", atelier_id: "a", projet_id: "p", fournee_id: "f1", type: "epaisseur",
    valeurs: { mini: 68, maxi: 88, moyenne: 78 }, conforme: true,
    commentaire: "Mesure en 5 points — œuvre à 200 °C", photo_url: null, instrument_id: "i1",
    operateur_id: "u1", mesure_at: "2026-08-17T11:00:00Z", created_at: "2026-08-17T11:00:00Z",
    users: { nom: "Karim B." },
  },
  {
    id: "c2", atelier_id: "a", projet_id: "p", fournee_id: "f1", type: "adherence",
    valeurs: { classe: 0 }, conforme: true, commentaire: null, photo_url: null, instrument_id: null,
    operateur_id: "u1", mesure_at: "2026-08-17T11:05:00Z", created_at: "2026-08-17T11:05:00Z",
    users: { nom: "Karim B." },
  },
] as unknown as Controle[];

const props: CertificatProps = {
  projet: {
    id: "p", numero: "PR-2026-0022", nom: "Jantes BMW 19 pouces — Gris Argent 354",
    surface_m2: 1.68, couches: 1, teinte_origine: "Gris Argent BMW 354",
    date_reception: "2026-08-10", date_livraison: "2026-08-18",
    clients: { nom: "Garage Piston & Fils" },
    poudres: { marque: "TestPowder", reference: "Gris Argent BMW 354", ral: "9006", finition: "satiné", type: "polyester", epaisseur_um_min: 60, epaisseur_um_max: 120 },
    poudre_lots: { numero: "LOT-7016-B", fournisseur: "Thermopoudre", dlu: "2027-01-31" },
  },
  atelier,
  controles,
  fournees: [fournee],
  certification,
  label: "Qualicoat",
  logo: null,
  emisLe: new Date("2026-08-18T10:00:00Z"),
};

const propsCuisson: FicheCuissonProps = {
  fournee,
  lignes: [
    { surface_m2: 1.68, projets: { numero: "PR-2026-0022", nom: "Jantes BMW 19 pouces", couches: 1, clients: { nom: "Garage Piston & Fils" }, poudre_lots: { numero: "LOT-7016-B" } } },
    { surface_m2: 5.4, projets: { numero: "PR-2026-0023", nom: "Mobilier de jardin", couches: 2, clients: { nom: "Métallerie du Sud" }, poudre_lots: null } },
  ],
  atelier,
  logo: null,
};

async function texteDuPdf(document: Parameters<typeof renderToBuffer>[0]) {
  return Buffer.from(await renderToBuffer(document)).toString("latin1");
}

async function nbPages(document: Parameters<typeof renderToBuffer>[0]) {
  const { PDFDocument } = await import("pdf-lib");
  return (await PDFDocument.load(await renderToBuffer(document))).getPageCount();
}

describe("certificat de conformité — fichier produit", () => {
  // Le texte des pages est dans des flux compressés et encodé sur les glyphes du sous-ensemble de
  // police : il n'est pas cherchable dans les octets du fichier. On vérifie donc la structure et
  // les polices, comme le fait déjà `pdf-polices.test.ts` pour la facture.
  it("se rend sans erreur et produit un PDF complet", async () => {
    const pdf = await texteDuPdf(CertificatDocument(props));
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf.length).toBeGreaterThan(10_000);
  });

  it("n'utilise aucune des 14 polices standard, interdites par PDF/A", async () => {
    const pdf = await texteDuPdf(CertificatDocument(props));
    for (const interdite of ["/Helvetica", "/Times-Roman", "/Courier", "/Symbol", "/ZapfDingbats"]) {
      expect(pdf, `police interdite ${interdite} dans le certificat`).not.toContain(interdite);
    }
    expect(pdf.match(/\/FontFile2/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pdf).toContain("LiberationSans");
  });

  it("se rend aussi sans label, sans lot et sans opérateur — le dossier minimal reste imprimable", async () => {
    const minimal: CertificatProps = {
      ...props,
      label: null,
      certification: null,
      projet: { ...props.projet, poudre_lots: null, date_livraison: null, teinte_origine: null, surface_m2: null },
      fournees: [{ ...fournee, users: null } as unknown as Fournee],
    };
    const pdf = await texteDuPdf(CertificatDocument(minimal));
    expect(pdf.startsWith("%PDF-")).toBe(true);
  });

  // L'atelier joint le certificat au bon de livraison et le donneur d'ordre le classe : une
  // attestation ou une signature reléguée sur une seconde page est un défaut, pas un détail.
  it("tient sur une seule page avec les six types de contrôle", async () => {
    const tousControles = ["epaisseur", "brillance", "adherence", "buchholz", "polymerisation", "aspect"].map((type, i) => ({
      id: `c${i}`, atelier_id: "a", projet_id: "p", fournee_id: "f1", type,
      valeurs: type === "epaisseur" ? { mini: 68, maxi: 88, moyenne: 78 } : type === "brillance" ? { valeur: 88, nominale: 85 } : type === "adherence" ? { classe: 0 } : type === "buchholz" ? { valeur: 96 } : type === "polymerisation" ? { resultat: "conforme" } : { conforme: true, defaut: null },
      conforme: true, commentaire: null, photo_url: null, instrument_id: null, operateur_id: "u1",
      mesure_at: `2026-08-17T11:0${i}:00Z`, created_at: `2026-08-17T11:0${i}:00Z`, users: { nom: "Karim B." },
    })) as unknown as Controle[];
    expect(await nbPages(CertificatDocument({ ...props, controles: tousControles }))).toBe(1);
  });

  it("un projet sans numéro produit quand même un document", async () => {
    const sansNumero: CertificatProps = { ...props, projet: { ...props.projet, numero: null } };
    const pdf = await texteDuPdf(CertificatDocument(sansNumero));
    expect(pdf.startsWith("%PDF-")).toBe(true);
  });
});

describe("fiche de cuisson — fichier produit", () => {
  it("se rend sans erreur et produit un PDF complet", async () => {
    const pdf = await texteDuPdf(FicheCuissonDocument(propsCuisson));
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("respecte la même règle de polices", async () => {
    const pdf = await texteDuPdf(FicheCuissonDocument(propsCuisson));
    expect(pdf).not.toContain("/Helvetica");
    expect(pdf).toContain("/FontFile2");
  });

  it("supporte une fournée vide et un relevé incomplet", async () => {
    const pdf = await texteDuPdf(
      FicheCuissonDocument({ ...propsCuisson, lignes: [], fournee: { ...fournee, temp_relevee: null, conso_kwh: null, note: null } as unknown as typeof fournee }),
    );
    expect(pdf.startsWith("%PDF-")).toBe(true);
  });

  /**
   * Coût énergétique (lot 2, point 3 resté ouvert : la fiche affichait des kWh sans jamais dire
   * ce qu'ils valaient). Le texte d'un PDF n'est pas cherchable dans les octets du fichier — il
   * est encodé sur les glyphes d'un sous-ensemble de police. On vérifie donc ce qui est
   * vérifiable ici : les deux variantes se rendent et tiennent sur une page. Le calcul lui-même
   * est couvert au centime près par `tests/rentabilite-energie-pesee.test.ts`.
   */
  it("se rend avec le coût énergétique quand le prix du kWh est renseigné, sur une seule page", async () => {
    const avecPrix = { ...propsCuisson, atelier: { ...atelier, prix_kwh: 0.19 } as typeof atelier & { prix_kwh: number } };
    const pdf = await texteDuPdf(FicheCuissonDocument(avecPrix));
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(await nbPages(FicheCuissonDocument(avecPrix))).toBe(1);
  });

  it("se rend aussi sans prix du kWh — la fiche dit alors quoi renseigner au lieu d'inventer un euro", async () => {
    // L'atelier de référence de ce fichier n'a volontairement pas de `prix_kwh` : c'est cette
    // variante-là que testent tous les autres cas ci-dessus.
    expect(await nbPages(FicheCuissonDocument(propsCuisson))).toBe(1);
  });
});

describe("écart de température", () => {
  it("se calcule sur le relevé moins la consigne, et reste indéfini si l'un manque", () => {
    expect(ecartTemperature(200, 198)).toBe(-2);
    expect(ecartTemperature(180, 182)).toBe(2);
    expect(ecartTemperature(200, null)).toBeNull();
    expect(ecartTemperature(null, 198)).toBeNull();
  });
});
