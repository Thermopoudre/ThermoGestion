import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import {
  SEUILS_QUALICOAT_CLASSE_1,
  calculerConformite,
  normaliserSeuils,
  resumeSeuils,
  type SeuilsQualite,
} from "@/lib/qualite";
import { attendreLectureFermee } from "./helpers/refus";

/**
 * Seuils de contrôle paramétrables (lot 5, réserve R1).
 *
 * Deux propriétés à tenir, et la seconde est la seule qui compte vraiment :
 *  1. un seuil réglé a un effet immédiat sur le verdict des contrôles suivants ;
 *  2. **un contrôle déjà enregistré n'est jamais réévalué**. Le verdict rendu à une date fait foi.
 *     C'est tout le principe d'un registre d'audit : sans ça, un atelier pourrait rendre conforme
 *     a posteriori une production qui ne l'était pas, en desserrant simplement son barème.
 *
 * La propriété 2 est vérifiée ici depuis l'extérieur — un client PostgREST ordinaire qui tente
 * l'écriture directe — et pas seulement dans l'écran React. C'est le quatrième garde-fou de ce
 * projet à devoir être attaqué pour être crédible.
 */

const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let projetId: string;

const SERRE: SeuilsQualite = {
  epaisseur_mini_um: 100,
  epaisseur_maxi_um: 150,
  brillance_tolerance_ub: 3,
  adherence_classe_max: 0,
  buchholz_min: 90,
};

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  const { data, error } = await sb
    .from("projets")
    .insert({ atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom: "Contrôles — seuils paramétrables", surface_m2: 2 })
    .select("id")
    .single();
  if (error) throw new Error(`projet de test : ${error.message}`);
  projetId = data.id as string;
});

describe("verdict calculé sur les seuils du référentiel", () => {
  it("épaisseur : le même relevé bascule selon le minimum exigé", () => {
    const valeurs = { mini: 55, maxi: 80, moyenne: 68 };
    expect(calculerConformite("epaisseur", valeurs, SEUILS_QUALICOAT_CLASSE_1)).toBe(false);
    expect(calculerConformite("epaisseur", valeurs, { ...SEUILS_QUALICOAT_CLASSE_1, epaisseur_mini_um: 50 })).toBe(true);
  });

  it("épaisseur : la surépaisseur n'est sanctionnée que si le référentiel plafonne", () => {
    const valeurs = { mini: 110, maxi: 220, moyenne: 160 };
    // Qualicoat ne plafonne pas : un point épais ne rend pas la pièce non conforme.
    expect(calculerConformite("epaisseur", valeurs, SEUILS_QUALICOAT_CLASSE_1)).toBe(true);
    expect(calculerConformite("epaisseur", valeurs, SERRE)).toBe(false);
  });

  it("épaisseur : un plafond sans maxi relevé ne peut pas rendre non conforme", () => {
    expect(calculerConformite("epaisseur", { mini: 120, maxi: null, moyenne: null }, SERRE)).toBe(true);
  });

  it("brillance : la tolérance décide", () => {
    const valeurs = { valeur: 66, nominale: 60 };
    expect(calculerConformite("brillance", valeurs, SEUILS_QUALICOAT_CLASSE_1)).toBe(true);
    expect(calculerConformite("brillance", valeurs, SERRE)).toBe(false);
  });

  it("adhérence : la classe 1 passe en Qualicoat, pas sur un marché qui exige la classe 0", () => {
    expect(calculerConformite("adherence", { classe: 1 }, SEUILS_QUALICOAT_CLASSE_1)).toBe(true);
    expect(calculerConformite("adherence", { classe: 1 }, SERRE)).toBe(false);
    expect(calculerConformite("adherence", { classe: 0 }, SERRE)).toBe(true);
  });

  it("Buchholz : le seuil est réglable", () => {
    expect(calculerConformite("buchholz", { valeur: 85 }, SEUILS_QUALICOAT_CLASSE_1)).toBe(true);
    expect(calculerConformite("buchholz", { valeur: 85 }, SERRE)).toBe(false);
  });

  it("aucun verdict tant que la mesure est incomplète", () => {
    expect(calculerConformite("epaisseur", { mini: null }, SERRE)).toBeNull();
    expect(calculerConformite("brillance", { valeur: 60, nominale: null }, SERRE)).toBeNull();
    expect(calculerConformite("adherence", { classe: null }, SERRE)).toBeNull();
  });

  it("les seuils par défaut restent ceux de la classe 1 Qualicoat", () => {
    expect(SEUILS_QUALICOAT_CLASSE_1).toEqual({
      epaisseur_mini_um: 60, epaisseur_maxi_um: null, brillance_tolerance_ub: 10,
      adherence_classe_max: 1, buchholz_min: 80,
    });
    // Sans seuils explicites, le verdict est celui d'avant le lot 5 : aucune régression silencieuse.
    expect(calculerConformite("epaisseur", { mini: 59 })).toBe(false);
    expect(calculerConformite("epaisseur", { mini: 60 })).toBe(true);
  });

  it("normaliserSeuils encaisse les numeric rendus en chaîne par PostgREST, et l'absence de snapshot", () => {
    expect(normaliserSeuils({ epaisseur_mini_um: "80", epaisseur_maxi_um: "160", brillance_tolerance_ub: "5", adherence_classe_max: "0", buchholz_min: "90" }))
      .toEqual({ epaisseur_mini_um: 80, epaisseur_maxi_um: 160, brillance_tolerance_ub: 5, adherence_classe_max: 0, buchholz_min: 90 });
    expect(normaliserSeuils(null)).toEqual(SEUILS_QUALICOAT_CLASSE_1);
    expect(normaliserSeuils({ epaisseur_mini_um: "n'importe quoi" }).epaisseur_mini_um).toBe(60);
  });

  it("le résumé imprimé sur le registre mentionne le plafond seulement s'il existe", () => {
    expect(resumeSeuils(SEUILS_QUALICOAT_CLASSE_1)).toContain("épaisseur ≥ 60 µm");
    expect(resumeSeuils(SEUILS_QUALICOAT_CLASSE_1)).not.toContain("≤ 150 µm");
    expect(resumeSeuils(SERRE)).toContain("et ≤ 150 µm");
  });
});

describe("référentiel par défaut à la création de l'atelier", () => {
  it("un atelier neuf dispose du barème Qualicoat classe 1, sans intervention", async () => {
    const { data } = await sb.from("referentiels_qualite").select("*").eq("par_defaut", true);
    expect(data).toHaveLength(1);
    const r = data![0];
    expect(r.nom).toBe("Qualicoat classe 1");
    expect(nb(r.epaisseur_mini_um)).toBe(60);
    expect(r.epaisseur_maxi_um).toBeNull();
    expect(nb(r.brillance_tolerance_ub)).toBe(10);
    expect(nb(r.adherence_classe_max)).toBe(1);
    expect(nb(r.buchholz_min)).toBe(80);
  });

  it("un seul référentiel peut être par défaut", async () => {
    const { data: cree } = await sb
      .from("referentiels_qualite")
      .insert({ atelier_id: ctx.seed.atelierId, nom: "Concurrent du défaut", par_defaut: true })
      .select("id")
      .maybeSingle();
    expect(cree, "un second référentiel par défaut a été accepté").toBeNull();
  });

  it("un visiteur anonyme ne lit aucun référentiel", async () => {
    attendreLectureFermee(
      await anon.from("referentiels_qualite").select("id"),
      "les référentiels qualité lus par un visiteur anonyme",
    );
  });
});

describe("le barème appliqué est figé sur le contrôle par la base", () => {
  it("le snapshot est posé par la base et ne peut pas être forgé par le client", async () => {
    const { data, error } = await sb
      .from("controles")
      .insert({
        atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "epaisseur",
        valeurs: { mini: 62, maxi: 90, moyenne: 75 }, conforme: true,
        // Un client malveillant prétend avoir appliqué un barème complaisant.
        seuils: { epaisseur_mini_um: 1 }, referentiel_nom: "Barème maison",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(nb(data!.seuils.epaisseur_mini_um), "le snapshot envoyé par le client a été retenu").toBe(60);
    expect(data!.referentiel_nom).toBe("Qualicoat classe 1");
    expect(data!.referentiel_id).not.toBeNull();
  });

  it("un référentiel qui n'appartient pas à l'atelier est refusé", async () => {
    const { error } = await sb.from("controles").insert({
      atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "buchholz",
      valeurs: { valeur: 85 }, conforme: true,
      referentiel_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/REFERENTIEL_INCONNU|foreign key/i);
  });
});

describe("non-rétroactivité : un verdict rendu à une date fait foi", () => {
  it("resserrer le barème ne réévalue aucun contrôle déjà enregistré, mais s'applique aux suivants", async () => {
    const { data: avant, error: errAvant } = await sb
      .from("controles")
      .insert({
        atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "epaisseur",
        valeurs: { mini: 62, maxi: 88, moyenne: 74 }, conforme: true,
      })
      .select("*")
      .single();
    expect(errAvant).toBeNull();
    expect(nb(avant!.seuils.epaisseur_mini_um)).toBe(60);

    // L'atelier passe sur un cahier des charges plus exigeant.
    const { data: ref } = await sb.from("referentiels_qualite").select("id").eq("par_defaut", true).single();
    const { error: errMaj } = await sb
      .from("referentiels_qualite")
      .update({ epaisseur_mini_um: 100, nom: "Qualisteelcoat C4" })
      .eq("id", ref!.id);
    expect(errMaj).toBeNull();

    // Le contrôle d'hier n'a pas bougé : ni son verdict, ni le barème qui l'a rendu.
    const { data: relu } = await sb.from("controles").select("*").eq("id", avant!.id).single();
    expect(relu!.conforme, "un contrôle enregistré a été réévalué").toBe(true);
    expect(nb(relu!.seuils.epaisseur_mini_um)).toBe(60);
    expect(relu!.referentiel_nom).toBe("Qualicoat classe 1");

    // Le même relevé, saisi aujourd'hui, est jugé sur le nouveau barème : le réglage a un effet.
    const seuilsDuJour = normaliserSeuils({ epaisseur_mini_um: 100 });
    expect(calculerConformite("epaisseur", { mini: 62 }, seuilsDuJour)).toBe(false);
    const { data: apres } = await sb
      .from("controles")
      .insert({
        atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "epaisseur",
        valeurs: { mini: 62, maxi: 88, moyenne: 74 }, conforme: false,
      })
      .select("*")
      .single();
    expect(nb(apres!.seuils.epaisseur_mini_um)).toBe(100);
    expect(apres!.referentiel_nom).toBe("Qualisteelcoat C4");
    expect(apres!.conforme).toBe(false);
  });

  it("supprimer le référentiel n'efface pas le barème inscrit sur les contrôles passés", async () => {
    const { data: jetable } = await sb
      .from("referentiels_qualite")
      .insert({ atelier_id: ctx.seed.atelierId, nom: "Barème éphémère", epaisseur_mini_um: 70, buchholz_min: 95 })
      .select("id")
      .single();
    const { data: c } = await sb
      .from("controles")
      .insert({
        atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "buchholz",
        valeurs: { valeur: 96 }, conforme: true, referentiel_id: jetable!.id,
      })
      .select("*")
      .single();
    expect(nb(c!.seuils.buchholz_min)).toBe(95);

    const { error: errSuppr } = await sb.from("referentiels_qualite").delete().eq("id", jetable!.id);
    expect(errSuppr).toBeNull();
    const { data: restant } = await sb.from("referentiels_qualite").select("id").eq("id", jetable!.id);
    expect(restant, "le référentiel n'a pas été supprimé").toHaveLength(0);

    const { data: relu } = await sb.from("controles").select("*").eq("id", c!.id).single();
    expect(relu!.referentiel_id, "la référence doit se dénouer sans supprimer le contrôle").toBeNull();
    expect(relu!.referentiel_nom).toBe("Barème éphémère");
    expect(nb(relu!.seuils.buchholz_min)).toBe(95);
    expect(relu!.conforme).toBe(true);
  });
});

describe("le registre ne se réécrit pas — attaqué depuis un client PostgREST ordinaire", () => {
  let controleId: string;

  beforeAll(async () => {
    const { data } = await sb
      .from("controles")
      .insert({
        atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "adherence",
        valeurs: { classe: 3 }, conforme: false, commentaire: "Quadrillage 2 mm",
      })
      .select("id")
      .single();
    controleId = data!.id as string;
  });

  it.each([
    ["le verdict", { conforme: true }],
    ["les valeurs mesurées", { valeurs: { classe: 0 } }],
    ["le barème appliqué", { seuils: { epaisseur_mini_um: 1, adherence_classe_max: 5 } }],
    ["le nom du référentiel", { referentiel_nom: "Barème complaisant" }],
    ["le type de contrôle", { type: "aspect" }],
    ["la date de mesure", { mesure_at: "2020-01-01T00:00:00Z" }],
    ["le projet visé", { projet_id: null }],
  ])("refuse de modifier %s", async (_libelle, patch) => {
    const { error } = await sb.from("controles").update(patch).eq("id", controleId);
    expect(error, `la modification a été acceptée : ${JSON.stringify(patch)}`).not.toBeNull();
    expect(error!.message).toMatch(/CONTROLE_FIGE/);
  });

  it("refuse de rebrancher le contrôle sur un autre référentiel", async () => {
    const { data: autre } = await sb
      .from("referentiels_qualite")
      .insert({ atelier_id: ctx.seed.atelierId, nom: "Barème de substitution", adherence_classe_max: 5 })
      .select("id")
      .single();
    const patch = { referentiel_id: autre!.id };
    const { error } = await sb.from("controles").update(patch).eq("id", controleId);
    expect(error, `la modification a été acceptée : ${JSON.stringify(patch)}`).not.toBeNull();
    expect(error!.message).toMatch(/CONTROLE_FIGE/);
  });

  it("le contrôle est intact après toutes ces tentatives", async () => {
    const { data } = await sb.from("controles").select("*").eq("id", controleId).single();
    expect(data!.conforme).toBe(false);
    expect(data!.type).toBe("adherence");
    expect(nb(data!.valeurs.classe)).toBe(3);
    expect(data!.projet_id).toBe(projetId);
  });

  it("laisse annoter : commentaire et photo restent modifiables", async () => {
    const { error } = await sb
      .from("controles")
      .update({ commentaire: "Quadrillage 2 mm — retouche programmée", photo_url: "a/controles/x.jpg" })
      .eq("id", controleId);
    expect(error).toBeNull();
    const { data } = await sb.from("controles").select("commentaire, photo_url, conforme").eq("id", controleId).single();
    expect(data!.commentaire).toContain("retouche programmée");
    expect(data!.photo_url).toBe("a/controles/x.jpg");
    expect(data!.conforme).toBe(false);
  });
});
