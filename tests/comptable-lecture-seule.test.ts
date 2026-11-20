import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientAnonyme, clientConnecte, contexte, nb } from "./helpers/contexte";
import { ACCES_COMPTABLES_INCLUS, LIBELLE_ROLE, ROLES, estComptable, refusDeRole } from "@/lib/roles";
import { etatReglement, libellePeriode, periodeParDefaut, periodesProposees } from "@/lib/comptable";

/**
 * L'accès expert-comptable, attaqué depuis un vrai jeton.
 *
 * Ce fichier ne regarde aucun écran et ne fait confiance à aucun code de retour. Il ouvre une
 * session de comptable dans l'atelier jetable et lui fait faire ce qu'un cabinet curieux — ou une
 * console de navigateur laissée ouverte chez un client — pourrait faire : lire les tables une par
 * une, écrire dans une dizaine d'entre elles, appeler les fonctions du produit.
 *
 * Deux règles de méthode, sans lesquelles ce fichier ne prouverait rien :
 *
 *  1. **On relit l'état après coup, avec le compte du responsable.** Sans policy d'UPDATE ou de
 *     DELETE, PostgREST répond 204 en n'ayant rien touché : un test qui se contente de vérifier
 *     `error` valide un verrou inexistant dans un sens et échoue sur un verrou qui marche dans
 *     l'autre. Ici, la question posée est toujours « la ligne a-t-elle bougé ? ».
 *  2. **Le comptable est retiré en fin de fichier.** `sieges.test.ts` et `droits-formules.test.ts`
 *     comptent les places, et un compte oublié les ferait échouer sans rapport.
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

const ctx = () => contexte();
const patron = () => clientConnecte();
const anon = () => clientAnonyme();

function adresse(suffixe: string): string {
  const base = process.env.TEST_USER_EMAIL;
  if (!base) throw new Error("TEST_USER_EMAIL manquant — voir TESTS.md.");
  const [locale, domaine] = base.split("@");
  return `${locale}+${suffixe}@${domaine}`;
}

const EMAIL_COMPTABLE = adresse("role-comptable");
const EMAIL_COMPTABLE_2 = adresse("role-comptable2");
const EMAIL_COMPTABLE_3 = adresse("role-comptable3");

let cabinet: SupabaseClient;
let cabinetId = "";
let factureId = "";
let paiementId = "";
let clientId = "";
/** Période sur laquelle porte tout le fichier : le mois clos précédent, comme le produit. */
const P = periodeParDefaut();

async function rejoindreCommeComptable(): Promise<{ sb: SupabaseClient; id: string }> {
  const { url, anonKey, seed } = ctx();
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error("TEST_USER_PASSWORD manquant — voir TESTS.md.");

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let session = (await auth.auth.signInWithPassword({ email: EMAIL_COMPTABLE, password })).data.session;
  if (!session) {
    const inscription = await auth.auth.signUp({ email: EMAIL_COMPTABLE, password });
    if (inscription.error) throw new Error(`inscription ${EMAIL_COMPTABLE} : ${inscription.error.message}`);
    session = inscription.data.session;
  }
  if (!session) throw new Error(`aucun jeton pour ${EMAIL_COMPTABLE} (confirmation d'e-mail activée ?)`);

  const sb = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const { data: deja } = await sb.from("users").select("atelier_id, role").eq("id", session.user.id).maybeSingle();
  if (deja) {
    if (deja.atelier_id !== seed.atelierId) {
      throw new Error(`${EMAIL_COMPTABLE} appartient déjà à un autre atelier — refus d'exécuter le fichier.`);
    }
  } else {
    const { data: inv, error: errInv } = await patron()
      .from("invitations")
      .insert({ atelier_id: seed.atelierId, email: EMAIL_COMPTABLE, role: "comptable" })
      .select("token")
      .single();
    if (errInv) throw new Error(`invitation comptable : ${errInv.message}`);
    const { error: errAccept } = await sb.rpc("accept_invitation", { p_token: (inv as { token: string }).token });
    if (errAccept) throw new Error(`accept_invitation comptable : ${errAccept.message}`);
  }
  return { sb, id: session.user.id };
}

beforeAll(async () => {
  const { seed } = ctx();
  clientId = seed.clientSimpleId;

  // Une facture émise et à moitié réglée, datée dans la période testée : sans pièce à voir,
  // « le comptable ne voit rien » serait vrai pour tout le monde et ne prouverait rien.
  const { data: f, error: errF } = await patron()
    .from("factures")
    .insert({
      atelier_id: seed.atelierId,
      client_id: clientId,
      type: "libre",
      status: "brouillon",
      numero: "FA-C7-0001",
      items: [{ designation: "Thermolaquage RAL 9005", quantite: 1, prix_unitaire_ht: 200, total_ht: 200, tva: 20 }],
      total_ht: 200,
      total_tva: 40,
      total_ttc: 240,
      nature_operation: "services",
    })
    .select("id")
    .single();
  if (errF) throw new Error(`facture du fichier comptable : ${errF.message}`);
  factureId = (f as { id: string }).id;

  // On l'émet en second temps : le passage en « émise » fige la pièce et pose son numéro.
  const { error: errEmise } = await patron()
    .from("factures")
    .update({ status: "emise", emise_at: `${P.debut}T10:00:00Z` })
    .eq("id", factureId);
  if (errEmise) throw new Error(`émission de la facture : ${errEmise.message}`);

  const { data: p, error: errP } = await patron()
    .from("paiements")
    .insert({
      atelier_id: seed.atelierId, facture_id: factureId, montant: 100,
      moyen: "virement", paye_at: `${P.debut}T12:00:00Z`,
    })
    .select("id")
    .single();
  if (errP) throw new Error(`paiement du fichier comptable : ${errP.message}`);
  paiementId = (p as { id: string }).id;

  const compte = await rejoindreCommeComptable();
  cabinet = compte.sb;
  cabinetId = compte.id;
}, 120_000);

afterAll(async () => {
  if (cabinetId) await patron().from("users").delete().eq("id", cabinetId);
  await patron().from("invitations").delete().in("email", [EMAIL_COMPTABLE, EMAIL_COMPTABLE_2, EMAIL_COMPTABLE_3]);
  if (paiementId) await patron().from("paiements").delete().eq("id", paiementId);
  if (factureId) await patron().from("factures").delete().eq("id", factureId);
  await patron().from("exports_comptables").delete().eq("atelier_id", ctx().seed.atelierId);
  await patron().from("reglages_comptable").delete().eq("atelier_id", ctx().seed.atelierId);
});

// ── Le vocabulaire et les périodes ────────────────────────────────────────────

describe("Le rôle et ce qu'il annonce", () => {
  it("le barème compte quatre rôles, dont le comptable", () => {
    expect(ROLES).toContain("comptable");
    expect(estComptable("comptable")).toBe(true);
    expect(estComptable("bureau")).toBe(false);
    expect(LIBELLE_ROLE.comptable.phrase).toMatch(/lecture seule/i);
    // Le mot « gratuit » n'est pas décoratif : c'est la décision commerciale du chantier, et
    // l'exploitant doit la lire au moment où il coche la case.
    expect(LIBELLE_ROLE.comptable.phrase).toMatch(/gratuit/i);
  });

  it("le comptable n'a qu'une seule adresse, et les autres rôles n'y perdent rien", () => {
    for (const p of ["/dashboard", "/projets", "/factures", "/devis", "/reglages", "/stock"]) {
      expect(refusDeRole(p, "comptable"), p).toBe("hors_perimetre_comptable");
    }
    expect(refusDeRole("/comptable", "comptable")).toBeNull();
    expect(refusDeRole("/comptable", "owner")).toBeNull();
    expect(refusDeRole("/comptable", "bureau")).toBeNull();
    // L'opérateur n'a rien à faire dans les pièces comptables.
    expect(refusDeRole("/comptable", "atelier")).toBe("commercial");
  });

  it("les périodes proposées sont closes, et se nomment", () => {
    const aujourdhui = new Date(2026, 7, 20); // 20 août 2026
    const liste = periodesProposees(aujourdhui);
    // Aucune période ne peut déborder sur le mois en cours : un journal tiré du mois courant
    // serait faux dès le lendemain, et le cabinet devrait le redemander.
    for (const p of liste) expect(p.fin < "2026-08-01", p.libelle).toBe(true);
    expect(liste[0].libelle).toBe("juillet 2026");
    // Le trimestre en cours (T3 2026, juillet-septembre) ne doit jamais être proposé, et la
    // remontée doit franchir le changement d'année sans se répéter.
    const trimestres = liste.filter((p) => p.libelle.startsWith("T")).map((p) => p.libelle);
    expect(trimestres).toEqual(["T2 2026", "T1 2026", "T4 2025", "T3 2025"]);
    expect(libellePeriode("2026-07-01", "2026-07-31")).toBe("juillet 2026");
    expect(libellePeriode("2026-04-01", "2026-06-30")).toBe("T2 2026");
    expect(libellePeriode("2025-01-01", "2025-12-31")).toBe("Exercice 2025");
    expect(libellePeriode("2026-02-01", "2026-02-29")).toBe("du 01/02/2026 au 29/02/2026");
    expect(libellePeriode("2024-02-01", "2024-02-29")).toBe("février 2024");
  });

  it("l'état de règlement se lit d'un coup d'œil", () => {
    expect(etatReglement(240, 240)).toBe("payee");
    expect(etatReglement(240, 100)).toBe("partielle");
    expect(etatReglement(240, 0)).toBe("attente");
  });
});

// ── Ce que le cabinet voit ────────────────────────────────────────────────────

describe("Ce que le comptable voit", () => {
  it("le journal des ventes lui rend la pièce, son client et son règlement", async () => {
    const { data, error } = await cabinet.rpc("journal_ventes", { p_debut: P.debut, p_fin: P.fin });
    expect(error).toBeNull();
    const lignes = (data ?? []) as { id: string; total_ttc: number | string; regle_ttc: number | string; client: { nom: string } | null }[];
    const mienne = lignes.find((l) => l.id === factureId);
    expect(mienne, "la facture émise doit apparaître dans le journal").toBeTruthy();
    expect(nb(mienne!.total_ttc)).toBe(240);
    expect(nb(mienne!.regle_ttc)).toBe(100);
    expect(mienne!.client?.nom).toBeTruthy();
  });

  it("le journal ne rend jamais un brouillon", async () => {
    const { seed } = ctx();
    const { data: b } = await patron()
      .from("factures")
      .insert({
        atelier_id: seed.atelierId, client_id: clientId, type: "libre", status: "brouillon",
        items: [], total_ht: 999, total_tva: 0, total_ttc: 999,
      })
      .select("id")
      .single();
    const brouillonId = (b as { id: string } | null)?.id;
    const { data } = await cabinet.rpc("journal_ventes", { p_debut: P.debut, p_fin: P.fin });
    const ids = ((data ?? []) as { id: string }[]).map((l) => l.id);
    expect(ids).not.toContain(brouillonId);
    if (brouillonId) await patron().from("factures").delete().eq("id", brouillonId);
  });

  it("l'en-tête lui donne le SIREN — et rien du four ni du prix du kWh", async () => {
    const { data, error } = await cabinet.rpc("entete_comptable");
    expect(error).toBeNull();
    const e = data as Record<string, unknown> | null;
    expect(e?.siren).toBe("900123456");
    expect(Object.keys(e ?? {}).sort()).toEqual(["nom", "siren", "siret", "ville"]);
  });

  it("il lit sa propre ligne, mais pas l'équipe", async () => {
    const { data: moi } = await cabinet.from("users").select("id, role").maybeSingle();
    expect(moi?.role).toBe("comptable");
    const { data: tous } = await cabinet.from("users").select("id");
    expect((tous ?? []).length, "il ne doit voir que lui-même").toBe(1);
  });
});

// ── Ce que le cabinet ne voit pas ─────────────────────────────────────────────

describe("Ce que le comptable ne voit pas", () => {
  /**
   * Le verrou est structurel : `current_atelier_id()` ne rend rien à un comptable, donc toutes
   * les policies bâties sur elle refusent. On l'éprouve table par table plutôt que de faire
   * confiance au raisonnement — c'est exactement le genre de raisonnement juste qui devient faux
   * le jour où quelqu'un écrit une policy avec une autre fonction.
   */
  const FERMEES = [
    "factures", "devis", "projets", "clients", "paiements", "poudres", "poudre_couts",
    "poudre_lots", "poudre_lot_couts", "ateliers", "ateliers_bancaire", "ateliers_couts",
    "grilles_tarifaires", "grille_paliers", "prestations", "tarifs_ml", "client_tarifs",
    "receptions", "bons_livraison", "fournees", "controles", "stock_mouvements",
    "audit_logs", "subscriptions", "notifications", "relances", "invitations",
    "jeux_jantes", "jantes", "temps_etapes",
  ];

  it.each(FERMEES)("« %s » ne lui rend aucune ligne", async (table) => {
    const { data, error } = await cabinet.from(table).select("*").limit(5);
    // Une erreur serait acceptable ; zéro ligne l'est aussi. Ce qui ne l'est pas, c'est une ligne.
    expect(error ? [] : data ?? []).toHaveLength(0);
  });

  it("les fonctions du produit ne lui rendent rien non plus", async () => {
    const { data: abo } = await cabinet.rpc("mon_abonnement");
    expect(abo ?? null).toBeNull();
    const { data: corbeille } = await cabinet.rpc("corbeille");
    expect(corbeille ?? []).toHaveLength(0);
    // `plan_effectif` et `sieges_occupes` se gardaient par « current_atelier_id() is null »,
    // branche prévue pour l'invité qui n'a pas encore d'atelier. Le comptable y tombait, et
    // pouvait interroger le plan de n'importe quel atelier en devinant un identifiant.
    const autreAtelier = "00000000-0000-0000-0000-0000000000ff";
    const { data: sieges } = await cabinet.rpc("sieges_occupes", { p_atelier: autreAtelier });
    expect(nb(sieges)).toBe(0);
  });
});

// ── Ce que le cabinet ne peut pas écrire ──────────────────────────────────────

describe("Lecture seule, vérifiée sur l'état et non sur le code de retour", () => {
  it("aucune écriture ne passe, sur aucune des tables attaquées", async () => {
    const { seed } = ctx();
    const cibles: { table: string; ligne: Record<string, unknown> }[] = [
      { table: "clients", ligne: { atelier_id: seed.atelierId, nom: "PIRATE-COMPTABLE", type: "pro" } },
      { table: "factures", ligne: { atelier_id: seed.atelierId, client_id: clientId, type: "libre", status: "brouillon", items: [], total_ht: 1, total_tva: 0, total_ttc: 1 } },
      { table: "devis", ligne: { atelier_id: seed.atelierId, client_id: clientId, status: "brouillon", items: [] } },
      { table: "paiements", ligne: { atelier_id: seed.atelierId, facture_id: factureId, montant: 1, moyen: "especes", paye_at: new Date().toISOString() } },
      { table: "projets", ligne: { atelier_id: seed.atelierId, client_id: clientId, nom: "PIRATE-COMPTABLE" } },
      { table: "poudres", ligne: { atelier_id: seed.atelierId, marque: "PIRATE", reference: "PIRATE-1", ral: "9005", finition: "mat", rendement_m2_kg: 8, stock_kg: 0 } },
      { table: "poudre_couts", ligne: { atelier_id: seed.atelierId, poudre_id: seed.poudreId, prix_kg: 1 } },
      { table: "ateliers_bancaire", ligne: { atelier_id: seed.atelierId, iban: "FR0000000000000000000000000", bic: "PIRATEXX" } },
      { table: "ateliers_couts", ligne: { atelier_id: seed.atelierId, taux_horaire: 1, frais_generaux_pct: 0 } },
      { table: "prestations", ligne: { atelier_id: seed.atelierId, code: "pirate", libelle: "PIRATE", unite: "piece", prix_unitaire_ht: 1 } },
      { table: "invitations", ligne: { atelier_id: seed.atelierId, email: "pirate@test.invalid", role: "owner" } },
      { table: "exports_comptables", ligne: { atelier_id: seed.atelierId, periode_debut: P.debut, periode_fin: P.fin, format: "fec" } },
      { table: "reglages_comptable", ligne: { atelier_id: seed.atelierId, cadence: "mensuelle", destinataire_email: "pirate@test.invalid" } },
    ];

    for (const { table, ligne } of cibles) {
      await cabinet.from(table).insert(ligne);
    }

    // La vérification, avec le compte du responsable : c'est le seul point de vue depuis lequel
    // « la ligne n'existe pas » veut dire quelque chose.
    const { count: nbClients } = await patron()
      .from("clients").select("id", { count: "exact", head: true }).eq("nom", "PIRATE-COMPTABLE");
    expect(nbClients ?? 0, "un client a été créé par le comptable").toBe(0);
    const { count: nbProjets } = await patron()
      .from("projets").select("id", { count: "exact", head: true }).eq("nom", "PIRATE-COMPTABLE");
    expect(nbProjets ?? 0).toBe(0);
    const { count: nbPoudres } = await patron()
      .from("poudres").select("id", { count: "exact", head: true }).eq("reference", "PIRATE-1");
    expect(nbPoudres ?? 0).toBe(0);
    const { count: nbPrestations } = await patron()
      .from("prestations").select("id", { count: "exact", head: true }).eq("code", "pirate");
    expect(nbPrestations ?? 0).toBe(0);
    const { count: nbInvitations } = await patron()
      .from("invitations").select("id", { count: "exact", head: true }).eq("email", "pirate@test.invalid");
    expect(nbInvitations ?? 0, "une invitation « owner » posée par le comptable serait une élévation de privilège").toBe(0);
    const { count: nbExports } = await patron()
      .from("exports_comptables").select("id", { count: "exact", head: true });
    expect(nbExports ?? 0).toBe(0);
    const { count: nbReglages } = await patron()
      .from("reglages_comptable").select("atelier_id", { count: "exact", head: true });
    expect(nbReglages ?? 0).toBe(0);

    const { data: banque } = await patron()
      .from("ateliers_bancaire").select("iban").eq("atelier_id", seed.atelierId).maybeSingle();
    expect(banque?.iban, "l'IBAN de l'atelier a été réécrit").toBe("FR7630001007941234567890185");
  });

  it("aucune modification ne passe non plus", async () => {
    const { seed } = ctx();
    await cabinet.from("factures").update({ total_ttc: 1, status: "brouillon" }).eq("id", factureId);
    await cabinet.from("clients").update({ nom: "RENOMMÉ PAR LE COMPTABLE" }).eq("id", clientId);
    await cabinet.from("paiements").update({ montant: 999 }).eq("id", paiementId);
    await cabinet.from("ateliers").update({ nom: "RENOMMÉ" }).eq("id", seed.atelierId);
    await cabinet.from("users").update({ role: "owner" }).eq("id", cabinetId);

    const { data: f } = await patron().from("factures").select("total_ttc, status").eq("id", factureId).maybeSingle();
    expect(nb(f?.total_ttc)).toBe(240);
    expect(f?.status).toBe("emise");
    const { data: c } = await patron().from("clients").select("nom").eq("id", clientId).maybeSingle();
    expect(c?.nom).not.toBe("RENOMMÉ PAR LE COMPTABLE");
    const { data: pay } = await patron().from("paiements").select("montant").eq("id", paiementId).maybeSingle();
    expect(nb(pay?.montant)).toBe(100);
    const { data: a } = await patron().from("ateliers").select("nom").eq("id", seed.atelierId).maybeSingle();
    expect(a?.nom).toMatch(/^TEST-AUTO-/);
    // L'auto-promotion est le pire des cas : `users_update_self` autorise un membre à écrire sa
    // propre ligne, et seul `trg_garde_role` empêche qu'il s'y nomme responsable.
    const { data: moi } = await patron().from("users").select("role").eq("id", cabinetId).maybeSingle();
    expect(moi?.role, "le comptable s'est promu responsable").toBe("comptable");
  });

  it("aucune suppression ne passe", async () => {
    await cabinet.from("factures").delete().eq("id", factureId);
    await cabinet.from("paiements").delete().eq("id", paiementId);
    await cabinet.from("clients").delete().eq("id", clientId);

    const { count: f } = await patron().from("factures").select("id", { count: "exact", head: true }).eq("id", factureId);
    expect(f ?? 0).toBe(1);
    const { count: p } = await patron().from("paiements").select("id", { count: "exact", head: true }).eq("id", paiementId);
    expect(p ?? 0).toBe(1);
    const { count: c } = await patron().from("clients").select("id", { count: "exact", head: true }).eq("id", clientId);
    expect(c ?? 0).toBe(1);
  });

  it("les fonctions d'écriture du produit lui sont fermées", async () => {
    // Une policy ne protège pas d'une RPC `SECURITY DEFINER` : celles-ci travaillent avec les
    // droits de leur propriétaire. Elles se gardent toutes par `current_atelier_id()`, qui ne
    // rend rien au comptable — mais c'est une propriété qu'il faut éprouver, pas déduire.
    const { count: avant } = await patron().from("factures").select("id", { count: "exact", head: true });

    await cabinet.rpc("mettre_a_la_corbeille", { p_entite: "facture", p_id: factureId });
    await cabinet.rpc("next_numero", { p_type: "facture" });
    await cabinet.rpc("dupliquer_facture", { p_id: factureId });
    await cabinet.rpc("annuler_facture", { p_id: factureId, p_motif: "PIRATE" });

    const { data: f } = await patron()
      .from("factures").select("status, deleted_at, motif_annulation").eq("id", factureId).maybeSingle();
    expect(f?.status).toBe("emise");
    expect(f?.deleted_at ?? null).toBeNull();
    expect(f?.motif_annulation ?? null).toBeNull();
    // Aucune facture en trop : la duplication aurait créé un brouillon.
    const { count: apres } = await patron().from("factures").select("id", { count: "exact", head: true });
    expect(apres ?? 0).toBe(avant ?? 0);
  });

  it("le programmateur d'envois ne s'appelle pas depuis PostgREST", async () => {
    const { error } = await cabinet.rpc("programmer_exports_comptables");
    expect(error, "un compte applicatif ne doit pas pouvoir déclencher les envois").not.toBeNull();
    const { error: errPatron } = await patron().rpc("programmer_exports_comptables");
    expect(errPatron).not.toBeNull();
  });
});

// ── Le siège ──────────────────────────────────────────────────────────────────

describe("L'accès du cabinet ne consomme aucun siège", () => {
  it("le comptable est hors du décompte, utilisateurs et invitations comprises", async () => {
    const { data: avant } = await patron().rpc("mes_sieges");
    const occupesAvant = nb((avant as { occupes: number }).occupes);

    // Le comptable est déjà entré dans `beforeAll` : il ne doit apparaître nulle part dans le
    // compte. On le prouve en comparant au nombre de membres non comptables.
    const { data: membres } = await patron()
      .from("users").select("id, role, actif").eq("atelier_id", ctx().seed.atelierId);
    const internesActifs = ((membres ?? []) as { role: string; actif: boolean }[])
      .filter((m) => m.actif && m.role !== "comptable").length;
    const { data: invs } = await patron()
      .from("invitations").select("role, accepted_at, expires_at").is("accepted_at", null);
    const invitationsInternes = ((invs ?? []) as { role: string; expires_at: string }[])
      .filter((i) => i.role !== "comptable" && new Date(i.expires_at).getTime() > Date.now()).length;
    expect(occupesAvant).toBe(internesActifs + invitationsInternes);

    // Et une invitation de comptable de plus n'ajoute toujours rien au compteur payant.
    const { error } = await patron()
      .from("invitations")
      .insert({ atelier_id: ctx().seed.atelierId, email: EMAIL_COMPTABLE_2, role: "comptable" });
    expect(error, "l'invitation d'un cabinet ne doit jamais buter sur les sièges").toBeNull();
    const { data: apres } = await patron().rpc("mes_sieges");
    expect(nb((apres as { occupes: number }).occupes)).toBe(occupesAvant);
  });

  it("gratuit ne veut pas dire illimité : le plafond tient", async () => {
    // Un accès gratuit en lecture sur la facturation est un substitut acceptable au siège
    // « bureau » pour qui ne fait que consulter. Le plafond ferme la substitution.
    const { error } = await patron()
      .from("invitations")
      .insert({ atelier_id: ctx().seed.atelierId, email: EMAIL_COMPTABLE_3, role: "comptable" });
    expect(error, "le troisième accès comptable doit être refusé").not.toBeNull();
    expect(String(error?.message ?? "") + String(error?.hint ?? "")).toMatch(/COMPTABLES_PLAFOND|accès comptables/i);

    const { count } = await patron()
      .from("invitations").select("id", { count: "exact", head: true }).eq("email", EMAIL_COMPTABLE_3);
    expect(count ?? 0).toBe(0);
    expect(ACCES_COMPTABLES_INCLUS).toBe(2);

    // Nettoyage immédiat : les fichiers suivants comptent les invitations vives.
    await patron().from("invitations").delete().eq("email", EMAIL_COMPTABLE_2);
  });
});

// ── La trace des remises et l'invitation ──────────────────────────────────────

describe("« Exercice remis le … »", () => {
  it("le téléchargement laisse une trace, lisible par les deux côtés", async () => {
    const { data: id, error } = await cabinet.rpc("tracer_export_comptable", {
      p_debut: P.debut, p_fin: P.fin, p_format: "fec", p_nb: 1, p_total_ht: 200,
    });
    expect(error).toBeNull();
    expect(id).toBeTruthy();

    const { data: vueCabinet } = await cabinet
      .from("exports_comptables").select("periode_fin, format, role_demandeur, nb_factures").eq("id", id);
    expect((vueCabinet ?? []).length, "le cabinet doit relire ce qu'il a déjà emporté").toBe(1);
    expect((vueCabinet as { role_demandeur: string }[])[0].role_demandeur).toBe("comptable");

    const { data: vuePatron } = await patron().from("exports_comptables").select("id").eq("id", id);
    expect((vuePatron ?? []).length, "l'atelier doit voir ce qui est parti chez son cabinet").toBe(1);

    // La trace elle-même reste inaltérable : elle répond à la question « vous l'ai-je envoyé ? ».
    await cabinet.from("exports_comptables").update({ nb_factures: 999 }).eq("id", id);
    await cabinet.from("exports_comptables").delete().eq("id", id);
    const { data: apres } = await patron()
      .from("exports_comptables").select("nb_factures").eq("id", id).maybeSingle();
    expect(nb(apres?.nb_factures)).toBe(1);
  });

  it("la cadence se règle côté atelier, et se lit côté cabinet", async () => {
    const { seed } = ctx();
    const { error } = await patron().from("reglages_comptable").upsert({
      atelier_id: seed.atelierId, cadence: "trimestrielle", format: "fec",
      destinataire_email: EMAIL_COMPTABLE, jour_du_mois: 5,
    });
    expect(error).toBeNull();

    const { data: lu } = await cabinet
      .from("reglages_comptable").select("cadence, jour_du_mois").maybeSingle();
    expect(lu?.cadence, "le cabinet doit connaître son échéance").toBe("trimestrielle");

    await cabinet.from("reglages_comptable").update({ cadence: "aucune" }).eq("atelier_id", seed.atelierId);
    const { data: apres } = await patron()
      .from("reglages_comptable").select("cadence").eq("atelier_id", seed.atelierId).maybeSingle();
    expect(apres?.cadence, "le cabinet a désactivé son propre envoi").toBe("trimestrielle");
  });
});

describe("L'invitation dit de qui elle vient", () => {
  it("un jeton vivant s'annonce, même sans compte", async () => {
    const { data: inv } = await patron()
      .from("invitations")
      .insert({ atelier_id: ctx().seed.atelierId, email: EMAIL_COMPTABLE_2, role: "comptable" })
      .select("token")
      .single();
    const token = (inv as { token: string }).token;

    const { data, error } = await anon().rpc("invitation_publique", { p_token: token });
    expect(error).toBeNull();
    const vue = data as { atelier_nom: string; role: string } | null;
    expect(vue?.role).toBe("comptable");
    expect(vue?.atelier_nom).toMatch(/^TEST-AUTO-/);

    // Un jeton inventé ne dit rien : sans ça, la fonction deviendrait un annuaire d'ateliers.
    const { data: rien } = await anon().rpc("invitation_publique", { p_token: "0".repeat(32) });
    expect(rien ?? null).toBeNull();

    // Et la fonction ne laisse pas fuiter la table : l'anonyme ne lit toujours rien.
    const { data: table, error: errTable } = await anon().from("invitations").select("token");
    expect(errTable ? [] : table ?? []).toHaveLength(0);

    await patron().from("invitations").delete().eq("email", EMAIL_COMPTABLE_2);
  });

  it("les deux tables du chantier sont fermées au visiteur anonyme", async () => {
    // Supabase accorde SELECT et INSERT à `anon` sur tout le schéma public : ce qui ferme, c'est
    // l'absence de policy, et une table créée sans `enable row level security` serait grande
    // ouverte tout en ayant l'air protégée.
    for (const table of ["exports_comptables", "reglages_comptable"]) {
      const { data, error } = await anon().from(table).select("*");
      expect(error ? [] : data ?? [], table).toHaveLength(0);
    }
    const { count: avant } = await patron().from("exports_comptables").select("id", { count: "exact", head: true });
    await anon()
      .from("exports_comptables")
      .insert({ atelier_id: ctx().seed.atelierId, periode_debut: P.debut, periode_fin: P.fin, format: "fec" });
    const { count: apres } = await patron().from("exports_comptables").select("id", { count: "exact", head: true });
    expect(apres ?? 0, "un visiteur anonyme a écrit dans le journal des remises").toBe(avant ?? 0);
  });
});
