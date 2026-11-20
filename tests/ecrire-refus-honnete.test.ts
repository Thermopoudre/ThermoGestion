import { describe, expect, it, vi } from "vitest";
import { ecrire } from "@/lib/db";

/**
 * Lot D — D8 : refus déguisé en succès.
 *
 * L'import du catalogue Thermopoudre sur `/stock` (`CatalogueThermopoudre.importer`) attendait
 * bien l'écriture Supabase, mais appelait `toast(errorFr(error))` **sans préciser le type** — et
 * `useToast()` retombe sur `"success"` par défaut (voir `components/Toast.tsx`). Un refus de
 * démonstration s'affichait donc dans l'infobulle grise avec l'icône ✓, exactement comme une
 * vraie réussite : l'atelier croyait sa poudre importée alors que rien n'avait été écrit.
 *
 * `ecrire()` (lib/db.ts) est le chemin du produit qui ne peut pas se tromper sur ce point : il
 * pousse toujours `type: "error"` sur un échec, et n'appelle jamais le toast de succès dans ce
 * cas. `CatalogueThermopoudre.importer` est passé par cette fonction pour cette raison précise
 * (voir le commentaire D8 dans le composant).
 */
describe("D8 — ecrire() ne peut pas afficher un refus comme une réussite", () => {
  it("pousse le message avec le type « error » sur un échec, jamais le type par défaut", async () => {
    const toast = vi.fn();
    const requete = Promise.resolve({ error: { message: "DEMO_LECTURE_SEULE" } });
    const ok = await ecrire(requete, toast as unknown as (m: string, t?: "success" | "error") => void);
    expect(ok).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
    // C'est précisément ce second argument qui manquait dans `CatalogueThermopoudre` avant
    // correction : sans lui, le toast affiche l'icône ✓ de succès sur un message de refus.
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/vous visitez la démonstration/i), "error");
  });

  it("n'appelle jamais le message de succès sur un échec", async () => {
    const toast = vi.fn();
    const requete = Promise.resolve({ error: { message: "une erreur quelconque" } });
    await ecrire(requete, toast as unknown as (m: string, t?: "success" | "error") => void, "Fiche poudre importée dans votre stock");
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalledWith("Fiche poudre importée dans votre stock");
  });

  it("pousse le message de succès demandé, sans type explicite, seulement quand l'écriture réussit", async () => {
    const toast = vi.fn();
    const requete = Promise.resolve({ error: null });
    const ok = await ecrire(requete, toast as unknown as (m: string, t?: "success" | "error") => void, "Fiche poudre importée dans votre stock");
    expect(ok).toBe(true);
    expect(toast).toHaveBeenCalledWith("Fiche poudre importée dans votre stock");
  });
});
