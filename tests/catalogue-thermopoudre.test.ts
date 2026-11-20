import { describe, expect, it } from "vitest";
import {
  codeRal,
  cycleCuisson,
  familleDe,
  kgConditionnement,
  lienReappro,
  referenceAtelier,
  rendement,
  specifications,
  versFiche,
  type ProduitPs,
} from "@/lib/thermopoudre/fiche";

/**
 * Le webservice PrestaShop n'expose aucune caractéristique structurée sur les poudres : tout est
 * dans la description HTML. Ces tests figent la lecture sur des fiches réelles de thermopoudre.fr
 * — c'est la seule protection contre une refonte de gabarit qui viderait silencieusement les
 * imports. Aucun réseau ici : on teste la traduction, pas la boutique.
 */

const URLS = {
  fiche: (id: number) => `https://thermopoudre.fr/index.php?id_product=${id}&controller=product`,
  image: (idImage: unknown, slug: string) => (idImage ? `https://thermopoudre.fr/${idImage}-home_default/${slug}.jpg` : null),
};

/** Extrait réel de la fiche 319 (Noir RAL 9005 Supermat), gabarit « Spécifications » actuel. */
const DESCRIPTION_RAL = `
<h2>Noir RAL 9005 Supermat - Poudre Polyester</h2>
<ul><li>Cure standard : 180-200 °C pendant 10-15 min</li>
<li>Couvrance moyenne : 8-12 m²/kg selon épaisseur</li></ul>
<h3>Spécifications</h3><table><tbody>
<tr><td style="font-weight:600;">Référence</td><td>PE10AT9005100CMX</td></tr>
<tr><td>Type</td><td>Polyester</td></tr>
<tr><td>Finition</td><td>Mat</td></tr>
<tr><td>Code couleur</td><td>RAL 9005</td></tr>
<tr><td>Coloris</td><td>Noir</td></tr>
<tr><td>Conditionnement</td><td>1 kg</td></tr>
<tr><td>Origine</td><td>Iba KIMYA (Turquie)</td></tr>
</tbody></table>`;

const PRODUIT_RAL: ProduitPs = {
  id: 319,
  reference: "PE10AT9005100CMX",
  price: "14.730000",
  manufacturer_name: "ThermoPoudre",
  id_default_image: "1201",
  link_rewrite: [{ id: "1", value: "noir-ral-9005-supermat" }],
  name: [{ id: "1", value: "Thermopoudre - Noir RAL 9005 Supermat - Poudre Polyester| Thermolaquage" }],
  description: [{ id: "1", value: DESCRIPTION_RAL }],
  associations: { categories: [{ id: "21" }, { id: "24" }, { id: "36" }] },
};

/** Fiche 2244 : teinte d'origine constructeur pour jantes, sans référence ni prix de base. */
const PRODUIT_OEM: ProduitPs = {
  id: 2244,
  price: "0.000000",
  name: [{ id: "1", value: "RIMCO - ASTON MARTIN RRS S06 Aston Martin Platinum matt" }],
  description: [{
    id: "1",
    value: `<p>Cuisson 150 °C pendant 15 min.</p><table><tbody>
      <tr><td>Code RIMCO</td><td>RRS S06</td></tr>
      <tr><td>OEM</td><td>ASTON MARTIN</td></tr>
      <tr><td>Conditionnement</td><td>0,5 L / 1 L / 5 L</td></tr>
      <tr><td>Type</td><td>Peinture liquide solvantée</td></tr>
      </tbody></table>`,
  }],
  associations: { categories: [{ id: "449" }, { id: "451" }, { id: "463" }] },
};

describe("lecture d'une fiche du catalogue Thermopoudre", () => {
  it("lit le tableau de spécifications", () => {
    const s = specifications(DESCRIPTION_RAL);
    expect(s["Référence"]).toBe("PE10AT9005100CMX");
    expect(s["Code couleur"]).toBe("RAL 9005");
    expect(s["Conditionnement"]).toBe("1 kg");
  });

  it("retient un cycle de cuisson réellement polymérisant : borne basse en °C, borne haute en minutes", () => {
    expect(cycleCuisson("Cure standard : 180-200 °C pendant 10-15 min")).toEqual({ temp: 180, duree: 15 });
    expect(cycleCuisson("Cuisson 200 °C pendant 12 min")).toEqual({ temp: 200, duree: 12 });
    expect(cycleCuisson("Aucune indication de cuisson")).toEqual({ temp: null, duree: null });
  });

  it("retient le rendement le plus prudent : sous-estimer fait commander assez de poudre", () => {
    expect(rendement("Couvrance moyenne : 8-12 m²/kg selon épaisseur")).toBe(8);
    expect(rendement("Rendement 10 m²/kg")).toBe(10);
    expect(rendement("pas de rendement annoncé")).toBeNull();
  });

  it("reconnaît le RAL dans la spécification comme dans le nom commercial", () => {
    expect(codeRal("RAL 9005")).toBe("9005");
    expect(codeRal("Thermopoudre - Noir RAL 7016 texturé")).toBe("7016");
    expect(codeRal("Gris Gun Metal")).toBeNull();
  });

  it("ne convertit un prix en €/kg que si le conditionnement est en kilos", () => {
    expect(kgConditionnement("1 kg")).toBe(1);
    expect(kgConditionnement("20 kg")).toBe(20);
    expect(kgConditionnement("0,5 L / 1 L / 5 L")).toBeNull();
  });

  it("traduit une poudre RAL en fiche importable", () => {
    const f = versFiche(PRODUIT_RAL, URLS)!;
    expect(f).toMatchObject({
      tp_product_id: 319,
      famille: "poudre",
      reference: "PE10AT9005100CMX",
      marque: "ThermoPoudre",
      ral: "9005",
      coloris: "Noir",
      finition: "mat",
      type: "polyester",
      temp_cuisson: 180,
      duree_cuisson_min: 15,
      rendement_m2_kg: 8,
      prix_kg: 14.73,
      conditionnement: "1 kg",
    });
    expect(f.url).toContain("id_product=319");
    expect(f.image).toContain("1201-home_default");
    // C'est la teinte que l'opérateur cherche des yeux, pas la référence fabricant.
    expect(referenceAtelier(f)).toBe("RAL 9005 Noir mat");
  });

  it("traduit une teinte d'origine constructeur sans inventer de prix", () => {
    const f = versFiche(PRODUIT_OEM, URLS)!;
    expect(f.famille).toBe("jante_oem");
    expect(f.constructeur).toBe("ASTON MARTIN");
    expect(f.marque).toBe("RIMCO");
    expect(f.reference).toBe("RRS S06");
    expect(f.type).toBe("liquide-solvante");
    expect(f.temp_cuisson).toBe(150);
    // Prix porté par la déclinaison : mieux vaut rien afficher qu'un prix faux.
    expect(f.prix_kg).toBeNull();
    expect(f.ral).toBeNull();
    expect(referenceAtelier(f)).toBe("ASTON MARTIN");
  });

  it("écarte un produit qui n'est ni une poudre ni une teinte jante", () => {
    const sticker: ProduitPs = { id: 2990, reference: "STICKER", associations: { categories: [{ id: "2" }, { id: "628" }] } };
    expect(familleDe(sticker)).toBeNull();
    expect(versFiche(sticker, URLS)).toBeNull();
  });

  it("déduit la finition de la catégorie quand la fiche ne la donne pas", () => {
    const sansSpec: ProduitPs = {
      ...PRODUIT_RAL,
      description: [{ id: "1", value: "<p>Poudre époxy polyester, cuisson 180 °C pendant 15 min.</p>" }],
      associations: { categories: [{ id: "36" }, { id: "38" }, { id: "40" }] },
    };
    const f = versFiche(sansSpec, URLS)!;
    expect(f.finition).toBe("metallise");
    expect(f.conditionnement).toBeNull();
    // Sans conditionnement annoncé, le prix de la fiche est pris pour un prix au kilo.
    expect(f.prix_kg).toBe(14.73);
  });
});

describe("réapprovisionnement", () => {
  it("renvoie sur la fiche exacte quand la poudre vient du catalogue", () => {
    expect(lienReappro({ tp_product_id: 319, ral: "9005", reference: "RAL 9005 Noir mat" })).toContain("id_product=319");
  });

  it("retombe sur une recherche quand la poudre a été saisie à la main", () => {
    const lien = lienReappro({ tp_product_id: null, ral: "7016", reference: "Ma poudre" });
    expect(lien).toContain("controller=search");
    expect(lien).toContain("RAL%207016");
  });
});
