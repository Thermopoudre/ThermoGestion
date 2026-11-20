import { describe, expect, it } from "vitest";
import * as accueil from "@/app/page";
import * as loginLayout from "@/app/login/layout";
import * as signupLayout from "@/app/signup/layout";
import * as aidePublique from "@/app/aide-publique/page";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

/**
 * Lot G (SEO) — ce que le test peut vérifier sans navigateur ni Search Console.
 *
 * Import direct des modules `page.tsx` / `layout.tsx` publics : c'est la même `metadata` que
 * Next.js lit pour construire les balises `<title>` et `<meta description>`, pas une copie
 * maintenue à côté qui pourrait diverger silencieusement.
 *
 * `/demo` n'a pas de `metadata` : c'est une route (`route.ts`), toujours une redirection, jamais
 * une page rendue — rien à titrer. `/aide` privé n'est pas testé ici non plus : le point 6 du Lot
 * G le laisse fermé aux visiteurs sans session et crée `/aide-publique` à la place (voir
 * `src/app/aide-publique/page.tsx`), qui est la page réellement comparée aux autres ci-dessous.
 */

type MetaTexte = { title?: unknown; description?: unknown };

/** Une page publique porte-t-elle un titre en chaîne simple (pas un template `%s | Site`) ? */
function titre(m: MetaTexte): string {
  const t = m.title;
  if (typeof t === "string") return t;
  throw new Error(`titre inattendu : ${JSON.stringify(t)}`);
}

function description(m: MetaTexte): string {
  const d = m.description;
  if (typeof d !== "string") throw new Error(`description inattendue : ${JSON.stringify(d)}`);
  return d;
}

const PAGES = {
  "/": accueil.metadata,
  "/login": loginLayout.metadata,
  "/signup": signupLayout.metadata,
  "/aide-publique": aidePublique.metadata,
} as const;

describe("titres et descriptions des pages publiques", () => {
  for (const [chemin, metadata] of Object.entries(PAGES)) {
    it(`${chemin} : titre ≤ 60 caractères, description ≤ 155`, () => {
      const t = titre(metadata as MetaTexte);
      const d = description(metadata as MetaTexte);
      expect(t.length, `titre de ${chemin} : « ${t} » (${t.length} car.)`).toBeLessThanOrEqual(60);
      expect(t.length, `titre de ${chemin} vide`).toBeGreaterThan(0);
      expect(d.length, `description de ${chemin} : « ${d} » (${d.length} car.)`).toBeLessThanOrEqual(155);
      expect(d.length, `description de ${chemin} vide`).toBeGreaterThan(0);
    });
  }

  it("canonical posé sur chaque page publique", () => {
    for (const [chemin, metadata] of Object.entries(PAGES)) {
      const alt = (metadata as { alternates?: { canonical?: unknown } }).alternates;
      expect(alt?.canonical, `${chemin} n'a pas de canonical`).toBeTruthy();
    }
  });

  it("les titres sont uniques entre eux — l'audit du 03/09 en trouvait trois identiques", () => {
    const titres = Object.entries(PAGES).map(([chemin, m]) => [chemin, titre(m as MetaTexte)] as const);
    const vus = new Map<string, string>();
    for (const [chemin, t] of titres) {
      const doublon = vus.get(t);
      expect(doublon, `« ${t} » sert à la fois à ${doublon} et à ${chemin}`).toBeUndefined();
      vus.set(t, chemin);
    }
  });

  it("/login est en noindex, /signup et /aide-publique restent indexables", () => {
    const robotsLogin = (loginLayout.metadata as { robots?: { index?: boolean } }).robots;
    expect(robotsLogin?.index, "/login devrait être en robots: { index: false }").toBe(false);

    for (const mod of [signupLayout, aidePublique]) {
      const r = (mod.metadata as { robots?: { index?: boolean } }).robots;
      expect(r?.index, "cette page ne devrait pas être passée en noindex").not.toBe(false);
    }
  });
});

describe("données structurées", () => {
  it("le JSON-LD FAQ de l'accueil et celui de l'aide publique sont du JSON valide", async () => {
    const { faqJsonLd } = await import("@/components/JsonLd");
    const bloc = faqJsonLd([{ question: "Test ?", reponse: "Une réponse." }]);
    expect(() => JSON.parse(JSON.stringify(bloc))).not.toThrow();
    expect(bloc["@type"]).toBe("FAQPage");
  });

  it("ORGANISATION porte un logo en URL absolue vers un fichier réel de public/", async () => {
    const { ORGANISATION } = await import("@/components/JsonLd");
    const fs = await import("node:fs");
    const path = await import("node:path");
    expect(ORGANISATION.logo).toMatch(/^https?:\/\//);
    const nomFichier = ORGANISATION.logo.split("/").pop()!;
    const chemin = path.join(process.cwd(), "public", nomFichier);
    expect(fs.existsSync(chemin), `${chemin} n'existe pas dans public/`).toBe(true);
  });

  it("LOGICIEL.offers reprend les prix réels de lib/abonnement.ts, jamais recopiés à la main", async () => {
    const { LOGICIEL } = await import("@/components/JsonLd");
    const { OFFRES } = await import("@/lib/abonnement");
    for (const offre of OFFRES) {
      const jsonLd = LOGICIEL.offers.find((o) => o.name === offre.nom);
      expect(jsonLd, `aucune offre JSON-LD pour ${offre.nom}`).toBeDefined();
      expect(jsonLd!.price).toBe(String(offre.prixMensuel));
    }
  });

  it("aucun réseau social inventé — seulement thermopoudre.fr", async () => {
    const { ORGANISATION } = await import("@/components/JsonLd");
    expect(ORGANISATION.sameAs).toEqual(["https://thermopoudre.fr"]);
  });
});

describe("sitemap et robots", () => {
  it("sitemap() ne rend aucune URL privée : ni (app), ni /api", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url, `${url} expose le groupe de routes (app)`).not.toMatch(/\(app\)/);
      expect(url, `${url} expose /api`).not.toMatch(/\/api\//);
    }
  });

  it("sitemap() ne recommande pas /login, qui est en noindex", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/login"))).toBe(false);
  });

  it("sitemap() référence bien le nouveau centre d'aide public", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/aide-publique"))).toBe(true);
  });

  it("sitemap() pose un lastModified réel, pas la date du jour recalculée à chaque appel", () => {
    // Deux appels à quelques millisecondes d'écart doivent rendre exactement les mêmes dates :
    // avec `new Date()` au moment du rendu, ils auraient divergé à la milliseconde près.
    const a = sitemap().map((e) => +new Date(e.lastModified!));
    const b = sitemap().map((e) => +new Date(e.lastModified!));
    expect(a).toEqual(b);
  });

  it("robots() interdit la surface privée et laisse la vitrine ouverte", () => {
    const regles = robots().rules;
    const regle = Array.isArray(regles) ? regles[0] : regles;
    const disallow = ([] as string[]).concat(regle?.disallow ?? []);
    for (const prive of ["/dashboard", "/api/", "/scan", "/pilotage"]) {
      expect(disallow.some((d) => d.startsWith(prive) || prive.startsWith(d.replace(/\$$/, ""))), `${prive} devrait être interdit`).toBe(true);
    }
    // /demo n'est plus interdit : incohérence relevée par le Lot G (bloquée ici, recommandée
    // dans llms.txt et présente dans le sitemap).
    expect(disallow).not.toContain("/demo");
    // Une règle bloquant "/aide" à la lettre aurait aussi bloqué "/aide-publique" : régression
    // à surveiller si quelqu'un simplifie un jour cette liste.
    expect(disallow).not.toContain("/aide");
  });
});
