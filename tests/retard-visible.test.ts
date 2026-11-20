import { describe, expect, it } from "vitest";
import { dateDepassee, factureEchue } from "@/lib/utils";

/**
 * Lot D — D11 : retard invisible.
 *
 * Une facture échue de 45 jours restait en gris comme les autres sur `/factures` et sa fiche ;
 * le portail client affichait « Prévu le 14/08 » en gris le 3 septembre. Le kanban de l'atelier,
 * lui, passait déjà au rouge sur le même retard — c'est la référence que `dateDepassee()` et
 * `factureEchue()` généralisent, pour que `/factures`, la fiche facture et le portail client
 * appliquent tous la même règle.
 */
describe("D11 — dateDepassee", () => {
  const HIER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const DEMAIN = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it("une date prévue dans le passé, sans réalisation, est dépassée", () => {
    expect(dateDepassee(null, HIER)).toBe(true);
  });

  it("une date prévue dans le futur n'est pas dépassée", () => {
    expect(dateDepassee(null, DEMAIN)).toBe(false);
  });

  it("une pièce déjà réalisée (livrée, réglée) n'est jamais « en retard », même après sa date prévue", () => {
    // C'est la garde qui manquait le plus souvent : le kanban lui-même a besoin de savoir qu'une
    // livraison faite en retard n'est plus « en retard », elle est faite.
    expect(dateDepassee(HIER, HIER)).toBe(false);
  });

  it("sans date prévue, rien n'est dépassé", () => {
    expect(dateDepassee(null, null)).toBe(false);
    expect(dateDepassee(null, undefined)).toBe(false);
  });
});

describe("D11 — factureEchue", () => {
  const HIER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const DEMAIN = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it("une facture émise dont l'échéance est passée est échue", () => {
    expect(factureEchue({ status: "emise", due_date: HIER })).toBe(true);
  });

  it("une facture émise dont l'échéance n'est pas encore passée n'est pas échue", () => {
    expect(factureEchue({ status: "emise", due_date: DEMAIN })).toBe(false);
  });

  it("une facture payée n'est jamais échue, même avec une échéance passée", () => {
    expect(factureEchue({ status: "payee", due_date: HIER })).toBe(false);
  });

  it("un brouillon ou une facture annulée n'est jamais échue", () => {
    expect(factureEchue({ status: "brouillon", due_date: HIER })).toBe(false);
    expect(factureEchue({ status: "annulee", due_date: HIER })).toBe(false);
  });

  it("une facture sans échéance n'est pas échue", () => {
    expect(factureEchue({ status: "emise", due_date: null })).toBe(false);
  });
});
