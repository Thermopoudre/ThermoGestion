import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte } from "./helpers/contexte";
import { WORKFLOW_DEFAUT } from "./helpers/devis";

/**
 * Le courriel du matin et la maîtrise des relances.
 *
 * Ce que ces tests gardent, dans l'ordre de ce qui coûterait le plus cher :
 *
 *  1. **Rien ne part de l'atelier de démonstration.** Le 19/08 à 7 h, le cron de relance a envoyé
 *     deux vrais e-mails depuis la démo vers des adresses fictives : les écritures de la démo sont
 *     bloquées pour les comptes connectés, mais le cron tourne sans jeton et le garde-fou ne le
 *     voyait pas.
 *  2. **Les fonctions de cron restent hors de portée du front.** `envoyer_recap_quotidien` insère
 *     dans la file d'envoi ; ouverte à `anon`, elle deviendrait un bouton « écrire à tout le monde ».
 *  3. **Le rôle atelier ne lit pas d'argent, même par e-mail.** Le récapitulatif est calculé par
 *     niveau de droit : la rubrique n'est pas masquée, elle n'existe pas.
 *  4. **`notifications` n'est pas un relais de messagerie.** L'insertion directe est refusée ; le
 *     seul chemin est une RPC qui déduit destinataire et contenu de la base.
 */

const ctx = contexte();
let anon: SupabaseClient;
let sb: SupabaseClient;

/** PostgREST rend 42501 (droit refusé) ou PGRST202 (fonction masquée pour ce rôle). */
function estRefus(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return ["42501", "PGRST202", "PGRST203"].includes(error.code ?? "")
    || /permission denied|not find the function|violates row-level security/i.test(error.message ?? "");
}

beforeAll(() => {
  anon = clientAnonyme(ctx);
  sb = clientConnecte(ctx);
});

describe("les fonctions de tâche planifiée restent fermées au front", () => {
  const CRON = [
    { nom: "envoyer_recap_quotidien", args: {} },
    { nom: "recap_quotidien_payload", args: { p_atelier: "00000000-0000-0000-0000-000000000000", p_commercial: true } },
    { nom: "reglages_alertes_de", args: { p_atelier: "00000000-0000-0000-0000-000000000000" } },
    { nom: "recap_quotidien_html", args: { p: {}, p_token: "x", p_base: "https://exemple.fr" } },
    // Amélioration n°7 (migration 68) : lit le stock et les mouvements de n'importe quel atelier
    // passé en paramètre, exactement comme `recap_quotidien_payload` — même fermeture requise.
    { nom: "poudre_pesee_a_rappeler", args: { p_atelier: "00000000-0000-0000-0000-000000000000" } },
  ];

  it.each(CRON)("$nom est refusée à anon", async ({ nom, args }) => {
    const { error } = await anon.rpc(nom, args);
    expect(estRefus(error), `anon a pu appeler ${nom} : ${JSON.stringify(error)}`).toBe(true);
  });

  it.each(CRON)("$nom est refusée à un compte connecté", async ({ nom, args }) => {
    const { error } = await sb.rpc(nom, args);
    expect(estRefus(error), `un compte atelier a pu appeler ${nom} : ${JSON.stringify(error)}`).toBe(true);
  });

  it("les portes applicatives, elles, répondent au compte connecté et jamais à anon", async () => {
    for (const nom of ["mes_reglages_alertes", "mon_recap_quotidien"]) {
      expect(estRefus((await anon.rpc(nom)).error), `${nom} est ouverte à anon`).toBe(true);
      const { error } = await sb.rpc(nom);
      expect(error, `${nom} refusée au compte connecté : ${JSON.stringify(error)}`).toBeNull();
    }
  });
});

describe("réglages d'alerte — une seule source pour le seuil de DLU", () => {
  it("rend les valeurs par défaut du métier, et l'atelier du jeton, pas un autre", async () => {
    const { data, error } = await sb.rpc("mes_reglages_alertes");
    expect(error).toBeNull();
    const r = data as { atelier_id: string; seuil_dlu_jours: number; relance_max: number; recap_heure: number };
    expect(r.atelier_id).toBe(ctx.seed.atelierId);
    expect(r.seuil_dlu_jours).toBe(60);
    expect(r.relance_max).toBe(3);
    expect(r.recap_heure).toBe(7);
  });

  it("le seuil se règle par atelier et se relit tel quel", async () => {
    const maj = await sb.from("reglages_alertes")
      .upsert({ atelier_id: ctx.seed.atelierId, seuil_dlu_jours: 20 }, { onConflict: "atelier_id" });
    expect(maj.error).toBeNull();
    const { data } = await sb.rpc("mes_reglages_alertes");
    expect((data as { seuil_dlu_jours: number }).seuil_dlu_jours).toBe(20);
    await sb.from("reglages_alertes").update({ seuil_dlu_jours: 60 }).eq("atelier_id", ctx.seed.atelierId);
  });

  it("refuse un seuil hors bornes plutôt que de l'accepter en silence", async () => {
    const { error } = await sb.from("reglages_alertes")
      .update({ seuil_dlu_jours: 0 }).eq("atelier_id", ctx.seed.atelierId);
    expect(error, "un seuil de 0 jour a été accepté").not.toBeNull();
  });

  it("anon ne lit ni les réglages ni les jetons de désabonnement", async () => {
    const reglages = await anon.from("reglages_alertes").select("*");
    expect(reglages.data ?? []).toHaveLength(0);
    const jetons = await anon.from("recap_destinataires").select("token");
    expect(jetons.data ?? []).toHaveLength(0);
  });
});

describe("le contenu du récapitulatif respecte les droits", () => {
  it("le compte connecté reçoit un récapitulatif complet et daté d'aujourd'hui", async () => {
    const { data, error } = await sb.rpc("mon_recap_quotidien");
    expect(error).toBeNull();
    const p = data as { jour: string; commercial: boolean; production: unknown; risques: unknown; argent: unknown };
    expect(p.jour).toBe(new Date().toISOString().slice(0, 10));
    expect(p.production).toBeTruthy();
    expect(p.risques).toBeTruthy();
  });

  it("aucun montant ne fuit vers un niveau de droit non commercial", async () => {
    // `mon_recap_quotidien()` déduit le niveau du rôle du jeton : on vérifie la cloison sur la
    // sortie elle-même, pas sur une case cochée à l'écran.
    const { data } = await sb.rpc("mon_recap_quotidien");
    const p = data as { commercial: boolean; argent: { factures: { nb: number } } };
    if (!p.commercial) {
      expect(JSON.stringify(p)).not.toMatch(/total_ttc/);
      expect(p.argent.factures.nb).toBe(0);
    }
  });
});

describe("notifications — pas de relais de messagerie ouvert", () => {
  it("un compte connecté ne peut pas insérer une notification à la main", async () => {
    const { error } = await sb.from("notifications").insert({
      atelier_id: ctx.seed.atelierId,
      destinataire_email: "cible@exemple.fr",
      template: "facture_emise",
      payload: { facture_numero: "<img src=x onerror=alert(1)>" },
    });
    expect(estRefus(error), "n'importe quel compte peut faire partir un e-mail arbitraire").toBe(true);
  });

  it("notifier_facture_emise refuse une facture qui n'est pas celle de l'atelier", async () => {
    const { error } = await sb.rpc("notifier_facture_emise", { p_facture: "00000000-0000-0000-0000-000000000000" });
    expect(error?.message ?? "").toMatch(/FACTURE_INTROUVABLE/);
  });
});

describe("maîtrise des relances", () => {
  it("un client peut être exclu des relances, et l'exclusion se relit", async () => {
    const coupe = await sb.from("clients").update({ relances_actives: false }).eq("id", ctx.seed.clientSimpleId);
    expect(coupe.error).toBeNull();
    const { data } = await sb.from("clients").select("relances_actives").eq("id", ctx.seed.clientSimpleId).single();
    expect(data?.relances_actives).toBe(false);
    await sb.from("clients").update({ relances_actives: true }).eq("id", ctx.seed.clientSimpleId);
  });

  it("un client est relançable par défaut : la colonne ne doit jamais naître à faux", async () => {
    const { data } = await sb.from("clients").select("id, relances_actives").eq("atelier_id", ctx.seed.atelierId);
    expect((data ?? []).every((c) => c.relances_actives === true)).toBe(true);
  });

  it("la vue des relances envoyées est lisible par le bureau et vide pour anon", async () => {
    const { error } = await sb.from("relances_envoyees").select("id, statut_envoi").limit(1);
    expect(error).toBeNull();
    const vueAnon = await anon.from("relances_envoyees").select("id");
    expect(vueAnon.data ?? []).toHaveLength(0);
  });

  it("couper les relances d'une facture émise reste possible — ce n'est pas une mention légale", async () => {
    // `trg_figer_document` verrouille les montants, le numéro et l'échéance d'une facture émise.
    // `relances_actives` n'en fait pas partie, et ne doit surtout pas en faire partie : sinon
    // l'atelier ne pourrait plus arrêter ce que le logiciel écrit à son client.
    const { data: f } = await sb.from("factures")
      .select("id, relances_actives").eq("atelier_id", ctx.seed.atelierId).eq("status", "emise").limit(1).maybeSingle();
    if (!f) return;
    const { error } = await sb.from("factures").update({ relances_actives: false }).eq("id", f.id);
    expect(error, `impossible de couper les relances d'une facture émise : ${JSON.stringify(error)}`).toBeNull();
    await sb.from("factures").update({ relances_actives: f.relances_actives }).eq("id", f.id);
  });
});

/**
 * Rappel mensuel de la pesée de rendement (amélioration n°7, migration 68).
 *
 * `mon_recap_quotidien()` (ouverte au compte connecté, cf. plus haut) calcule toujours la section
 * si le réglage est actif — c'est délibéré (voir le commentaire de `mon_recap_quotidien` en
 * migration 68) : l'atelier doit voir l'effet de son réglage sur l'encart de `/reglages` sans
 * attendre que le délai de 28 jours du cron soit écoulé. C'est donc par cette porte que ces tests
 * vérifient le contenu, sans jamais appeler `envoyer_recap_quotidien()` ni `poudre_pesee_a_rappeler()`
 * directement — les deux sont fermées au compte connecté (vérifié ci-dessus), et la consigne de
 * cette mission est explicite : ne jamais déclencher le cron réel.
 */
describe("rappel mensuel de la pesée de rendement (amélioration n°7)", () => {
  let poudreJamaisId: string;

  async function creerPoudreTest(reference: string): Promise<string> {
    const { data, error } = await sb
      .from("poudres")
      .insert({
        atelier_id: ctx.seed.atelierId, marque: "TestPesee", reference, ral: "9010",
        finition: "mat", rendement_m2_kg: 8, stock_kg: 50, actif: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`poudre ${reference} : ${error.message}`);
    return data!.id as string;
  }

  /** Même mécanique que `rentabilite-energie-pesee.test.ts` : 4 `avancer_etape` posent
   *  `poudre_conso_kg`, la condition qui décide si une teinte a « un rendement à vérifier ». */
  async function creerProjetCuit(poudreId: string, nom: string): Promise<string> {
    const { data: client, error: errClient } = await sb
      .from("clients")
      .insert({ atelier_id: ctx.seed.atelierId, type: "pro", nom: `Client pesée — ${nom}`, email: null })
      .select("id")
      .single();
    if (errClient) throw new Error(`client pour ${nom} : ${errClient.message}`);

    const { data: projet, error } = await sb
      .from("projets")
      .insert({
        atelier_id: ctx.seed.atelierId, client_id: client!.id, nom,
        status: "en_cours", etapes: WORKFLOW_DEFAUT, etape_courante: "reception",
        surface_m2: 4, couches: 1, poudre_id: poudreId,
        date_reception: "2026-08-01", date_promise: "2026-08-12",
      })
      .select("id")
      .single();
    if (error) throw new Error(`projet ${nom} : ${error.message}`);
    for (let i = 0; i < 4; i++) {
      const { error: errEtape } = await sb.rpc("avancer_etape", { p_projet_id: projet!.id });
      if (errEtape) throw new Error(`avancer_etape ${nom} : ${errEtape.message}`);
    }
    return projet!.id as string;
  }

  type Payload = { risques: { pesees: { poudre_id: string; jamais: boolean; derniere_pesee: string | null }[] } };

  beforeAll(async () => {
    poudreJamaisId = await creerPoudreTest("TEST-RAPPEL-JAMAIS");
    await creerProjetCuit(poudreJamaisId, "Portail jamais pesé");
  });

  it("le réglage existe, vaut vrai par défaut, et se coupe comme les autres alertes", async () => {
    const { data, error } = await sb.rpc("mes_reglages_alertes");
    expect(error).toBeNull();
    const r = data as { rappel_pesee_actif: boolean; rappel_pesee_dernier_envoi: string | null };
    expect(r.rappel_pesee_actif).toBe(true);
    expect(r.rappel_pesee_dernier_envoi).toBeNull();

    const off = await sb.from("reglages_alertes")
      .update({ rappel_pesee_actif: false }).eq("atelier_id", ctx.seed.atelierId);
    expect(off.error).toBeNull();
    const relu = await sb.rpc("mes_reglages_alertes");
    expect((relu.data as { rappel_pesee_actif: boolean }).rappel_pesee_actif).toBe(false);
    await sb.from("reglages_alertes").update({ rappel_pesee_actif: true }).eq("atelier_id", ctx.seed.atelierId);
  });

  it("une teinte jamais utilisée en production n'est jamais réclamée, même jamais pesée", async () => {
    const inutilisee = await creerPoudreTest("TEST-RAPPEL-INUTILISEE");
    const { data, error } = await sb.rpc("mon_recap_quotidien");
    expect(error).toBeNull();
    const p = data as Payload;
    expect(p.risques.pesees.some((x) => x.poudre_id === inutilisee)).toBe(false);
  });

  it("une teinte jamais pesée mais consommée en production apparaît dans le rappel", async () => {
    const { data, error } = await sb.rpc("mon_recap_quotidien");
    expect(error).toBeNull();
    const p = data as Payload;
    const ligne = p.risques.pesees.find((x) => x.poudre_id === poudreJamaisId);
    expect(ligne, "la teinte jamais pesée n'apparaît pas dans le rappel").toBeTruthy();
    expect(ligne!.jamais).toBe(true);
    expect(ligne!.derniere_pesee).toBeNull();
  });

  it("une pesée, même sans écart, fait disparaître la teinte du rappel", async () => {
    const { data: poudre } = await sb.from("poudres").select("stock_kg").eq("id", poudreJamaisId).single();
    const { error } = await sb.rpc("mouvement_stock", {
      p_poudre_id: poudreJamaisId, p_type: "pesee", p_valeur_kg: Number(poudre!.stock_kg),
      p_projet_id: null, p_note: "Pesée de test — amélioration n°7", p_lot_numero: null, p_lot_fournisseur: null,
    });
    expect(error).toBeNull();

    const { data } = await sb.rpc("mon_recap_quotidien");
    const p = data as Payload;
    expect(p.risques.pesees.some((x) => x.poudre_id === poudreJamaisId)).toBe(false);
  });

  it("le réglage coupé masque la section même s'il reste une teinte à peser", async () => {
    const nouvelle = await creerPoudreTest("TEST-RAPPEL-COUPE");
    await creerProjetCuit(nouvelle, "Portail avec réglage coupé");

    await sb.from("reglages_alertes").update({ rappel_pesee_actif: false }).eq("atelier_id", ctx.seed.atelierId);
    const { data } = await sb.rpc("mon_recap_quotidien");
    const p = data as Payload;
    expect(p.risques.pesees).toHaveLength(0);

    await sb.from("reglages_alertes").update({ rappel_pesee_actif: true }).eq("atelier_id", ctx.seed.atelierId);
    const relu = await sb.rpc("mon_recap_quotidien");
    expect((relu.data as Payload).risques.pesees.some((x) => x.poudre_id === nouvelle)).toBe(true);
  });
});
