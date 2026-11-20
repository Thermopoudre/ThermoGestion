import { beforeEach, describe, expect, it } from "vitest";
import {
  compterEnAttente,
  enfiler,
  estErreurReseau,
  listerEnAttente,
  rejouer,
  retirer,
  vider,
  type ActionEnFile,
} from "@/lib/offline/queue";

/**
 * Lot C, C4 — file d'attente hors ligne du pointage (/scan).
 *
 * Ce test tourne sous Vitest (environnement Node, pas de `indexedDB`) : le module bascule donc
 * automatiquement sur son repli mémoire. C'est voulu — ça permet de tester toute la logique
 * observable (ordre FIFO, rejeu, arrêt au premier échec réseau) sans dépendance à un navigateur ou
 * à une librairie IndexedDB simulée, et ce repli est le même code que celui utilisé en SSR.
 */
describe("file d'attente hors ligne du pointage", () => {
  beforeEach(async () => {
    await vider();
  });

  it("est vide au départ", async () => {
    expect(await compterEnAttente()).toBe(0);
    expect(await listerEnAttente()).toEqual([]);
  });

  it("enfile une action et la retrouve avec un id et un horodatage de création", async () => {
    const entree = await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    expect(entree.id).toBeTruthy();
    expect(entree.cree_a).toBeTruthy();
    expect(entree.projet_id).toBe("p1");
    // L'horodatage du geste (`survenu_a`) doit être celui capturé au clic, jamais recalculé ici.
    expect(entree.survenu_a).toBe("2026-09-04T08:00:00.000Z");

    expect(await compterEnAttente()).toBe(1);
  });

  it("conserve l'ordre FIFO — un demarrer_etape doit rester avant l'avancer_etape du même projet", async () => {
    await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    // Deux gestes distincts, dans l'ordre où l'opérateur les a faits.
    await enfiler({ type: "avancer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:05:00.000Z" });
    await enfiler({ type: "demarrer_etape", projet_id: "p2", survenu_a: "2026-09-04T08:06:00.000Z" });

    const file = await listerEnAttente();
    expect(file.map((a) => `${a.type}:${a.projet_id}`)).toEqual([
      "demarrer_etape:p1",
      "avancer_etape:p1",
      "demarrer_etape:p2",
    ]);
  });

  it("retire une action précise sans toucher aux autres", async () => {
    const a = await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    const b = await enfiler({ type: "demarrer_etape", projet_id: "p2", survenu_a: "2026-09-04T08:01:00.000Z" });

    await retirer(a.id);

    const file = await listerEnAttente();
    expect(file).toHaveLength(1);
    expect(file[0].id).toBe(b.id);
  });

  it("rejoue toute la file quand le rejoueur accepte chaque action, dans l'ordre", async () => {
    await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    await enfiler({ type: "avancer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:05:00.000Z" });

    const ordreRejoue: string[] = [];
    const resultat = await rejouer(async (action: ActionEnFile) => {
      ordreRejoue.push(action.type);
      return true;
    });

    expect(ordreRejoue).toEqual(["demarrer_etape", "avancer_etape"]);
    expect(resultat).toEqual({ ok: 2, restantes: 0 });
    expect(await compterEnAttente()).toBe(0);
  });

  it("s'arrête à la première action refusée et laisse le reste de la file intact, dans l'ordre", async () => {
    await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    await enfiler({ type: "avancer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:05:00.000Z" });
    await enfiler({ type: "demarrer_etape", projet_id: "p2", survenu_a: "2026-09-04T08:06:00.000Z" });

    let appels = 0;
    const resultat = await rejouer(async () => {
      appels += 1;
      // La toute première action (le demarrer_etape de p1) échoue encore : on ne doit JAMAIS
      // tenter l'avancer_etape de p1 avant que son démarrage soit passé, sous peine de faire
      // échouer le chronométrage serveur sans que personne ne le voie.
      return false;
    });

    expect(appels).toBe(1);
    expect(resultat).toEqual({ ok: 0, restantes: 3 });

    const file = await listerEnAttente();
    expect(file.map((a) => `${a.type}:${a.projet_id}`)).toEqual([
      "demarrer_etape:p1",
      "avancer_etape:p1",
      "demarrer_etape:p2",
    ]);
  });

  it("reprend au bon endroit quand une action intermédiaire échoue après des succès", async () => {
    await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    await enfiler({ type: "demarrer_etape", projet_id: "p2", survenu_a: "2026-09-04T08:01:00.000Z" });
    await enfiler({ type: "demarrer_etape", projet_id: "p3", survenu_a: "2026-09-04T08:02:00.000Z" });

    const resultat = await rejouer(async (action) => action.projet_id !== "p2");

    // p1 acceptée et retirée, p2 refusée : on s'arrête là, p2 et p3 restent en file dans l'ordre.
    expect(resultat).toEqual({ ok: 1, restantes: 2 });
    const file = await listerEnAttente();
    expect(file.map((a) => a.projet_id)).toEqual(["p2", "p3"]);
  });

  it("vide complètement la file", async () => {
    await enfiler({ type: "demarrer_etape", projet_id: "p1", survenu_a: "2026-09-04T08:00:00.000Z" });
    await enfiler({ type: "demarrer_etape", projet_id: "p2", survenu_a: "2026-09-04T08:01:00.000Z" });
    await vider();
    expect(await compterEnAttente()).toBe(0);
  });
});

describe("détection d'une erreur réseau (vs. erreur métier)", () => {
  it("reconnaît les messages typiques d'un fetch qui n'a pas pu joindre le serveur", () => {
    expect(estErreurReseau({ message: "Failed to fetch" })).toBe(true);
    expect(estErreurReseau({ message: "NetworkError when attempting to fetch resource." })).toBe(true);
    expect(estErreurReseau({ message: "fetch failed" })).toBe(true);
    expect(estErreurReseau({ message: "Erreur réseau" })).toBe(true);
  });

  it("ne classe pas une erreur métier (RLS, contrainte…) comme une erreur réseau", () => {
    expect(estErreurReseau({ message: "new row violates row-level security policy" })).toBe(false);
    expect(estErreurReseau({ message: "Étape déjà validée" })).toBe(false);
  });

  it("n'échoue pas sur une absence d'erreur", () => {
    expect(estErreurReseau(null)).toBe(false);
    expect(estErreurReseau(undefined)).toBe(false);
  });
});
