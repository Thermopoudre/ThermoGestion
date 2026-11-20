import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTA_PAR_PLAN, quotaDuJour } from "@/lib/assistant/config";
import { journaliser, quotaDepasse } from "@/lib/assistant/journal";
import { outilsPourRole } from "@/lib/assistant/outils";
import { STATUT_HTTP, refusPourRole } from "@/lib/assistant/securite";

/**
 * F2 (le quota) et F6 (la sécurité), éprouvés SANS session, SANS base et SANS appel au modèle —
 * même méthode que `assistant-outils.test.ts`.
 *
 * Deux décisions de la route (`src/app/api/assistant/route.ts`) ne peuvent PAS se tester ainsi
 * telles quelles : elle ouvre `createClient()`, qui lit les cookies de la requête, et elle
 * n'existe qu'une fois authentifiée. C'est pour ça que `refusPourRole()` (comptable → 403) a été
 * sortie dans `securite.ts` — c'est CETTE fonction que la route appelle mot pour mot, donc la
 * tester ici prouve ce que fait la route, sans en rejouer l'enveloppe HTTP.
 */

// ─────────────────────────────────────────────────────────────────────────────────────────────
// F6 — la route refuse le comptable, un opérateur ne reçoit pas les outils commerciaux
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("F6 — le cabinet comptable n'obtient jamais de réponse de l'assistant", () => {
  it("refusePourRole('comptable') renvoie un refus « hors_perimetre », mappé sur 403", () => {
    const refus = refusPourRole("comptable");
    expect(refus).not.toBeNull();
    expect(refus?.code).toBe("hors_perimetre");
    expect(STATUT_HTTP[refus!.code]).toBe(403);
    // Le message est celui lu par le cabinet : jamais de jargon (« RLS », « atelier_id »).
    expect(refus?.message).not.toMatch(/RLS|atelier_id|SQL/i);
  });

  it("aucun autre rôle connu n'est bloqué par ce guichet", () => {
    for (const role of ["owner", "bureau", "atelier", null, undefined, "staff"]) {
      expect(refusPourRole(role)).toBeNull();
    }
  });
});

describe("F6 — un opérateur d'atelier ne reçoit jamais les outils commerciaux", () => {
  it("outilsPourRole('atelier') ne contient aucun outil à périmètre commercial", () => {
    const COMMERCIAUX = [
      "devis_sans_reponse", "factures_echues", "chiffre_affaires_periode",
      "devis_signes_non_produits", "clients_dormants", "rentabilite_client", "rentabilite_projet",
    ];
    const noms = outilsPourRole("atelier").map((o) => o.nom);
    for (const c of COMMERCIAUX) expect(noms).not.toContain(c);
    // Chaque outil rendu porte lui-même `perimetre: "production"` : la liste n'est pas filtrée
    // par accident, elle l'est par construction.
    for (const o of outilsPourRole("atelier")) expect(o.perimetre).toBe("production");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// F6 — la question est journalisée, jamais la réponse
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("F6 — le journal ne conserve jamais le texte rédigé par le modèle", () => {
  it("l'objet inséré ne porte QUE les colonnes documentées — jamais un texte de réponse", async () => {
    let insere: Record<string, unknown> | null = null;
    const sb = {
      from(table: string) {
        expect(table).toBe("assistant_journal");
        return {
          insert(valeurs: Record<string, unknown>) {
            insere = valeurs;
            return Promise.resolve({ error: null });
          },
        };
      },
    } as unknown as SupabaseClient;

    await journaliser(sb, {
      question: "qui me doit de l'argent ?",
      outils: [{ outil: "factures_echues", parametres: { jours_de_retard_min: 1 }, lignes: 3 }],
      modele: "claude-haiku-4-5",
      cout_eur: 0.004,
      jetons_entree: 5000,
      jetons_sortie: 300,
    });

    expect(insere).not.toBeNull();
    // La liste exacte des colonnes de la migration 60 — rien de plus. En particulier, ni
    // « reponse », ni « texte », ni « answer » : le journal constate une question posée et ce qui
    // a été lu pour y répondre, jamais ce qui a été RÉDIGÉ.
    expect(Object.keys(insere!).sort()).toEqual(
      ["question", "outils", "modele", "cout_eur", "jetons_in", "jetons_out", "erreur"].sort(),
    );
    expect(insere).not.toHaveProperty("reponse");
    expect(insere).not.toHaveProperty("texte");
  });

  it("même en cas d'échec, seul le CODE d'erreur est journalisé, jamais un message de réponse", async () => {
    let insere: Record<string, unknown> | null = null;
    const sb = {
      from() {
        return { insert: (v: Record<string, unknown>) => { insere = v; return Promise.resolve({ error: null }); } };
      },
    } as unknown as SupabaseClient;

    await journaliser(sb, {
      question: "une question quelconque",
      outils: [], modele: null, cout_eur: 0, erreur: "erreur_modele",
    });
    expect(insere).not.toBeNull();
    expect(insere!.erreur).toBe("erreur_modele");
    expect(insere!.modele).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// F2 — le quota, par formule, et la fonction de comparaison
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("F2 — le quota de questions par jour suit la formule", () => {
  it("10 en Atelier, 30 en Équipe, 60 en Certifié, et Atelier sert de repli", () => {
    expect(QUOTA_PAR_PLAN).toEqual({ atelier: 10, equipe: 30, certifie: 60 });
    expect(quotaDuJour("atelier")).toBe(10);
    expect(quotaDuJour("equipe")).toBe(30);
    expect(quotaDuJour("certifie")).toBe(60);
    // Repli : formule inconnue, absente, vide ou nulle.
    expect(quotaDuJour(null)).toBe(10);
    expect(quotaDuJour(undefined)).toBe(10);
    expect(quotaDuJour("")).toBe(10);
    expect(quotaDuJour("formule-inexistante")).toBe(10);
  });

  it("quotaDepasse compare au plafond RÉELLEMENT applicable, pas à une constante unique", () => {
    expect(quotaDepasse(9, quotaDuJour("atelier"))).toBe(false);
    expect(quotaDepasse(10, quotaDuJour("atelier"))).toBe(true);
    // Un atelier en formule Équipe n'est pas encore au plafond à la 10e question.
    expect(quotaDepasse(10, quotaDuJour("equipe"))).toBe(false);
    expect(quotaDepasse(60, quotaDuJour("certifie"))).toBe(true);
    // Compteur indisponible (table absente, panne de la fonction) : jamais de faux refus.
    expect(quotaDepasse(null, quotaDuJour("atelier"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// F6 — ANTHROPIC_API_KEY n'apparaît nulle part sous src/ hors de son unique lecture serveur
// ─────────────────────────────────────────────────────────────────────────────────────────────

describe("F6 — la clé d'API n'atteint jamais le navigateur", () => {
  const RACINE_SRC = join(process.cwd(), "src");

  function fichiers(dossier: string): string[] {
    const trouves: string[] = [];
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      const info = statSync(chemin);
      if (info.isDirectory()) trouves.push(...fichiers(chemin));
      else if (/\.(ts|tsx|js|jsx)$/.test(entree)) trouves.push(chemin);
    }
    return trouves;
  }

  const TOUS_LES_FICHIERS = fichiers(RACINE_SRC);

  it("aucune valeur de clé (sk-ant-…) n'est écrite en dur où que ce soit sous src/", () => {
    const suspects = TOUS_LES_FICHIERS.filter((f) => /sk-ant-[a-zA-Z0-9_-]{6,}/.test(readFileSync(f, "utf8")));
    expect(suspects).toEqual([]);
  });

  it("seul `lib/assistant/config.ts` LIT `process.env.ANTHROPIC_API_KEY` — aucun autre fichier ne relit la variable indépendamment", () => {
    // On cherche la LECTURE (`process.env.ANTHROPIC_API_KEY`), pas la simple mention du nom : un
    // commentaire qui explique la conséquence de son absence (route.ts, Assistant.tsx) documente
    // un comportement, il ne crée pas un second chemin de lecture à sécuriser.
    const porteurs = TOUS_LES_FICHIERS.filter((f) => readFileSync(f, "utf8").includes("process.env.ANTHROPIC_API_KEY"));
    const relatifs = porteurs.map((f) => f.slice(RACINE_SRC.length + 1).replace(/\\/g, "/"));
    expect(relatifs).toEqual(["lib/assistant/config.ts"]);
  });

  it("aucun fichier « use client » ne référence ANTHROPIC_API_KEY", () => {
    const fichiersClient = TOUS_LES_FICHIERS.filter((f) => {
      const contenu = readFileSync(f, "utf8");
      return /^\s*["']use client["']/.test(contenu);
    });
    for (const f of fichiersClient) {
      expect(readFileSync(f, "utf8")).not.toContain("ANTHROPIC_API_KEY");
    }
    // Ce test ne prouve rien si aucun fichier client n'a été trouvé (le composant Assistant en
    // est un) : on s'assure qu'il a bien balayé quelque chose.
    expect(fichiersClient.length).toBeGreaterThan(0);
  });

  it("`config.ts` (le seul porteur légitime) n'est lui-même pas un fichier « use client »", () => {
    const contenu = readFileSync(join(RACINE_SRC, "lib/assistant/config.ts"), "utf8");
    expect(contenu).not.toMatch(/^\s*["']use client["']/);
  });
});
