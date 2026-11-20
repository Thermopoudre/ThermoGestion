import path from "node:path";
import { config as chargerEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { contexte } from "./helpers/contexte";

/**
 * Filet de l'audit de sécurité du 07/09/2026 (AUDIT-SECURITE-07-09-2026.md, migration 65).
 *
 * Ce fichier ne prouve pas qu'un mécanisme précis fonctionne — ça, c'est le travail de
 * `securite-rpc.test.ts`, `pieces-jointes.test.ts` et de la suite `roles-rls.test.ts`. Il prouve
 * que la DISCIPLINE tient : quatre règles, vérifiées sur TOUT le schéma `public`, pas seulement
 * sur ce que l'audit a nommé. Un nouvel objet qui en sort — une table posée sans RLS, une vue
 * `create or replace` sans `security_invoker`, une fonction `security definer` sans `search_path`,
 * un `grant` oublié à `anon` — fait rougir ce fichier au prochain lancement, sans attendre le
 * prochain audit manuel.
 *
 *  1. Toute fonction `security definer` de `public` a un `search_path` posé (sinon elle est
 *     rejouable avec un `search_path` empoisonné par qui contrôle un schéma nommé avant `public`).
 *  2. Aucune fonction n'est exécutable par PUBLIC (le pseudo-rôle, pas `authenticated`) : trace du
 *     piège `drop function` + `create` sans `revoke ... from public`, déjà rencontré sur
 *     `signer_devis` (migration 64) puis sur vingt-sept fonctions de plus (migration 65).
 *  3. La liste des fonctions exécutables par `anon` est une liste blanche NOMMÉE, pas une
 *     conséquence de ce qui existe : soit des pages publiques à jeton, soit des aides pures qui ne
 *     lisent aucune table (calcul, formatage, normalisation). Toute fonction anon-exécutable qui
 *     n'y figure pas fait échouer le test — c'est le but.
 *  4. Toute table de `public` a la RLS active, et toute vue porte `security_invoker`.
 *
 * L'instantané vient de `public.audit_privileges_securite()` (migration 65), une fonction
 * `security definer` réservée à `service_role` : PostgREST n'expose pas `pg_catalog`, donc sans
 * elle cette suite ne pourrait vérifier que ce qu'un `select` ordinaire voit — jamais un `grant`.
 *
 * Comme `sieges.test.ts` et `devis-expiration.test.ts` : sans `TEST_SUPABASE_SERVICE_ROLE_KEY`
 * dans `.env.test`, ce fichier est ignoré plutôt que faussement vert (voir `.env.test.example`).
 */

chargerEnv({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });
chargerEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

const CLE_SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function clientService(): SupabaseClient {
  const { url } = contexte();
  return createClient(url, CLE_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Fonction = {
  nom: string;
  args: string;
  security_definer: boolean;
  search_path_pose: boolean;
  anon: boolean;
  authenticated: boolean;
  public: boolean;
};
type Table = { nom: string; rls_active: boolean };
type Vue = { nom: string; security_invoker: boolean };
type Audit = { fonctions: Fonction[]; tables: Table[]; vues: Vue[] };

/**
 * Liste blanche des fonctions exécutables par `anon` — chacune nommée avec sa raison. Relue en
 * base le 07/09/2026, juste après la migration 65 : c'est l'état voulu, pas un copier-coller de
 * ce qui existait avant l'audit (cinq fonctions de métadonnées d'atelier en sont sorties ce
 * jour-là, voir constat 1).
 *
 * Deux familles :
 *  - PAGES PUBLIQUES À JETON : `/d/<jeton>`, `/f/<jeton>`, `/bl/<jeton>`, `/portail/<jeton>`,
 *    `/rc/<jeton>`, `/jantes/<jeton>` et `/signup?invite=<jeton>` — un visiteur sans compte, qui ne
 *    prouve son droit qu'en connaissant le jeton (128 bits d'entropie, vérifié par l'audit).
 *  - AIDES PURES : ne lisent aucune table (ou, pour `nature_operation_deduite`, lisent
 *    `prestations` en respectant la RLS de l'appelant — donc rien pour `anon`, qui n'a accès à
 *    aucune ligne) ; elles ne font que calculer, formater ou normaliser ce qu'on leur passe en
 *    paramètre. Aucune ne prend le rôle ou l'identité de l'appelant en compte.
 */
const ANON_AUTORISEES = new Set<string>([
  // Pages publiques à jeton
  "bl_public", "devis_public", "facture_public", "jeu_jantes_public", "portail_client",
  "portail_liste", "portail_vu", "projet_public", "reception_public", "signer_bl", "signer_devis",
  "signer_jeu_jantes",
  // Invitation (avant création de compte)
  "invitation_correspond", "invitation_publique",
  // Aides pures (calcul/formatage/normalisation, aucune lecture de donnée d'atelier pour anon)
  "_controle_num", "blob_recherche", "capacite_du_plan", "client_est_particulier",
  "devis_echeance", "devis_perime", "echappe_like", "jours_corbeille", "montant_fr",
  "nature_operation_deduite", "niveau_plan", "recherche_globale", "score_recherche",
  "totaux_devis_items", "txt_normalise", "verdict_controle",
  // Auto-référentielles : passent par current_atelier_id(), qui rend null pour anon — sans danger
  // par construction, contrairement à leurs cousines paramétrées par un atelier arbitraire
  // (plan_effectif, sieges_occupes, sieges_autorises, capacite_ouverte, acces_comptables_occupes,
  // limite_utilisateurs : fermées à anon depuis la migration 65, constat 1).
  "ma_capacite", "ma_limite_utilisateurs", "mon_plan",
]);

let audit: Audit;

const avecService = CLE_SERVICE ? describe : describe.skip;

avecService("filet de sécurité (nécessite TEST_SUPABASE_SERVICE_ROLE_KEY)", () => {
  beforeAll(async () => {
    const { data, error } = await clientService().rpc("audit_privileges_securite");
    if (error) throw new Error(`audit_privileges_securite() : ${error.message}`);
    audit = data as Audit;
  });

  it("l'instantané n'est pas vide (sinon les épreuves ci-dessous seraient vides et vertes à tort)", () => {
    expect(audit.fonctions.length).toBeGreaterThan(50);
    expect(audit.tables.length).toBeGreaterThan(20);
    expect(audit.vues.length).toBeGreaterThan(0);
  });

  it("toute fonction security definer a un search_path posé", () => {
    const sansSearchPath = audit.fonctions.filter((f) => f.security_definer && !f.search_path_pose);
    expect(
      sansSearchPath.map((f) => `${f.nom}(${f.args})`),
      "ces fonctions security definer n'ont pas de search_path : rejouables avec un schéma empoisonné",
    ).toEqual([]);
  });

  it("aucune fonction n'est exécutable par PUBLIC", () => {
    const exposeesPublic = audit.fonctions.filter((f) => f.public);
    expect(
      exposeesPublic.map((f) => `${f.nom}(${f.args})`),
      "un `drop function` + `create` sans `revoke ... from public` a rouvert l'exécution à PUBLIC",
    ).toEqual([]);
  });

  it("toute fonction exécutable par anon figure sur la liste blanche nommée", () => {
    const horsListe = audit.fonctions.filter((f) => f.anon && !ANON_AUTORISEES.has(f.nom));
    expect(
      horsListe.map((f) => `${f.nom}(${f.args})`),
      "une fonction anon-exécutable n'est pas dans ANON_AUTORISEES : soit c'est une régression " +
        "(un GRANT à anon ajouté sans réfléchir), soit c'est volontaire — alors nommez-la dans " +
        "la liste blanche ci-dessus avec la raison.",
    ).toEqual([]);
  });

  it("la liste blanche ne contient que des fonctions qui existent et sont réellement anon-exécutables", () => {
    // Symétrique de l'épreuve précédente : une entrée qui traîne après un `revoke` fait croire
    // qu'une porte est ouverte alors qu'elle a été fermée — la liste blanche doit refléter l'état
    // réel de la base, pas son historique.
    const nomsReels = new Set(audit.fonctions.filter((f) => f.anon).map((f) => f.nom));
    const perimees = [...ANON_AUTORISEES].filter((nom) => !nomsReels.has(nom));
    expect(perimees, "entrées de ANON_AUTORISEES qui ne sont plus (ou jamais) anon-exécutables").toEqual([]);
  });

  it("les cinq fonctions de métadonnées d'atelier (constat 1) ne sont plus anon-exécutables", () => {
    const noms = ["plan_effectif", "sieges_occupes", "sieges_autorises", "capacite_ouverte", "acces_comptables_occupes", "limite_utilisateurs"];
    for (const nom of noms) {
      const f = audit.fonctions.find((x) => x.nom === nom);
      expect(f, `${nom} devrait exister`).toBeDefined();
      expect(f!.anon, `${nom} ne devrait plus être exécutable par anon`).toBe(false);
      expect(f!.authenticated, `${nom} doit rester exécutable par authenticated`).toBe(true);
    }
  });

  it("toute table de public a la RLS active", () => {
    const sansRls = audit.tables.filter((t) => !t.rls_active);
    expect(sansRls.map((t) => t.nom), "ces tables n'ont pas la RLS active").toEqual([]);
  });

  it("toute vue de public porte security_invoker", () => {
    const sansInvoker = audit.vues.filter((v) => !v.security_invoker);
    expect(
      sansInvoker.map((v) => v.nom),
      "ces vues n'ont pas security_invoker : elles traverseraient la RLS avec les droits de leur propriétaire",
    ).toEqual([]);
  });
});
