import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, nb } from "./helpers/contexte";
import { ouvrirAtelierJetable, type AtelierJetable } from "./helpers/atelier-jetable";
import { ligneLibre } from "./helpers/devis";
import { calcTotaux } from "@/lib/utils";
import { errorFr } from "@/lib/errors";

/**
 * Lot B — B1 (envoyer_document), B3 (pièce jointe), B4 (chiffres_du_mois, totaux_factures).
 *
 * Atelier entièrement jetable (`ouvrirAtelierJetable`), pas le seed partagé : `chiffres_du_mois()`
 * et `totaux_factures()` totalisent tout l'atelier, un seed déjà utilisé par vingt autres fichiers
 * rendrait les montants imprévisibles. Aucun e-mail réel : `envoyer_document()` ne fait qu'écrire
 * dans `notifications` (statut `pending`) — c'est `process_notifications()`, jamais appelée ici
 * directement, qui parlerait au relais, et elle refuse désormais tout atelier `TEST-AUTO-…`
 * (vérifié ci-dessous en `service_role`, seul rôle qui peut encore l'appeler).
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const CLE_SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42501", "PGRST202", "PGRST203"].includes(error.code ?? "") || /permission denied|not find the function|row-level security/i.test(error.message ?? "");
}

let atelier: AtelierJetable;
let atelierBis: AtelierJetable; // second atelier, pour prouver le cloisonnement
let bureau: SupabaseClient; // = atelier.sb (le propriétaire, qui a accès commercial)
let operateur: SupabaseClient; // rôle "atelier" du même atelier

let clientAvecEmail = "";
let clientSansEmail = "";
let devisId = "";
let factureId = "";
let factureTotalTtc = 0;
let avoirId = "";
let blId = "";

async function creerClient(sb: SupabaseClient, atelierId: string, nom: string, email: string | null) {
  const { data, error } = await sb.from("clients").insert({ atelier_id: atelierId, nom, email }).select("id").single();
  if (error) throw new Error(`création client ${nom} : ${error.message}`);
  return (data as { id: string }).id;
}

beforeAll(async () => {
  atelier = await ouvrirAtelierJetable("envoi-docs");
  atelierBis = await ouvrirAtelierJetable("envoi-docs-bis");
  bureau = atelier.sb;
  operateur = await atelier.inviter("atelier");

  clientAvecEmail = await creerClient(bureau, atelier.atelierId, "Client Avec Email", "client-b1@exemple-test.invalid");
  clientSansEmail = await creerClient(bureau, atelier.atelierId, "Client Sans Email", null);

  // Un devis, encore en brouillon pour l'épreuve « pas encore finalisé », puis finalisé.
  const lignes = [ligneLibre({ libelle: "Thermolaquage portail", qte: 1, pu: 420 })];
  const { data: d, error: eD } = await bureau
    .from("devis")
    .insert({ atelier_id: atelier.atelierId, client_id: clientAvecEmail, items: lignes, ...calcTotaux(lignes, null) })
    .select("id")
    .single();
  if (eD) throw new Error(`création devis : ${eD.message}`);
  devisId = (d as { id: string }).id;

  // Une facture libre émise ce mois-ci — matière première de chiffres_du_mois()/totaux_factures().
  // `ligneLibre` pose 20 % de TVA par défaut : 1 000 € HT deviennent 1 200 € TTC, c'est ce TTC-là
  // (jamais le HT) que reste_du et totaux_factures().facture_ttc doivent retrouver plus bas.
  const lignesF = [ligneLibre({ libelle: "Laquage garde-corps", qte: 1, pu: 1000 })];
  const totauxF = calcTotaux(lignesF, null);
  factureTotalTtc = totauxF.total_ttc;
  const { data: f, error: eF } = await bureau
    .from("factures")
    .insert({ atelier_id: atelier.atelierId, client_id: clientAvecEmail, type: "libre", items: lignesF, ...totauxF })
    .select("id")
    .single();
  if (eF) throw new Error(`création facture : ${eF.message}`);
  factureId = (f as { id: string }).id;
  const { data: numeroF, error: eNF } = await bureau.rpc("next_numero", { p_type: "facture" });
  if (eNF) throw new Error(`next_numero facture : ${eNF.message}`);
  const { error: eEmet } = await bureau.from("factures").update({ status: "emise", numero: numeroF, emise_at: new Date().toISOString() }).eq("id", factureId);
  if (eEmet) throw new Error(`émission facture : ${eEmet.message}`);
  // Encaissée à moitié : de quoi éprouver le « reste dû » et l'« encaissé » à la fois.
  const { error: ePaie } = await bureau.from("paiements").insert({ atelier_id: atelier.atelierId, facture_id: factureId, montant: 400, moyen: "virement" });
  if (ePaie) throw new Error(`paiement : ${ePaie.message}`);

  // Un bon de livraison émis — envoyer_document('bl', …) doit rester ouvert à l'opérateur d'atelier.
  const { data: bl, error: eBl } = await bureau
    .from("bons_livraison")
    .insert({ atelier_id: atelier.atelierId, client_id: clientAvecEmail, lignes: [{ libelle: "Portail", qte: 1, unite: "piece" }] })
    .select("id")
    .single();
  if (eBl) throw new Error(`création BL : ${eBl.message}`);
  blId = (bl as { id: string }).id;
  const { data: numeroBl, error: eNBl } = await bureau.rpc("next_numero", { p_type: "bl" });
  if (eNBl) throw new Error(`next_numero bl : ${eNBl.message}`);
  const { error: eEmetBl } = await bureau.from("bons_livraison").update({ status: "emis", numero: numeroBl }).eq("id", blId);
  if (eEmetBl) throw new Error(`émission BL : ${eEmetBl.message}`);
});

afterAll(async () => {
  await bureau.from("projets").delete().eq("created_by", (await bureau.auth.getUser()).data.user?.id ?? "");
  await atelier.fermer();
  await atelierBis.fermer();
});

// ═════════════════════════════════════════════════════════════════════════════
describe("B1 — envoyer_document()", () => {
  it("refuse un devis pas encore finalisé", async () => {
    const { error } = await bureau.rpc("envoyer_document", { p_type: "devis", p_id: devisId, p_destinataire: null, p_message: null });
    expect(error?.message ?? "").toContain("DOCUMENT_NON_FINALISE");
  });

  it("pose une ligne dans notifications une fois le devis finalisé, avec le mot personnalisé", async () => {
    const { data: numero, error: eNum } = await bureau.rpc("next_numero", { p_type: "devis" });
    expect(eNum, eNum?.message).toBeNull();
    const { error: eMaj } = await bureau.from("devis").update({ status: "envoye", numero, envoye_at: new Date().toISOString() }).eq("id", devisId);
    expect(eMaj, eMaj?.message).toBeNull();

    const { data, error } = await bureau.rpc("envoyer_document", { p_type: "devis", p_id: devisId, p_destinataire: null, p_message: "Un mot pour vous." });
    expect(error, error?.message).toBeNull();
    const res = data as { notification_id: string; destinataire: string; deja_envoye: boolean };
    expect(res.deja_envoye).toBe(false);
    expect(res.destinataire).toBe("client-b1@exemple-test.invalid");

    const { data: notif } = await bureau.from("notifications").select("*").eq("id", res.notification_id).single();
    expect(notif!.template).toBe("devis_envoye");
    expect(notif!.status).toBe("pending");
    expect(notif!.payload.devis_id).toBe(devisId);
    expect(notif!.payload.message).toBe("Un mot pour vous.");
  });

  it("un second appel dans les dix secondes ne pose pas de seconde ligne", async () => {
    const { count: avant } = await bureau.from("notifications").select("id", { count: "exact", head: true }).eq("template", "devis_envoye");
    const { data, error } = await bureau.rpc("envoyer_document", { p_type: "devis", p_id: devisId, p_destinataire: null, p_message: null });
    expect(error, error?.message).toBeNull();
    expect((data as { deja_envoye: boolean }).deja_envoye).toBe(true);
    const { count: apres } = await bureau.from("notifications").select("id", { count: "exact", head: true }).eq("template", "devis_envoye");
    expect(apres).toBe(avant);
  });

  it("accepte un destinataire saisi à la main, même si le client en a un autre", async () => {
    const { data, error } = await bureau.rpc("envoyer_document", { p_type: "devis", p_id: devisId, p_destinataire: "autre@exemple-test.invalid", p_message: null });
    expect(error, error?.message).toBeNull();
    expect((data as { destinataire: string }).destinataire).toBe("autre@exemple-test.invalid");
  });

  it("refuse une facture émise sans email client et sans destinataire fourni", async () => {
    const lignes = [ligneLibre({ libelle: "X", qte: 1, pu: 10 })];
    const { data: f } = await bureau.from("factures").insert({
      atelier_id: atelier.atelierId, client_id: clientSansEmail, type: "libre", items: lignes, ...calcTotaux(lignes, null),
    }).select("id").single();
    const { data: numero } = await bureau.rpc("next_numero", { p_type: "facture" });
    await bureau.from("factures").update({ status: "emise", numero, emise_at: new Date().toISOString() }).eq("id", (f as { id: string }).id);

    const { error } = await bureau.rpc("envoyer_document", { p_type: "facture", p_id: (f as { id: string }).id, p_destinataire: null, p_message: null });
    expect(error?.message ?? "").toContain("DESTINATAIRE_MANQUANT");

    // Cette facture jetable, émise pour la seule épreuve ci-dessus, ne doit pas fausser
    // chiffres_du_mois() plus bas (facturé du mois = seulement `factureId`) : on l'annule aussitôt,
    // comme le ferait l'atelier qui a créé une facture par erreur pour le mauvais client.
    const { error: eAnnule } = await bureau.rpc("annuler_facture", { p_id: (f as { id: string }).id, p_motif: "Facture de test, jamais destinée à un vrai client." });
    expect(eAnnule, eAnnule?.message).toBeNull();
  });

  it("envoie la facture émise à son client, et le modèle distingue avoir et facture", async () => {
    const { data, error } = await bureau.rpc("envoyer_document", { p_type: "facture", p_id: factureId, p_destinataire: null, p_message: null });
    expect(error, error?.message).toBeNull();
    const res = data as { notification_id: string };
    const { data: notif } = await bureau.from("notifications").select("payload").eq("id", res.notification_id).single();
    expect(notif!.payload.est_avoir).toBe(false);
  });

  it("un devis/une facture restent au bureau : un compte d'atelier est refusé, rien n'est posé", async () => {
    const { count: avant } = await bureau.from("notifications").select("id", { count: "exact", head: true });
    const d = await operateur.rpc("envoyer_document", { p_type: "devis", p_id: devisId, p_destinataire: null, p_message: null });
    const f = await operateur.rpc("envoyer_document", { p_type: "facture", p_id: factureId, p_destinataire: null, p_message: null });
    expect(d.error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");
    expect(f.error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");
    const { count: apres } = await bureau.from("notifications").select("id", { count: "exact", head: true });
    expect(apres).toBe(avant);
  });

  it("un bon de livraison, en revanche, s'envoie par toute l'équipe — la production lui appartient", async () => {
    const { data, error } = await operateur.rpc("envoyer_document", { p_type: "bl", p_id: blId, p_destinataire: null, p_message: null });
    expect(error, error?.message).toBeNull();
    expect((data as { destinataire: string }).destinataire).toBe("client-b1@exemple-test.invalid");
  });

  it("refuse un type de document inconnu et un document d'un autre atelier", async () => {
    const t = await bureau.rpc("envoyer_document", { p_type: "avoir_papier", p_id: devisId, p_destinataire: null, p_message: null });
    expect(t.error?.message ?? "").toContain("DOCUMENT_TYPE_INCONNU");

    const etranger = await atelierBis.sb.rpc("envoyer_document", { p_type: "devis", p_id: devisId, p_destinataire: null, p_message: null });
    expect(etranger.error?.message ?? "").toContain("DOCUMENT_INTROUVABLE");
  });

  it("un visiteur non connecté n'appelle jamais cette RPC", async () => {
    const { error } = await clientAnonyme().rpc("envoyer_document", { p_type: "bl", p_id: blId, p_destinataire: null, p_message: null });
    expect(error, "un visiteur anonyme ne devrait pas pouvoir envoyer un document").not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("La trace : envois_documents et la RLS des bons de livraison", () => {
  it("le bureau lit la trace des trois types, avec le mot et le statut d'envoi", async () => {
    const { data, error } = await bureau.from("envois_documents").select("*").eq("document_id", devisId).order("envoye_at", { ascending: false }).limit(1).single();
    expect(error, error?.message).toBeNull();
    expect(data!.document_type).toBe("devis");
    expect(data!.statut_envoi).toBe("pending");
  });

  it("un opérateur d'atelier voit la trace de son BL mais aucune trace de devis/facture (RLS)", async () => {
    const { data: trBl, error: eBl } = await operateur.from("envois_documents").select("*").eq("document_id", blId);
    expect(eBl, eBl?.message).toBeNull();
    expect((trBl ?? []).length).toBeGreaterThan(0);

    // Une vraie épreuve de RLS filtre par ce que la policy regarde (le gabarit), pas par le
    // document : sans ça, un simple mauvais id prouverait la même chose qu'un vrai refus.
    const { data: trDevis } = await operateur.from("envois_documents").select("*").eq("template", "devis_envoye");
    expect((trDevis ?? []).length).toBe(0);
    const { data: trFacture } = await operateur.from("envois_documents").select("*").eq("template", "facture_emise");
    expect((trFacture ?? []).length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("B3 — joindre_piece_jointe_notification()", () => {
  it("pose la pièce jointe sur une notification de son propre atelier", async () => {
    const { data: notif } = await bureau.from("notifications").select("id").eq("template", "bl_emis").eq("payload->>bl_id", blId).limit(1).single();
    const { data: pose, error } = await bureau.rpc("joindre_piece_jointe_notification", {
      p_notification_id: (notif as { id: string }).id, p_filename: "BL-test.pdf", p_mime: "application/pdf", p_base64: "JVBERi0=",
    });
    expect(error, error?.message).toBeNull();
    expect(pose).toBe(true);

    const { data: apres } = await bureau.from("notifications").select("attachments").eq("id", (notif as { id: string }).id).single();
    expect(apres!.attachments).toEqual([{ filename: "BL-test.pdf", mime: "application/pdf", content_base64: "JVBERi0=" }]);
  });

  it("refuse (sans erreur, mais sans effet) une notification d'un autre atelier", async () => {
    const { data: notif } = await bureau.from("notifications").select("id").eq("template", "devis_envoye").limit(1).single();
    const { data: pose, error } = await atelierBis.sb.rpc("joindre_piece_jointe_notification", {
      p_notification_id: (notif as { id: string }).id, p_filename: "vol.pdf", p_mime: "application/pdf", p_base64: "AA==",
    });
    expect(error, error?.message).toBeNull();
    expect(pose).toBe(false);
    const { data: verif } = await bureau.from("notifications").select("attachments").eq("id", (notif as { id: string }).id).single();
    expect(verif!.attachments).toBeNull();
  });

  // ─── Audit sécurité du 07/09/2026, constat 2 : bornes de taille ──────────────────────────────
  // `Buffer.alloc(n).toString("base64")` donne un base64 qui décode en EXACTEMENT `n` octets :
  // pas d'approximation par un ratio 3/4, la borne est franchie (ou pas) au octet près.
  function base64DeTaille(octets: number): string {
    return Buffer.alloc(octets, 65).toString("base64"); // rempli de 'A' (0x41), peu importe le contenu
  }
  const MO = 1024 * 1024;

  it("refuse une pièce de plus de 10 Mo, sans rien poser", async () => {
    const { data: notif } = await bureau.from("notifications").select("id").eq("template", "bl_emis").eq("payload->>bl_id", blId).limit(1).single();
    const { error } = await bureau.rpc("joindre_piece_jointe_notification", {
      p_notification_id: (notif as { id: string }).id, p_filename: "trop-lourd.pdf", p_mime: "application/pdf",
      p_base64: base64DeTaille(11 * MO),
    });
    expect(error, "une pièce de 11 Mo doit être refusée").not.toBeNull();
    expect(error!.message).toContain("PIECE_JOINTE_TROP_LOURDE");

    // État après coup : le refus n'a rien changé à ce qui existait déjà (posé par le tout premier
    // test de ce bloc), il ne l'a pas non plus effacé.
    const { data: apres } = await bureau.from("notifications").select("attachments").eq("id", (notif as { id: string }).id).single();
    expect((apres!.attachments as unknown[]).length).toBe(1);
  });

  it("accepte deux pièces sous 10 Mo chacune, puis refuse la troisième qui ferait dépasser 20 Mo cumulés", async () => {
    // Notification neuve : celle du test précédent porte déjà la pièce de 8 ko posée plus haut.
    const { data: notif } = await bureau.from("notifications").select("id").eq("template", "facture_emise").limit(1).single();
    const id = (notif as { id: string }).id;

    const premiere = await bureau.rpc("joindre_piece_jointe_notification", {
      p_notification_id: id, p_filename: "a.pdf", p_mime: "application/pdf", p_base64: base64DeTaille(9 * MO),
    });
    expect(premiere.error, premiere.error?.message).toBeNull();
    expect(premiere.data).toBe(true);

    const seconde = await bureau.rpc("joindre_piece_jointe_notification", {
      p_notification_id: id, p_filename: "b.pdf", p_mime: "application/pdf", p_base64: base64DeTaille(9 * MO),
    });
    expect(seconde.error, seconde.error?.message).toBeNull();
    expect(seconde.data).toBe(true);

    // 9 + 9 + 3 = 21 Mo cumulés : au-delà de 20 Mo, refusée.
    const troisieme = await bureau.rpc("joindre_piece_jointe_notification", {
      p_notification_id: id, p_filename: "c.pdf", p_mime: "application/pdf", p_base64: base64DeTaille(3 * MO),
    });
    expect(troisieme.error, "le cumul dépasserait 20 Mo : doit être refusée").not.toBeNull();
    expect(troisieme.error!.message).toContain("NOTIFICATION_PIECES_TROP_LOURDES");

    // État après coup : les deux premières pièces sont là, la troisième n'a pas été ajoutée.
    const { data: apres } = await bureau.from("notifications").select("attachments").eq("id", id).single();
    const noms = (apres!.attachments as { filename: string }[]).map((a) => a.filename);
    expect(noms).toEqual(["a.pdf", "b.pdf"]);
  });

  it("le message affiché est en français et dit la borne dépassée", () => {
    expect(errorFr({ message: "PIECE_JOINTE_TROP_LOURDE" })).toContain("10 Mo");
    expect(errorFr({ message: "NOTIFICATION_PIECES_TROP_LOURDES" })).toContain("20 Mo");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("B4 — chiffres_du_mois()", () => {
  it("réservée au bureau : un compte d'atelier est refusé", async () => {
    const { error } = await operateur.rpc("chiffres_du_mois");
    expect(error?.message ?? "").toContain("ACCES_COMMERCIAL_REQUIS");
  });

  it("un visiteur anonyme est refusé", async () => {
    const { error } = await clientAnonyme().rpc("chiffres_du_mois");
    expect(error).not.toBeNull();
  });

  it("facturé HT, encaissé et reste dû reflètent exactement la facture de l'atelier jetable", async () => {
    const { data, error } = await bureau.rpc("chiffres_du_mois").maybeSingle();
    expect(error, error?.message).toBeNull();
    const c = data as Record<string, unknown>;
    // 1000 € HT facturés ce mois (origine = 'application'), 400 € encaissés. Le reste dû, lui, se
    // lit en TTC (c'est ce que le client doit réellement) : 1 200 € TTC − 400 € = 800 €, jamais
    // 1000 − 400 — ce serait comparer un encaissement TTC à un solde HT.
    expect(nb(c.facture_ht)).toBe(1000);
    expect(nb(c.encaisse)).toBe(400);
    expect(nb(c.reste_du)).toBe(factureTotalTtc - 400);
  });

  it("les m² produits comptent les projets livrés ce mois-ci, et pas les autres statuts", async () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { error: e1 } = await bureau.from("projets").insert({
      atelier_id: atelier.atelierId, client_id: clientAvecEmail, nom: "Chantier livré", status: "livre",
      surface_m2: 12.5, date_livraison: aujourdhui,
    });
    expect(e1, e1?.message).toBeNull();
    // Un projet "prêt" mais jamais enlevé n'est pas produit pour le client — il ne doit pas compter.
    const { error: e2 } = await bureau.from("projets").insert({
      atelier_id: atelier.atelierId, client_id: clientAvecEmail, nom: "Chantier prêt, non enlevé", status: "pret", surface_m2: 999,
    });
    expect(e2, e2?.message).toBeNull();

    const { data } = await bureau.rpc("chiffres_du_mois").maybeSingle();
    expect(nb((data as Record<string, unknown>).m2_produits)).toBe(12.5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("B4 — totaux_factures()", () => {
  it("le filtre 'tous' (NULL) inclut la facture émise, et un avoir vient en déduction", async () => {
    const { data: brut } = await bureau.rpc("totaux_factures", { p_statuts: null }).maybeSingle();
    const b = brut as Record<string, unknown>;
    expect(nb(b.facture_ttc)).toBeGreaterThanOrEqual(1000);
    expect(nb(b.encaisse)).toBeGreaterThanOrEqual(400);

    const { data: avoirId2, error } = await bureau.rpc("avoir_depuis_facture", { p_id: factureId, p_lignes: null });
    expect(error, error?.message).toBeNull();
    avoirId = avoirId2 as string;
    const { data: numeroAv } = await bureau.rpc("next_numero", { p_type: "avoir" });
    await bureau.from("factures").update({ status: "emise", numero: numeroAv, emise_at: new Date().toISOString() }).eq("id", avoirId);

    const { data: apres } = await bureau.rpc("totaux_factures", { p_statuts: null }).maybeSingle();
    const a = apres as Record<string, unknown>;
    // L'avoir est total (1 200 € TTC, comme la facture d'origine — 1 000 € HT + 20 % de TVA) : il
    // déduit exactement ce montant du facturé brut — c'est le signe qui porte la déduction, pas le
    // montant.
    expect(nb(a.facture_ttc)).toBe(nb(b.facture_ttc) - factureTotalTtc);
  });

  it("le filtre par statut ne compte que les factures de ce statut", async () => {
    const { data } = await bureau.rpc("totaux_factures", { p_statuts: ["brouillon"] }).maybeSingle();
    // Le devis n'a pas de facture brouillon dans ce jeu de données hors celles déjà émises.
    expect(nb((data as Record<string, unknown>).facture_ttc)).toBe(0);
  });

  it("un compte d'un autre atelier voit un total à zéro sur les factures qui ne sont pas les siennes", async () => {
    const { data, error } = await atelierBis.sb.rpc("totaux_factures", { p_statuts: null }).maybeSingle();
    expect(error, error?.message).toBeNull();
    expect(nb((data as Record<string, unknown>).facture_ttc)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe("Garde-fou de recette : process_notifications() ne contacte jamais le relais pour un atelier TEST-AUTO-", () => {
  it.skipIf(!CLE_SERVICE)("marque nos notifications « annulée », sans http_request_id", async () => {
    const service = createClient(process.env.TEST_SUPABASE_URL!, CLE_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: avant } = await bureau.from("notifications").select("id").eq("atelier_id", atelier.atelierId).eq("status", "pending");
    expect((avant ?? []).length).toBeGreaterThan(0);

    const { error } = await service.rpc("process_notifications");
    expect(error, error?.message).toBeNull();

    const { data: apres } = await bureau.from("notifications").select("status, error, http_request_id").eq("atelier_id", atelier.atelierId).in("id", (avant ?? []).map((n) => n.id));
    for (const n of apres ?? []) {
      expect(n.status).toBe("annulee");
      expect(n.http_request_id).toBeNull();
      expect(n.error ?? "").toContain("TEST-AUTO-");
    }
  });
});
