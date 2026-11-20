import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { creerDevis, finaliserDevis, ligneLibre } from "./helpers/devis";
import { DevisDocument } from "@/lib/pdf/document";
import type { Atelier, Client, Devis } from "@/lib/types";

/**
 * Lot C, C6 — mentions B2C (médiateur de la consommation, rétractation de 14 jours hors
 * établissement). Ce fichier prouve le CÂBLAGE base → page publique : que `client.type` et les
 * coordonnées du médiateur atteignent bien `devis_public`, et que `signature_hors_etablissement`
 * est fidèlement posée par `signer_devis`. Le texte imprimé lui-même (PDF, page publique) est une
 * question de rédaction juridique hors périmètre Vitest — voir la réserve dans le rapport de fin
 * de chantier : à faire relire avant mise en production réelle avec des clients particuliers.
 *
 * Défaut n°3 (recette navigateur, vague 3) — cette réserve avait un angle mort : le câblage
 * ci-dessous prouvait que `signature_hors_etablissement` atteint fidèlement la base et la page
 * publique, mais aucun test ne vérifiait que la mention de rétractation était vraiment IMPRIMÉE.
 * Elle était posée derrière ce booléen, qui vaut `false` par défaut et que la quasi-totalité des
 * devis signés en pratique ne coche jamais (case à cocher facultative à la signature) : la mention
 * ne sortait donc jamais, sur aucun PDF. Le bloc `contientTexte` / `DevisDocument` plus bas comble
 * cet angle mort sans re-largir le périmètre à un rendu PDF complet (`renderToBuffer`) : il
 * inspecte l'arbre d'éléments React que `DevisDocument(...)` renvoie, AVANT tout rendu en PDF —
 * `pdf-polices.test.ts` documente déjà pourquoi le fichier PDF rendu, lui, n'est pas cherchable
 * (flux compressés, glyphes d'un sous-ensemble de police).
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let clientParticulierId: string;
let clientProId: string;
let mediateurAvant: { nom: string | null; adresse: string | null };

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);

  const { data: atelierAvant } = await sb.from("ateliers").select("mediateur_nom, mediateur_adresse").eq("id", ctx.seed.atelierId).single();
  mediateurAvant = { nom: atelierAvant!.mediateur_nom, adresse: atelierAvant!.mediateur_adresse };

  const { data: part, error: e1 } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "particulier", nom: "Monsieur Client C6" })
    .select("id")
    .single();
  if (e1) throw new Error(`client particulier C6 : ${e1.message}`);
  clientParticulierId = part!.id as string;

  const { data: pro, error: e2 } = await sb
    .from("clients")
    .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: "Menuiserie C6" })
    .select("id")
    .single();
  if (e2) throw new Error(`client pro C6 : ${e2.message}`);
  clientProId = pro!.id as string;
});

afterAll(async () => {
  // Remet le médiateur dans l'état où ce fichier l'a trouvé : d'autres tests du même atelier
  // jetable pourraient lire ateliers.* et ne doivent pas hériter d'une valeur posée ici.
  await sb.from("ateliers").update({ mediateur_nom: mediateurAvant.nom, mediateur_adresse: mediateurAvant.adresse }).eq("id", ctx.seed.atelierId);
});

describe("C6 — utilitaire client_est_particulier", () => {
  it("vrai seulement pour 'particulier'", async () => {
    const cas: [string | null, boolean][] = [["particulier", true], ["pro", false], [null, false], ["", false]];
    for (const [type, attendu] of cas) {
      const { data, error } = await sb.rpc("client_est_particulier", { p_type: type });
      expect(error).toBeNull();
      expect(data).toBe(attendu);
    }
  });
});

describe("C6 — le médiateur de la consommation atteint la page publique", () => {
  it("vide par défaut : rien à afficher tant que l'atelier ne l'a pas saisi", async () => {
    await sb.from("ateliers").update({ mediateur_nom: null, mediateur_adresse: null }).eq("id", ctx.seed.atelierId);
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: clientParticulierId, items: [ligneLibre({ libelle: "Portillon", qte: 1, pu: 200 })] });
    const envoye = await finaliserDevis(sb, devis.id);
    const { data: pub } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    const atelier = (pub as { atelier: { mediateur_nom: string | null; mediateur_adresse: string | null } }).atelier;
    expect(atelier.mediateur_nom).toBeNull();
    expect(atelier.mediateur_adresse).toBeNull();
  });

  it("une fois saisi dans Réglages → Atelier, il ressort sur la page publique du devis", async () => {
    await sb.from("ateliers").update({
      mediateur_nom: "Médiateur Test de la Consommation", mediateur_adresse: "12 rue du Médiateur, 75000 Paris",
    }).eq("id", ctx.seed.atelierId);

    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: clientParticulierId, items: [ligneLibre({ libelle: "Portillon", qte: 1, pu: 200 })] });
    const envoye = await finaliserDevis(sb, devis.id);
    const { data: pub } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    const atelier = (pub as { atelier: { mediateur_nom: string; mediateur_adresse: string } }).atelier;
    expect(atelier.mediateur_nom).toBe("Médiateur Test de la Consommation");
    expect(atelier.mediateur_adresse).toBe("12 rue du Médiateur, 75000 Paris");
  });
});

describe("C6 — rétractation : le type de client et le lieu de signature atteignent la page publique", () => {
  it("un devis signé EN établissement ne porte pas la mention hors établissement", async () => {
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: clientParticulierId, items: [ligneLibre({ libelle: "Grille", qte: 1, pu: 150 })] });
    const envoye = await finaliserDevis(sb, devis.id);
    const { error } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Client en boutique", p_signature: {}, p_ip: null,
      p_hors_etablissement: false,
    });
    expect(error).toBeNull();
    const { data: pub } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect((pub as { signature_hors_etablissement: boolean }).signature_hors_etablissement).toBe(false);
    expect((pub as { client: { type: string } }).client.type).toBe("particulier");
  });

  it("un particulier qui signe HORS établissement porte la mention — c'est elle qui déclenche le rappel des 14 jours", async () => {
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: clientParticulierId, items: [ligneLibre({ libelle: "Portail", qte: 1, pu: 400 })] });
    const envoye = await finaliserDevis(sb, devis.id);
    const { error } = await anon.rpc("signer_devis", {
      p_token: envoye.public_token, p_nom: "Client à domicile", p_signature: {}, p_ip: null,
      p_hors_etablissement: true,
    });
    expect(error).toBeNull();

    const { data: signe } = await sb.from("devis").select("signature_hors_etablissement").eq("id", devis.id).single();
    expect(signe!.signature_hors_etablissement).toBe(true);

    const { data: pub } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect((pub as { signature_hors_etablissement: boolean }).signature_hors_etablissement).toBe(true);
    expect((pub as { client: { type: string } }).client.type).toBe("particulier");
  });

  it("un client PRO signant hors établissement reste marqué comme tel — c'est à l'écran de ne pas afficher le rappel, pas à la base de le cacher", async () => {
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: clientProId, items: [ligneLibre({ libelle: "Charpente", qte: 1, pu: 800 })] });
    const envoye = await finaliserDevis(sb, devis.id);
    await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Pro sur site", p_signature: {}, p_ip: null, p_hors_etablissement: true });
    const { data: pub } = await anon.rpc("devis_public", { p_token: envoye.public_token });
    expect((pub as { client: { type: string } }).client.type).toBe("pro");
    expect((pub as { signature_hors_etablissement: boolean }).signature_hors_etablissement).toBe(true);
  });

  it("par défaut (paramètre omis), la signature n'est pas marquée hors établissement", async () => {
    const devis = await creerDevis(sb, { atelierId: ctx.seed.atelierId, clientId: clientParticulierId, items: [ligneLibre({ libelle: "Rambarde", qte: 1, pu: 90 })] });
    const envoye = await finaliserDevis(sb, devis.id);
    const { error } = await anon.rpc("signer_devis", { p_token: envoye.public_token, p_nom: "Défaut", p_signature: {}, p_ip: null });
    expect(error).toBeNull();
    const { data: signe } = await sb.from("devis").select("signature_hors_etablissement").eq("id", devis.id).single();
    expect(signe!.signature_hors_etablissement).toBe(false);
  });
});

/**
 * Descend l'arbre d'éléments React que produit `DevisDocument(...)` — react-pdf, mais ce sont
 * encore de simples éléments React tant qu'on ne les a pas fait passer par `renderToBuffer` — à la
 * recherche d'une chaîne. Contrairement au PDF rendu, cet arbre n'est ni compressé ni encodé sur
 * des glyphes : une chaîne de `children` s'y trouve telle quelle.
 */
function contientTexte(noeud: unknown, cible: string): boolean {
  if (typeof noeud === "string") return noeud.includes(cible);
  if (Array.isArray(noeud)) return noeud.some((n) => contientTexte(n, cible));
  if (isValidElement(noeud)) return contientTexte((noeud.props as { children?: ReactNode }).children, cible);
  return false;
}

const atelierPdf = {
  id: "a", nom: "ThermoTest", adresse: "12 avenue des Ateliers", code_postal: "83150", ville: "Bandol",
  siren: "900123456", siret: "90012345600018", assujetti_tva: true, tva_sur_debits: false,
  forme_juridique: "SARL", capital_social: 10000, rcs_ville: "Toulon", rm_numero: null,
  delai_paiement_jours: 30, penalites_taux: 10.5, escompte_texte: null,
  assurance_nom: null, assurance_contrat: null, assurance_zone: null,
  // Médiateur renseigné : ce test porte sur la rétractation, pas sur le message « non renseigné »
  // déjà couvert plus haut dans ce fichier.
  mediateur_nom: "Médiateur Test de la Consommation", mediateur_adresse: "12 rue du Médiateur, 75000 Paris",
  couleur: "#147085", logo_url: null,
} as unknown as Atelier;

function clientPdf(type: "particulier" | "pro"): Client {
  return {
    id: "c", type, nom: type === "particulier" ? "Monsieur Client PDF" : "Menuiserie PDF",
    adresse: "3 rue de l'Étang", code_postal: "13400", ville: "Aubagne", siren: null,
    adresse_livraison: null, delai_paiement_jours: null,
  } as unknown as Client;
}

function devisPdf(signatureHorsEtablissement: boolean): Devis {
  return {
    id: "d", numero: "DV-2026-0099", created_at: "2026-08-18T09:00:00.000Z",
    validite_jours: 30, total_ht: 200, total_tva: 40, total_ttc: 240, remise: null, notes: null,
    signed_at: null, signed_by: null, signature_hors_etablissement: signatureHorsEtablissement,
    items: [{ libelle: "Portillon", qte: 1, unite: "piece", pu_ht: 200, total_ht: 200, type: "prestation" }],
  } as unknown as Devis;
}

describe("C6 — la mention de rétractation est effectivement imprimée sur le devis PDF", () => {
  it("un particulier dont la signature n'est PAS marquée hors établissement voit quand même le rappel, formulé au conditionnel", () => {
    const arbre = DevisDocument({ devis: devisPdf(false), client: clientPdf("particulier"), atelier: atelierPdf, logo: null });
    expect(contientTexte(arbre, "Si ce devis a été signé hors de l")).toBe(true);
    expect(contientTexte(arbre, "délai de")).toBe(true);
    expect(contientTexte(arbre, "14 jours")).toBe(true);
    expect(contientTexte(arbre, "L221-18")).toBe(true);
  });

  it("un particulier dont la signature EST marquée hors établissement voit le rappel ferme, pas le conditionnel", () => {
    const arbre = DevisDocument({ devis: devisPdf(true), client: clientPdf("particulier"), atelier: atelierPdf, logo: null });
    expect(contientTexte(arbre, "Ce devis a été signé hors établissement")).toBe(true);
    expect(contientTexte(arbre, "Si ce devis a été signé hors de l")).toBe(false);
  });

  it("un client pro ne voit ni le médiateur ni la rétractation : mentions réservées au B2C (art. L616-1 / L221-18)", () => {
    const arbre = DevisDocument({ devis: devisPdf(true), client: clientPdf("pro"), atelier: atelierPdf, logo: null });
    expect(contientTexte(arbre, "rétractation")).toBe(false);
    expect(contientTexte(arbre, "Médiateur de la consommation")).toBe(false);
  });
});
