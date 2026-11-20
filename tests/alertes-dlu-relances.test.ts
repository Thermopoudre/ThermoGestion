import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REGLAGES_ALERTES_DEFAUT,
  SEUIL_DLU_JOURS_DEFAUT,
  dansNJours,
  etatDlu,
  etatRelance,
  joursAvantDlu,
} from "@/lib/alertes";

/**
 * Le seuil de DLU et la cadence des relances, désormais définis à un seul endroit.
 *
 * Ces tests ne tapent pas la base : ils gardent la règle métier là où six écrans la lisaient
 * chacun de leur côté. Le vrai enjeu est la cohérence — le nombre affiché en orange sur l'écran
 * Stock doit être **le même** que celui qui décide du contenu du courriel du matin, et la date de
 * prochaine relance annoncée sur une fiche doit être **la même** que celle que le cron appliquera.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Fige l'horloge : sans ça, un test de « J−1 » échoue une fois par jour, à minuit. */
function figerLe(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("seuil de DLU — une seule définition", () => {
  it("le défaut applicatif reste aligné sur les soixante jours du métier", () => {
    expect(SEUIL_DLU_JOURS_DEFAUT).toBe(60);
    expect(REGLAGES_ALERTES_DEFAUT.seuil_dlu_jours).toBe(60);
  });

  it("un lot dont la DLU tombe aujourd'hui n'est pas périmé, même à 23 h", () => {
    // Le bug que le calcul « en jours pleins » évite : un lot encore bon jeté un soir de tournée.
    figerLe("2026-08-20T23:30:00+02:00");
    expect(joursAvantDlu("2026-08-20")).toBe(0);
    expect(etatDlu("2026-08-20", 60)).toBe("proche");
  });

  it("distingue périmé, à écouler et sans risque sur le seuil de l'atelier", () => {
    figerLe("2026-08-20T09:00:00+02:00");
    expect(etatDlu("2026-08-01", 60)).toBe("perime");
    expect(etatDlu("2026-10-01", 60)).toBe("proche");
    expect(etatDlu("2026-12-31", 60)).toBe("ok");
    // Un atelier de série qui règle 20 jours ne voit plus le même lot en orange.
    expect(etatDlu("2026-10-01", 20)).toBe("ok");
  });

  it("sans DLU renseignée, il n'y a pas d'alerte — et surtout pas de fausse alerte", () => {
    expect(joursAvantDlu(null)).toBeNull();
    expect(etatDlu(null, 60)).toBeNull();
  });

  it("dansNJours borne la requête serveur sur la même arithmétique", () => {
    figerLe("2026-08-20T09:00:00+02:00");
    expect(dansNJours(0)).toBe("2026-08-20");
    expect(dansNJours(60)).toBe("2026-10-19");
  });
});

describe("relances — ce que la fiche annonce est ce que le cron fera", () => {
  const base = {
    depart: "2026-08-01T08:00:00Z",
    derniere_relance_at: null,
    relance_count: 0,
    relances_actives: true,
    client_relances_actives: true,
    eligible: true,
  };

  it("annonce la prochaine relance et le nombre restant", () => {
    figerLe("2026-08-20T09:00:00+02:00");
    const e = etatRelance({ ...base, depart: "2026-08-19T08:00:00Z" }, 3, REGLAGES_ALERTES_DEFAUT);
    expect(e.relancera).toBe(true);
    if (e.relancera) {
      expect(new Date(e.prochaine).toISOString().slice(0, 10)).toBe("2026-08-22");
      expect(e.restantes).toBe(3);
    }
  });

  it("une échéance déjà dépassée veut dire « au prochain passage du cron », pas une date passée", () => {
    // Annoncer « prochaine relance le 4 août » un 20 août serait au mieux incompréhensible.
    figerLe("2026-08-20T09:00:00+02:00");
    const e = etatRelance(base, 3, REGLAGES_ALERTES_DEFAUT);
    expect(e.relancera).toBe(true);
    if (e.relancera) expect(new Date(e.prochaine).getTime()).toBeGreaterThan(Date.now());
  });

  it("l'interrupteur du client prime sur celui du document", () => {
    const e = etatRelance({ ...base, client_relances_actives: false }, 3, REGLAGES_ALERTES_DEFAUT);
    expect(e.relancera).toBe(false);
    if (!e.relancera) expect(e.motif).toBe("client_coupe");
  });

  it("le document coupé, le plafond atteint et la formule fermée ont chacun leur motif", () => {
    expect(etatRelance({ ...base, relances_actives: false }, 3, REGLAGES_ALERTES_DEFAUT)).toMatchObject({ motif: "document_coupe" });
    expect(etatRelance({ ...base, relance_count: 3 }, 3, REGLAGES_ALERTES_DEFAUT)).toMatchObject({ motif: "plafond" });
    expect(etatRelance(base, 3, REGLAGES_ALERTES_DEFAUT, false)).toMatchObject({ motif: "capacite" });
  });

  it("un document soldé ou à la corbeille n'est plus éligible", () => {
    expect(etatRelance({ ...base, eligible: false }, 5, REGLAGES_ALERTES_DEFAUT)).toMatchObject({ motif: "non_eligible" });
  });

  it("un plafond réglé à zéro coupe toutes les relances de l'atelier", () => {
    // C'est l'interrupteur général proposé dans Réglages → Alertes.
    expect(etatRelance(base, 3, { relance_max: 0 })).toMatchObject({ motif: "plafond" });
  });

  it("la cadence facture (5 j) et la cadence devis (3 j) ne se confondent pas", () => {
    figerLe("2026-08-20T09:00:00+02:00");
    const devis = etatRelance({ ...base, derniere_relance_at: "2026-08-19T08:00:00Z" }, REGLAGES_ALERTES_DEFAUT.relance_devis_jours, REGLAGES_ALERTES_DEFAUT);
    const facture = etatRelance({ ...base, derniere_relance_at: "2026-08-19T08:00:00Z" }, REGLAGES_ALERTES_DEFAUT.relance_facture_jours, REGLAGES_ALERTES_DEFAUT);
    expect(devis.relancera && facture.relancera).toBe(true);
    if (devis.relancera && facture.relancera) {
      expect(new Date(facture.prochaine).getTime()).toBeGreaterThan(new Date(devis.prochaine).getTime());
    }
  });
});
