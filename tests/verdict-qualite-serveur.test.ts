import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import {
  TYPES_CONTROLE,
  calculerConformite,
  labelExigeEpaisseur,
  normaliserSeuils,
  typesControleActifs,
} from "@/lib/qualite";
import { avertissementsCertificat, blocagesCertificat, typesNonAttestes } from "@/lib/certificat";
import type { Controle, ControleType } from "@/lib/types";

/**
 * Le verdict qualité est rendu par la base (R1), et un contrôle ne s'efface pas (R2).
 *
 * C'est le test de sécurité du lot 6, et il attaque là où le lot 5 n'avait pas regardé : le lot 5
 * avait prouvé qu'un contrôle **enregistré** ne se modifie plus, jamais qu'un contrôle **faux à la
 * naissance** était refusé. Un `INSERT` PostgREST portant `conforme = true` sur une épaisseur de
 * 10 µm était accepté, figé sous un barème annonçant 60 µm, puis imprimé « Conforme » sur le
 * certificat de conformité — le document opposable du produit.
 *
 * Tout se joue depuis un client PostgREST ordinaire : aucun de ces appels ne passe par un écran.
 */
const ctx = contexte();
let sb: SupabaseClient;
let anon: SupabaseClient;
let projetId: string;
let referentielId: string;

/** Contrôle inséré directement en base, comme le ferait un appel API à la main. */
async function inserer(type: ControleType, valeurs: Record<string, unknown>, conformePretendu: boolean | null) {
  return sb
    .from("controles")
    .insert({
      atelier_id: ctx.seed.atelierId, projet_id: projetId, type, valeurs,
      conforme: conformePretendu, referentiel_id: referentielId,
    })
    .select("*")
    .single();
}

async function typesDuReferentiel(types: ControleType[]) {
  const { error } = await sb.from("referentiels_qualite").update({ types_controle: types }).eq("id", referentielId);
  expect(error, `réglage des types de contrôle refusé : ${error?.message}`).toBeNull();
}

beforeAll(async () => {
  sb = clientConnecte(ctx);
  anon = clientAnonyme(ctx);
  const { data, error } = await sb
    .from("projets")
    .insert({ atelier_id: ctx.seed.atelierId, client_id: ctx.seed.clientSimpleId, nom: "Verdict recalculé côté serveur", surface_m2: 2 })
    .select("id")
    .single();
  if (error) throw new Error(`projet de test : ${error.message}`);
  projetId = data!.id as string;

  // Référentiel dédié : les fichiers partagent le même atelier et `seuils-qualite` resserre le
  // barème par défaut en cours de route. Un test de verdict ne peut pas dépendre de cet ordre.
  const { data: ref, error: errRef } = await sb
    .from("referentiels_qualite")
    .insert({
      atelier_id: ctx.seed.atelierId, nom: "Lot 6 — verdict serveur",
      epaisseur_mini_um: 60, epaisseur_maxi_um: null,
      brillance_tolerance_ub: 10, adherence_classe_max: 1, buchholz_min: 80,
    })
    .select("id")
    .single();
  if (errRef) throw new Error(`référentiel de test : ${errRef.message}`);
  referentielId = ref!.id as string;
  await typesDuReferentiel([...TYPES_CONTROLE]);
});

describe("R1 — le verdict envoyé par le client est ignoré", () => {
  it("10 µm déclarés « conformes » sous un barème à 60 µm ressortent non conformes", async () => {
    const { data, error } = await inserer("epaisseur", { mini: "10", maxi: "20", moyenne: "15" }, true);
    expect(error).toBeNull();
    expect(nb(data!.seuils.epaisseur_mini_um)).toBe(60);
    expect(data!.conforme, "le « conforme » du client a été retenu tel quel").toBe(false);
  });

  it("le mensonge inverse est refusé aussi : un relevé conforme ne se déclare pas non conforme", async () => {
    // Un atelier n'a pas plus le droit de noircir sa production que de l'embellir : le registre
    // doit refléter la mesure, pas l'humeur du jour.
    const { data } = await inserer("epaisseur", { mini: 82, maxi: 110, moyenne: 95 }, false);
    expect(data!.conforme).toBe(true);
  });

  it("la base et le navigateur rendent le même verdict, type par type", async () => {
    const cas: { type: ControleType; valeurs: Record<string, unknown>; mensonge: boolean }[] = [
      { type: "adherence", valeurs: { classe: 4 }, mensonge: true },
      { type: "adherence", valeurs: { classe: 0 }, mensonge: false },
      { type: "buchholz", valeurs: { valeur: "72" }, mensonge: true },
      { type: "buchholz", valeurs: { valeur: "88" }, mensonge: false },
      { type: "brillance", valeurs: { valeur: 30, nominale: 60 }, mensonge: true },
      { type: "brillance", valeurs: { valeur: 63, nominale: 60 }, mensonge: false },
      { type: "polymerisation", valeurs: { resultat: "non_conforme" }, mensonge: true },
      { type: "polymerisation", valeurs: { resultat: "conforme" }, mensonge: false },
      { type: "aspect", valeurs: { conforme: false, defaut: "Coulure" }, mensonge: true },
      { type: "aspect", valeurs: { conforme: true, defaut: null }, mensonge: false },
    ];
    for (const c of cas) {
      const { data, error } = await inserer(c.type, c.valeurs, c.mensonge);
      expect(error, `${c.type} refusé : ${error?.message}`).toBeNull();
      const attendu = calculerConformite(c.type, c.valeurs, normaliserSeuils(data!.seuils));
      expect(data!.conforme, `${c.type} ${JSON.stringify(c.valeurs)}`).toBe(attendu);
      expect(data!.conforme).toBe(!c.mensonge);
    }
  });

  it("une mesure incomplète ne devient pas conforme parce que le client l'affirme", async () => {
    const { data } = await inserer("epaisseur", { mini: null, maxi: null, moyenne: null }, true);
    expect(data!.conforme, "un contrôle sans mesure a reçu un verdict").toBeNull();
    const { data: b } = await inserer("brillance", { valeur: 60, nominale: null }, true);
    expect(b!.conforme).toBeNull();
  });

  it("les valeurs arrivent en chaîne depuis le navigateur et sont jugées comme des nombres", async () => {
    // `{ mini: "9" }` ne doit surtout pas être comparé alphabétiquement à 60.
    const { data } = await inserer("epaisseur", { mini: "9", maxi: "", moyenne: "  " }, true);
    expect(data!.conforme).toBe(false);
  });

  it("le verdict suit le barème du référentiel, pas une constante", async () => {
    const { data: strict } = await sb
      .from("referentiels_qualite")
      .insert({ atelier_id: ctx.seed.atelierId, nom: "Marine C5 — verdict serveur", epaisseur_mini_um: 100 })
      .select("id")
      .single();
    const { data } = await sb
      .from("controles")
      .insert({
        atelier_id: ctx.seed.atelierId, projet_id: projetId, type: "epaisseur",
        valeurs: { mini: 80, maxi: 120, moyenne: 95 }, conforme: true, referentiel_id: strict!.id,
      })
      .select("*")
      .single();
    expect(nb(data!.seuils.epaisseur_mini_um)).toBe(100);
    expect(data!.conforme, "80 µm accepté sous un barème à 100 µm").toBe(false);
  });
});

describe("R2 — un contrôle ne s'efface pas", () => {
  let gênant: string;

  beforeAll(async () => {
    const { data } = await inserer("adherence", { classe: 5 }, false);
    gênant = data!.id as string;
  });

  it("le DELETE d'un compte atelier ne retire rien", async () => {
    await sb.from("controles").delete().eq("id", gênant);
    const { data } = await sb.from("controles").select("id, conforme").eq("id", gênant).maybeSingle();
    expect(data, "le contrôle non conforme a été supprimé").not.toBeNull();
    expect(data!.conforme).toBe(false);
  });

  it("le DELETE d'un visiteur anonyme non plus", async () => {
    await anon.from("controles").delete().eq("id", gênant);
    const { data } = await sb.from("controles").select("id").eq("id", gênant).maybeSingle();
    expect(data).not.toBeNull();
  });

  it("aucune policy DELETE n'existe sur la table — la correction passe par une nouvelle mesure", async () => {
    // Le contrôle le plus récent prime (`controlesRetenus`) : retoucher la pièce et la recontrôler
    // rend le projet certifiable sans jamais effacer la trace de ce qui n'allait pas.
    const { data: correction } = await inserer("adherence", { classe: 0 }, true);
    expect(correction!.conforme).toBe(true);
    const { data: tous } = await sb.from("controles").select("*").eq("projet_id", projetId).eq("type", "adherence");
    expect((tous ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("B1 — contrôles activables par atelier", () => {
  it("un type désactivé est refusé à l'insertion, pas seulement masqué à l'écran", async () => {
    await typesDuReferentiel(["epaisseur", "aspect"]);
    const { error } = await inserer("buchholz", { valeur: 95 }, true);
    expect(error, "un contrôle désactivé a été enregistré").not.toBeNull();
    expect(error!.message).toMatch(/TYPE_CONTROLE_DESACTIVE/);
  });

  it("le réactiver le rend immédiatement enregistrable", async () => {
    await typesDuReferentiel([...TYPES_CONTROLE]);
    const { data, error } = await inserer("buchholz", { valeur: 95 }, true);
    expect(error).toBeNull();
    expect(data!.conforme).toBe(true);
  });

  it("un référentiel ne peut pas se retrouver sans aucun contrôle", async () => {
    const { error } = await sb.from("referentiels_qualite").update({ types_controle: [] }).eq("id", referentielId);
    expect(error, "une liste de contrôles vide a été acceptée").not.toBeNull();
  });

  it("un type inventé est refusé", async () => {
    const { error } = await sb
      .from("referentiels_qualite")
      .update({ types_controle: ["epaisseur", "porosite"] })
      .eq("id", referentielId);
    expect(error).not.toBeNull();
  });

  it("un référentiel sans liste vaut « tout est pratiqué » — jamais moins qu'avant", () => {
    expect(typesControleActifs(null)).toEqual(TYPES_CONTROLE);
    expect(typesControleActifs({ types_controle: [] })).toEqual(TYPES_CONTROLE);
    // L'ordre d'affichage reste celui du produit, pas celui du tableau enregistré.
    expect(typesControleActifs({ types_controle: ["aspect", "epaisseur"] })).toEqual(["epaisseur", "aspect"]);
  });
});

describe("B1 — le certificat n'affirme que ce qui a été mesuré", () => {
  const fourneeCuite = [{ statut: "terminee", temp_relevee: 195, terminee_at: "2026-08-18T10:00:00Z" }] as never;

  function ctxCert(controles: Partial<Controle>[], typesActifs: ControleType[] | null, label: string | null = null) {
    return {
      controles: controles as Controle[],
      instruments: [],
      fournees: fourneeCuite,
      lotNumero: "LOT-1",
      certificationExpireLe: null,
      certificationLabel: label,
      typesActifs,
    };
  }

  const aspectOk: Partial<Controle> = { id: "1", type: "aspect", conforme: true, mesure_at: "2026-08-18T09:00:00Z", valeurs: { conforme: true } };
  const epaisseurOk: Partial<Controle> = { id: "2", type: "epaisseur", conforme: true, mesure_at: "2026-08-18T09:10:00Z", valeurs: { mini: 80 } };

  it("sans mesure d'épaisseur, un atelier qui contrôle l'épaisseur reste bloqué", () => {
    const codes = blocagesCertificat(ctxCert([aspectOk], [...TYPES_CONTROLE])).map((b) => b.code);
    expect(codes).toContain("sans_epaisseur");
  });

  it("un atelier qui ne mesure pas l'épaisseur peut éditer son certificat", () => {
    const blocages = blocagesCertificat(ctxCert([aspectOk], ["aspect", "adherence"]));
    expect(blocages, blocages.map((b) => b.code).join(", ")).toHaveLength(0);
  });

  it("mais pas s'il n'a rien mesuré du tout : un certificat vide n'atteste rien", () => {
    const codes = blocagesCertificat(ctxCert([], ["aspect"])).map((b) => b.code);
    expect(codes).toContain("aucun_controle");
  });

  it("un dossier vide ne cumule pas deux blocages qui disent la même chose", () => {
    // Chez un atelier qui pratique l'épaisseur, « aucune mesure d'épaisseur » est le message utile.
    const codes = blocagesCertificat(ctxCert([], [...TYPES_CONTROLE])).map((b) => b.code);
    expect(codes).toContain("sans_epaisseur");
    expect(codes).not.toContain("aucun_controle");
  });

  it("le document nomme les contrôles qu'il n'atteste pas", () => {
    // C'est là que se joue l'exactitude : le certificat ne doit pas laisser croire, par son
    // silence, que l'épaisseur a été vérifiée.
    expect(typesNonAttestes({ controles: [aspectOk] as Controle[], typesActifs: ["aspect", "adherence"] })).toEqual(["adherence"]);
    expect(typesNonAttestes({ controles: [aspectOk, epaisseurOk] as Controle[], typesActifs: ["epaisseur", "aspect"] })).toEqual([]);
  });

  it("un atelier certifié Qualicoat qui coupe l'épaisseur est averti", () => {
    const codes = avertissementsCertificat(ctxCert([aspectOk], ["aspect"], "Qualicoat")).map((a) => a.code);
    expect(codes).toContain("label_sans_epaisseur");
    // Sans label revendiqué, rien à reprocher : c'est l'agrément qui impose l'épaisseur.
    expect(avertissementsCertificat(ctxCert([aspectOk], ["aspect"], null)).map((a) => a.code)).not.toContain("label_sans_epaisseur");
    // Et l'atelier Qualicoat qui la mesure n'est pas embêté.
    expect(avertissementsCertificat(ctxCert([epaisseurOk], [...TYPES_CONTROLE], "Qualicoat")).map((a) => a.code)).not.toContain("label_sans_epaisseur");
  });

  it("les labels concernés sont ceux dont le référentiel impose l'épaisseur", () => {
    expect(labelExigeEpaisseur("Qualicoat")).toBe(true);
    expect(labelExigeEpaisseur("Qualisteelcoat")).toBe(true);
    expect(labelExigeEpaisseur("ISO 9001")).toBe(false);
    expect(labelExigeEpaisseur(null)).toBe(false);
  });
});
