import { describe, expect, it } from "vitest";
import {
  ajouterJoursOuvres,
  calculerCharge,
  capaciteJournaliereM2,
  dateLivraisonRealiste,
  isoDate,
  MARGE_FINITION_JOURS,
  niveauCharge,
} from "@/lib/capacite";

/**
 * La date de livraison proposée est un engagement commercial : elle finit sur un devis et dans
 * la bouche de l'atelier au téléphone. Elle doit donc être reproductible au jour près et ne
 * jamais être fabriquée à partir de réglages absents.
 */

const FOUR = { four_capacite_m2: 9, four_cycles_jour: 3, four_remplissage_moyen_pct: 75 };
// Mardi 18 août 2026, pour que les additions de jours ouvrés traversent un week-end.
const MARDI = new Date("2026-08-18T09:00:00");

describe("capacité journalière du four", () => {
  it("multiplie capacité × cycles × taux de remplissage", () => {
    expect(capaciteJournaliereM2(FOUR)).toBe(20.25); // 9 × 3 × 0,75
  });

  it("ne rend aucune capacité tant que le four n'est pas paramétré", () => {
    expect(capaciteJournaliereM2({ ...FOUR, four_capacite_m2: null })).toBeNull();
    expect(capaciteJournaliereM2({ ...FOUR, four_capacite_m2: 0 })).toBeNull();
    expect(capaciteJournaliereM2({ ...FOUR, four_cycles_jour: 0 })).toBeNull();
    expect(capaciteJournaliereM2({ ...FOUR, four_remplissage_moyen_pct: 0 })).toBeNull();
  });

  it("le taux de remplissage abat vraiment la capacité", () => {
    expect(capaciteJournaliereM2({ ...FOUR, four_remplissage_moyen_pct: 100 })).toBe(27);
    expect(capaciteJournaliereM2({ ...FOUR, four_remplissage_moyen_pct: 50 })).toBe(13.5);
  });
});

describe("jours ouvrés", () => {
  it("saute le week-end", () => {
    // Vendredi 21/08 + 1 jour ouvré = lundi 24/08.
    expect(isoDate(ajouterJoursOuvres(new Date("2026-08-21T09:00:00"), 1))).toBe("2026-08-24");
    // Mardi 18/08 + 5 jours ouvrés = mardi 25/08.
    expect(isoDate(ajouterJoursOuvres(MARDI, 5))).toBe("2026-08-25");
  });

  it("zéro jour ne bouge pas la date, même un samedi", () => {
    expect(isoDate(ajouterJoursOuvres(new Date("2026-08-22T09:00:00"), 0))).toBe("2026-08-22");
  });
});

describe("charge de l'atelier", () => {
  const projets = [
    { surface_m2: 8.58, status: "en_cours", date_promise: "2026-08-14" }, // en retard
    { surface_m2: 5.4, status: "en_attente", date_promise: "2026-08-28" },
    { surface_m2: 12, status: "livre", date_promise: "2026-08-10" }, // livré : ne pèse plus
    { surface_m2: 3, status: "annule", date_promise: "2026-08-10" }, // annulé : ne pèse plus
    { surface_m2: null, status: "en_cours", date_promise: null }, // sans surface : ne fausse rien
  ];

  it("ne compte que ce qui est encore devant le four", () => {
    const charge = calculerCharge(projets, FOUR, MARDI);
    expect(charge.enCoursM2).toBe(13.98);
    expect(charge.projets).toBe(3);
  });

  it("compte les projets dont la date promise est déjà passée", () => {
    expect(calculerCharge(projets, FOUR, MARDI).enRetard).toBe(1);
  });

  it("exprime la file d'attente en journées de four", () => {
    const charge = calculerCharge(projets, FOUR, MARDI);
    expect(charge.capaciteJourM2).toBe(20.25);
    expect(charge.joursDeCharge).toBe(1); // 13,98 / 20,25 → 1 journée entamée
    expect(charge.tauxChargePct).toBe(69);
  });

  it("sans four paramétré, aucun taux de charge n'est inventé", () => {
    const charge = calculerCharge(projets, { ...FOUR, four_capacite_m2: null }, MARDI);
    expect(charge.enCoursM2).toBe(13.98);
    expect(charge.capaciteJourM2).toBeNull();
    expect(charge.joursDeCharge).toBeNull();
    expect(charge.tauxChargePct).toBeNull();
    expect(niveauCharge(charge.tauxChargePct)).toBeNull();
  });
});

describe("date de livraison réaliste", () => {
  it("additionne la file d'attente et le nouveau chantier avant d'ajouter la marge", () => {
    const charge = calculerCharge([{ surface_m2: 13.98, status: "en_cours" }], FOUR, MARDI);
    // 13,98 + 20 = 33,98 m² → 2 journées de four (20,25 m²/j) + 1 jour de finition = 3 jours ouvrés.
    const p = dateLivraisonRealiste(charge, 20, MARDI)!;
    expect(p.joursOuvres).toBe(3);
    expect(p.date).toBe("2026-08-21"); // mardi + 3 ouvrés = vendredi
  });

  it("un carnet vide et une petite pièce donnent quand même la marge de finition", () => {
    const charge = calculerCharge([], FOUR, MARDI);
    const p = dateLivraisonRealiste(charge, 0.5, MARDI)!;
    expect(p.joursOuvres).toBe(1 + MARGE_FINITION_JOURS);
    expect(p.date).toBe("2026-08-20");
  });

  it("traverse le week-end", () => {
    const charge = calculerCharge([{ surface_m2: 60, status: "en_cours" }], FOUR, MARDI);
    // 60 + 5 = 65 m² → 4 journées de four + 1 = 5 jours ouvrés → mardi 25/08.
    expect(dateLivraisonRealiste(charge, 5, MARDI)!.date).toBe("2026-08-25");
  });

  it("refuse de proposer une date si le four n'est pas paramétré", () => {
    const charge = calculerCharge([{ surface_m2: 10, status: "en_cours" }], { ...FOUR, four_capacite_m2: null }, MARDI);
    expect(dateLivraisonRealiste(charge, 5, MARDI)).toBeNull();
  });

  it("une surface négative ou absurde ne raccourcit jamais le délai", () => {
    const charge = calculerCharge([{ surface_m2: 20, status: "en_cours" }], FOUR, MARDI);
    const normal = dateLivraisonRealiste(charge, 0, MARDI)!;
    const negatif = dateLivraisonRealiste(charge, -50, MARDI)!;
    expect(negatif.joursOuvres).toBe(normal.joursOuvres);
  });
});

describe("niveau de charge", () => {
  it("classe le carnet", () => {
    expect(niveauCharge(60)).toBe("libre");
    expect(niveauCharge(250)).toBe("normal");
    expect(niveauCharge(450)).toBe("tendu");
    expect(niveauCharge(900)).toBe("sature");
  });
});
