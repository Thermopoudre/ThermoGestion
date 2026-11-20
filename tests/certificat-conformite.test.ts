import { describe, expect, it } from "vitest";
import {
  avertissementsCertificat,
  blocagesCertificat,
  certificationDeReference,
  certificatEmettable,
  controlesRetenus,
  cuissonAttestee,
  dateFinGarantie,
  labelOpposable,
  numeroCertificat,
  statutCertification,
  type ContexteCertificat,
} from "@/lib/certificat";
import type { Controle, ControleType, Fournee, Instrument } from "@/lib/types";

/**
 * Le certificat de conformité est le seul document du logiciel qui engage l'atelier auprès d'un
 * industriel. Ces tests fixent ce qui doit l'empêcher d'être émis : sans eux, la première
 * régression produit un document opposable sur un dossier vide.
 */

const AUJOURDHUI = new Date("2026-08-18T10:00:00");

function controle(type: ControleType, conforme: boolean | null, mesure_at: string, instrument_id: string | null = null): Controle {
  return {
    id: `c-${type}-${mesure_at}`, atelier_id: "a", projet_id: "p", fournee_id: null, type,
    valeurs: {}, conforme, commentaire: null, photo_url: null, instrument_id,
    operateur_id: null, mesure_at, created_at: mesure_at,
    referentiel_id: null, referentiel_nom: "Qualicoat classe 1",
    seuils: { epaisseur_mini_um: 60, epaisseur_maxi_um: null, brillance_tolerance_ub: 10, adherence_classe_max: 1, buchholz_min: 80 },
  };
}

function instrument(id: string, dernier: string | null, periodicite = 12): Instrument {
  return { id, atelier_id: "a", nom: `Sonde ${id}`, type: "sonde_epaisseur", numero_serie: null, dernier_etalonnage: dernier, periodicite_mois: periodicite, actif: true, created_at: "2026-01-01" };
}

/**
 * Date d'étalonnage exprimée **relativement au jour d'exécution**, et non en dur.
 *
 * Pourquoi : `blocagesCertificat()` est la seule fonction de ce module qui ne reçoit pas de date
 * d'ancrage — elle interroge l'horloge réelle à travers `etalonnageInfo()`. Une date écrite en dur
 * donne donc au test une date de péremption : « 2025-09-01 » valait bien 11,5 mois le jour où ce
 * test a été écrit, puis 12 mois révolus deux semaines plus tard, et le test s'est mis à échouer
 * sans qu'une seule ligne de code métier ait bougé. On calcule la date à l'exécution pour que
 * l'écart testé (« bientôt » ou « en retard ») reste celui que l'intitulé annonce.
 */
function ilYaMois(mois: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.floor(mois));
  d.setDate(d.getDate() - Math.round((mois % 1) * 30));
  return d.toISOString().slice(0, 10);
}

const FOURNEE_CUITE: Fournee = {
  id: "f1", atelier_id: "a", numero: "F-20260817-1", date_prevue: "2026-08-17", statut: "terminee",
  poudre_id: "po", temp_consigne: 200, duree_min: 18, temp_relevee: 198, conso_kwh: 18,
  operateur_id: "u1", demarree_at: "2026-08-17T08:00:00Z", terminee_at: "2026-08-17T09:00:00Z",
  note: null, created_at: "2026-08-17T07:00:00Z",
  // Amélioration n°2 (migration 71) : jamais dérogée ici, cette fournée n'a rien à voir avec le
  // blocage de capacité du four.
  derogation_capacite: false, derogation_par: null, derogation_le: null, derogation_ecart_m2: null,
};

const OK: ContexteCertificat = {
  controles: [controle("epaisseur", true, "2026-08-17T11:00:00Z", "i-ok"), controle("adherence", true, "2026-08-17T11:05:00Z")],
  // Étalonné il y a 3 mois pour une périodicité de 12 : franchement dans les clous, quel que soit
  // le jour où la suite tourne.
  instruments: [instrument("i-ok", ilYaMois(3))],
  fournees: [FOURNEE_CUITE],
  lotNumero: "LOT-7016-B",
  certificationExpireLe: "2027-03-31",
  certificationLabel: "Qualicoat",
};

describe("contrôle retenu par type", () => {
  it("le plus récent l'emporte — une retouche recontrôlée doit pouvoir être certifiée", () => {
    const retenus = controlesRetenus([
      controle("epaisseur", false, "2026-08-17T09:00:00Z"),
      controle("epaisseur", true, "2026-08-17T15:00:00Z"),
    ]);
    expect(retenus.get("epaisseur")!.conforme).toBe(true);
    expect(retenus.size).toBe(1);
  });
});

describe("cuisson attestée", () => {
  it("ne retient qu'une fournée terminée ET relevée", () => {
    expect(cuissonAttestee([{ ...FOURNEE_CUITE, statut: "en_cours" }])).toBeNull();
    expect(cuissonAttestee([{ ...FOURNEE_CUITE, temp_relevee: null }])).toBeNull();
    expect(cuissonAttestee([FOURNEE_CUITE])).not.toBeNull();
  });

  it("prend la dernière cuisson en date quand le projet est repassé au four", () => {
    const ancienne: Fournee = { ...FOURNEE_CUITE, id: "f0", numero: "F-20260810-1", terminee_at: "2026-08-10T09:00:00Z" };
    expect(cuissonAttestee([ancienne, FOURNEE_CUITE])!.numero).toBe("F-20260817-1");
  });
});

describe("blocages du certificat", () => {
  it("un dossier complet est émettable", () => {
    expect(blocagesCertificat(OK)).toHaveLength(0);
    expect(certificatEmettable(OK)).toBe(true);
  });

  it("refuse sans mesure d'épaisseur", () => {
    const ctx = { ...OK, controles: [controle("aspect", true, "2026-08-17T11:00:00Z")] };
    expect(blocagesCertificat(ctx).map((b) => b.code)).toContain("sans_epaisseur");
    expect(certificatEmettable(ctx)).toBe(false);
  });

  it("refuse tant qu'un contrôle en vigueur est non conforme", () => {
    const ctx = { ...OK, controles: [...OK.controles, controle("adherence", false, "2026-08-17T16:00:00Z")] };
    expect(blocagesCertificat(ctx).map((b) => b.code)).toContain("controle_non_conforme");
  });

  it("accepte de nouveau après retouche et recontrôle conforme", () => {
    const ctx = {
      ...OK,
      controles: [...OK.controles, controle("adherence", false, "2026-08-17T16:00:00Z"), controle("adherence", true, "2026-08-18T08:00:00Z")],
    };
    expect(certificatEmettable(ctx)).toBe(true);
  });

  it("refuse si aucune cuisson n'est tracée", () => {
    expect(blocagesCertificat({ ...OK, fournees: [] }).map((b) => b.code)).toContain("cuisson_non_tracee");
  });

  it("refuse si l'épaisseur a été mesurée avec un instrument non étalonné", () => {
    const enRetard = { ...OK, instruments: [instrument("i-ok", "2024-01-01")] };
    expect(blocagesCertificat(enRetard).map((b) => b.code)).toContain("instrument_non_etalonne");

    const jamais = { ...OK, instruments: [instrument("i-ok", null)] };
    expect(blocagesCertificat(jamais).map((b) => b.code)).toContain("instrument_non_etalonne");
  });

  it("un instrument bientôt à étalonner ne bloque pas", () => {
    // Dernier étalonnage il y a 11,5 mois, périodicité 12 : échéance dans ~15 jours, donc
    // « à faire bientôt », pas « en retard ».
    const ctx = { ...OK, instruments: [instrument("i-ok", ilYaMois(11.5))] };
    expect(blocagesCertificat(ctx).map((b) => b.code)).not.toContain("instrument_non_etalonne");
  });
});

describe("avertissements — ils informent, ils ne bloquent pas", () => {
  it("signale une certification expirée sans empêcher l'émission", () => {
    const ctx = { ...OK, certificationExpireLe: "2026-01-31" };
    expect(avertissementsCertificat(ctx, AUJOURDHUI).map((a) => a.code)).toContain("certification_expiree");
    expect(certificatEmettable(ctx)).toBe(true);
  });

  it("signale l'absence de lot de poudre", () => {
    expect(avertissementsCertificat({ ...OK, lotNumero: null }, AUJOURDHUI).map((a) => a.code)).toContain("sans_lot");
  });

  it("signale l'absence totale de certification", () => {
    expect(avertissementsCertificat({ ...OK, certificationLabel: null }, AUJOURDHUI).map((a) => a.code)).toContain("sans_certification");
  });
});

describe("label opposable", () => {
  it("n'imprime pas un label expiré", () => {
    expect(labelOpposable("Qualicoat", "2026-01-31", AUJOURDHUI)).toBeNull();
    expect(labelOpposable("Qualicoat", "2027-01-31", AUJOURDHUI)).toBe("Qualicoat");
    expect(labelOpposable("Qualicoat", null, AUJOURDHUI)).toBe("Qualicoat");
    expect(labelOpposable(null, null, AUJOURDHUI)).toBeNull();
  });
});

describe("numéro et garantie", () => {
  it("le numéro dérive du projet et ne change jamais", () => {
    expect(numeroCertificat("PR-2026-0012", "abcd1234-0000")).toBe("CC-PR-2026-0012");
    expect(numeroCertificat(null, "abcd1234-0000")).toBe("CC-ABCD1234");
  });

  it("la fin de garantie se compte en mois depuis la livraison", () => {
    expect(dateFinGarantie("2026-08-18", 24)).toBe("2028-08-18");
    expect(dateFinGarantie("2026-08-18", 0)).toBe("2026-08-18");
    expect(dateFinGarantie(null, 24)).toBeNull();
  });
});

describe("statut d'une certification", () => {
  it("valide, à renouveler, expirée", () => {
    expect(statutCertification("2027-06-30", AUJOURDHUI).statut).toBe("valide");
    expect(statutCertification("2026-10-01", AUJOURDHUI).statut).toBe("bientot"); // 44 jours
    expect(statutCertification("2026-08-17", AUJOURDHUI).statut).toBe("expiree");
    expect(statutCertification(null, AUJOURDHUI).statut).toBe("sans_echeance");
  });

  it("la certification de référence ignore les expirées et les inactives", () => {
    const liste = [
      { label: "Qualicoat", expire_le: "2026-01-01", actif: true },
      { label: "Qualimarine", expire_le: "2027-01-01", actif: false },
      { label: "Qualisteelcoat", expire_le: "2027-06-01", actif: true },
    ];
    expect(certificationDeReference(liste, AUJOURDHUI)!.label).toBe("Qualisteelcoat");
    expect(certificationDeReference(liste.slice(0, 2), AUJOURDHUI)).toBeNull();
  });
});
