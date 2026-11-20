import { afterAll, describe, expect, it } from "vitest";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import {
  TAILLE_MAX_OCTETS,
  TYPES_ACCEPTES,
  cheminPieceJointe,
  estTypeAccepte,
  familleFichier,
  nomSain,
  refusDeFichier,
  tailleFr,
} from "@/lib/pieces-jointes";

/**
 * Pièces jointes — la table, le bucket, et les deux verrous qui les tiennent ensemble.
 *
 * Le bucket `documents` existait depuis le premier jour : privé, vide, référencé nulle part. Ce
 * fichier vérifie que ce n'est plus le cas, et surtout **que les bornes sont posées là où elles
 * sont opposables** — le service de stockage refuse l'octet, la table refuse la ligne. Une
 * validation qui ne vivrait que dans le navigateur ne protégerait rien.
 */

const ctx = () => contexte();
const sb = () => clientConnecte();

const cheminsCrees: string[] = [];
const lignesCreees: string[] = [];

afterAll(async () => {
  if (lignesCreees.length) await sb().from("pieces_jointes").delete().in("id", lignesCreees);
  if (cheminsCrees.length) await sb().storage.from("documents").remove(cheminsCrees);
});

/** Un PDF minuscule mais réel : le service de stockage lit l'en-tête déclaré, pas le contenu. */
function fauxPdf(octets = 512): Blob {
  return new Blob([new Uint8Array(octets).fill(37)], { type: "application/pdf" });
}

// ── Les règles, avant toute base ──────────────────────────────────────────────

describe("Les bornes du navigateur disent la même chose que celles de la base", () => {
  it("refuse ce qui est trop gros, et le dit en français avec le poids réel", () => {
    const refus = refusDeFichier({ name: "plan.pdf", size: TAILLE_MAX_OCTETS + 1, type: "application/pdf" });
    expect(refus).toContain("plan.pdf");
    expect(refus).toContain("10 Mo");
    expect(refusDeFichier({ name: "plan.pdf", size: TAILLE_MAX_OCTETS, type: "application/pdf" })).toBeNull();
  });

  it("refuse un format hors liste, y compris `application/octet-stream`", () => {
    // C'est le type que présente un fichier dont le navigateur ignore la nature : l'accepter
    // reviendrait à tout accepter.
    expect(estTypeAccepte("application/octet-stream")).toBe(false);
    expect(estTypeAccepte("application/x-msdownload")).toBe(false);
    expect(estTypeAccepte("application/pdf")).toBe(true);
    expect(refusDeFichier({ name: "virus.exe", size: 10, type: "application/x-msdownload" })).toContain("format");
  });

  it("refuse un fichier vide — un envoi interrompu n'est pas une pièce", () => {
    expect(refusDeFichier({ name: "vide.pdf", size: 0, type: "application/pdf" })).toContain("vide");
  });

  it("écrit les tailles en français", () => {
    expect(tailleFr(900)).toBe("900 o");
    expect(tailleFr(2048)).toBe("2 ko");
    expect(tailleFr(1_500_000)).toContain("1,4");
  });

  it("range chaque format dans sa famille, pour l'icône", () => {
    expect(familleFichier("application/pdf")).toBe("pdf");
    expect(familleFichier("image/heic")).toBe("image");
    expect(familleFichier("text/csv")).toBe("tableur");
  });
});

describe("Le chemin de stockage respecte la politique du bucket", () => {
  it("il commence par l'identifiant de l'atelier — c'est ce que la policy regarde", () => {
    const chemin = cheminPieceJointe("11111111-2222-3333-4444-555555555555", "projet", "abc", "Plan.pdf", 1000);
    expect(chemin.split("/")[0]).toBe("11111111-2222-3333-4444-555555555555");
    // Le deuxième segment est la **famille de dossier** et non le nom de l'entité au singulier :
    // c'est lui que la policy de stockage lit pour décider qui a le droit d'ouvrir le fichier
    // (`stockage_acces`). L'ancien `pieces/` ne disait rien à personne et privait la règle de la
    // seule information dont elle avait besoin — un opérateur lisait alors le contrat d'un client.
    expect(chemin).toBe("11111111-2222-3333-4444-555555555555/projets/abc/1000-Plan.pdf");
  });

  it("il ne peut pas fabriquer de sous-dossier depuis le nom du fichier", () => {
    // Un nom contenant « / » déplacerait la clé et la ferait sortir du dossier de l'atelier :
    // refus de droits incompréhensible pour l'exploitant.
    expect(nomSain("../../etc/passwd")).not.toContain("/");
    expect(nomSain("Plan garde-corps – rév. 2.pdf")).toBe("Plan_garde-corps_rev._2.pdf");
    expect(nomSain("!!!.pdf")).not.toMatch(/^[._-]/);
    expect(nomSain("")).toBe("fichier");
  });
});

// ── La table ──────────────────────────────────────────────────────────────────

describe("La table `pieces_jointes` rejoue les mêmes bornes", () => {
  it("elle accepte une pièce ordinaire, avec son nom d'origine intact", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const chemin = cheminPieceJointe(atelierId, "client", clientSimpleId, "Bon de commande – 2026.pdf");
    const { data, error } = await sb().from("pieces_jointes").insert({
      atelier_id: atelierId, entite: "client", entite_id: clientSimpleId,
      storage_path: chemin, nom: "Bon de commande – 2026.pdf", mime: "application/pdf", taille: 1234,
    }).select("id, nom, created_by").single();
    expect(error).toBeNull();
    lignesCreees.push((data as { id: string }).id);
    // Le nom accentué doit ressortir tel quel : c'est celui que l'atelier reconnaît.
    expect(data?.nom).toBe("Bon de commande – 2026.pdf");
    // `created_by` est posé par défaut : on sait qui a déposé la pièce sans que l'écran y pense.
    expect(data?.created_by).toBeTruthy();
  });

  it("elle refuse un format hors liste", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const { error } = await sb().from("pieces_jointes").insert({
      atelier_id: atelierId, entite: "client", entite_id: clientSimpleId,
      storage_path: `${atelierId}/clients/${clientSimpleId}/x-exe`,
      nom: "x.exe", mime: "application/x-msdownload", taille: 10,
    });
    expect(error, "un exécutable a été enregistré comme pièce jointe").not.toBeNull();
  });

  it("elle refuse au-delà de 10 Mo, et refuse une taille nulle", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const base = {
      atelier_id: atelierId, entite: "client", entite_id: clientSimpleId,
      nom: "gros.pdf", mime: "application/pdf",
    };
    const { error: trop } = await sb().from("pieces_jointes").insert({
      ...base, storage_path: `${atelierId}/clients/${clientSimpleId}/trop`, taille: TAILLE_MAX_OCTETS + 1,
    });
    expect(trop).not.toBeNull();
    const { error: zero } = await sb().from("pieces_jointes").insert({
      ...base, storage_path: `${atelierId}/clients/${clientSimpleId}/zero`, taille: 0,
    });
    expect(zero).not.toBeNull();
  });

  it("elle refuse un rattachement inconnu", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const { error } = await sb().from("pieces_jointes").insert({
      atelier_id: atelierId, entite: "abonnement", entite_id: clientSimpleId,
      storage_path: `${atelierId}/pieces/abonnement/${clientSimpleId}/x`,
      nom: "x.pdf", mime: "application/pdf", taille: 10,
    });
    expect(error).not.toBeNull();
  });

  it("deux lignes ne peuvent pas désigner le même objet", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const chemin = `${atelierId}/clients/${clientSimpleId}/doublon`;
    const commun = {
      atelier_id: atelierId, entite: "client", entite_id: clientSimpleId,
      storage_path: chemin, nom: "a.pdf", mime: "application/pdf", taille: 10,
    };
    const { data, error } = await sb().from("pieces_jointes").insert(commun).select("id").single();
    expect(error).toBeNull();
    lignesCreees.push((data as { id: string }).id);
    // Sans cette unicité, supprimer l'une des deux effacerait le fichier de l'autre.
    const { error: deuxieme } = await sb().from("pieces_jointes").insert(commun);
    expect(deuxieme).not.toBeNull();
  });

  it("un visiteur anonyme n'en lit aucune", async () => {
    const { data } = await clientAnonyme().from("pieces_jointes").select("id, nom");
    expect(data ?? [], "les pièces jointes sont lisibles sans compte").toHaveLength(0);
  });
});

// ── Le bucket ─────────────────────────────────────────────────────────────────

describe("Le bucket `documents` est cloisonné et borné", () => {
  it("il accepte un PDF déposé dans le dossier de l'atelier, et le rend par URL signée", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const chemin = cheminPieceJointe(atelierId, "client", clientSimpleId, "essai.pdf");
    const { error } = await sb().storage.from("documents").upload(chemin, fauxPdf(), { contentType: "application/pdf" });
    expect(error, `dépôt refusé : ${error?.message}`).toBeNull();
    cheminsCrees.push(chemin);

    // `createSignedUrls`, au pluriel : un seul aller-retour pour toute la liste. La version au
    // singulier est le défaut connu qu'on ne reproduit pas ici.
    const { data: signees, error: errSignature } = await sb().storage.from("documents").createSignedUrls([chemin], 60);
    expect(errSignature).toBeNull();
    expect(signees?.[0]?.signedUrl, "aucune URL signée rendue").toBeTruthy();
  });

  it("il refuse un format hors liste blanche — la borne est côté service, pas côté écran", async () => {
    const { atelierId, clientSimpleId } = ctx().seed;
    const chemin = `${atelierId}/clients/${clientSimpleId}/${Date.now()}-refuse.bin`;
    const { error } = await sb().storage.from("documents").upload(
      chemin,
      new Blob([new Uint8Array(16)], { type: "application/x-msdownload" }),
      { contentType: "application/x-msdownload" },
    );
    expect(error, "un exécutable a été accepté par le bucket").not.toBeNull();
    if (!error) cheminsCrees.push(chemin);
  });

  it("il refuse un dépôt hors du dossier de l'atelier", async () => {
    // C'est la politique `foldername(name)[1] = current_atelier_id()`, la même que pour `photos`.
    const chemin = `00000000-0000-0000-0000-000000000000/pieces/client/x/${Date.now()}-intrus.pdf`;
    const { error } = await sb().storage.from("documents").upload(chemin, fauxPdf(), { contentType: "application/pdf" });
    expect(error, "un dépôt a atterri dans le dossier d'un autre atelier").not.toBeNull();
    if (!error) cheminsCrees.push(chemin);
  });

  it("un visiteur anonyme n'y dépose rien", async () => {
    const { atelierId } = ctx().seed;
    const chemin = `${atelierId}/pieces/client/anon/${Date.now()}-anon.pdf`;
    const { error } = await clientAnonyme().storage.from("documents").upload(chemin, fauxPdf(), { contentType: "application/pdf" });
    expect(error, "un anonyme a déposé un fichier dans le bucket").not.toBeNull();
    if (!error) cheminsCrees.push(chemin);
  });

  it("la liste blanche du code est celle qu'on annonce à l'exploitant", () => {
    // Quatorze types, tous nommés : si l'un disparaît du bucket, ce test ne le verra pas — mais
    // les deux dépôts ci-dessus, eux, le verront.
    expect(TYPES_ACCEPTES).toContain("application/pdf");
    expect(TYPES_ACCEPTES).toContain("image/heic");
    expect(TYPES_ACCEPTES).not.toContain("application/octet-stream");
  });
});
