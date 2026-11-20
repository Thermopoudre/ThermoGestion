import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Polices incorporées dans les PDF.
 *
 * PDF/A interdit les 14 polices standard du format (Helvetica, Times, Courier) : elles ne sont
 * pas embarquées dans le fichier, donc le rendu dépend du lecteur — inacceptable pour un document
 * d'archive légale. Sans incorporation, un validateur PDF/A rejette la facture Factur-X.
 *
 * Liberation Sans (SIL Open Font License 1.1, cf. fonts/LICENSE.txt) est choisie parce qu'elle est
 * métriquement compatible avec Helvetica : la mise en page des documents déjà émis ne bouge pas.
 * Les fichiers sont redistribués **sans modification** — l'OFL réserve le nom « Liberation ».
 */

export const POLICE = "Liberation Sans";

const FICHIERS = [
  { fichier: "LiberationSans-Regular.ttf", fontWeight: 400 as const },
  { fichier: "LiberationSans-Bold.ttf", fontWeight: 700 as const },
];

/**
 * Le fichier est cherché sur le disque de la fonction serveur. Sur Vercel, il n'y arrive que si
 * `outputFileTracingIncludes` le déclare (cf. next.config.ts) : un `import` classique ne suffit pas
 * pour un binaire que seul le moteur de rendu ouvrira.
 */
function lire(fichier: string): Buffer {
  const candidats = [
    join(process.cwd(), "src", "lib", "pdf", "fonts", fichier),
    join(process.cwd(), ".next", "server", "src", "lib", "pdf", "fonts", fichier),
  ];
  const erreurs: string[] = [];
  for (const chemin of candidats) {
    try {
      return readFileSync(chemin);
    } catch (e) {
      erreurs.push(`${chemin} (${(e as Error).message})`);
    }
  }
  throw new Error(`Police ${fichier} introuvable. Essayé : ${erreurs.join(" · ")}`);
}

let enregistrees = false;

/**
 * Idempotent : @react-pdf empile les sources à chaque appel de `register`, ce qui ferait grossir
 * le PDF d'une copie de la police par requête sur une instance chaude.
 */
export function enregistrerPolices() {
  if (enregistrees) return;
  Font.register({
    family: POLICE,
    fonts: FICHIERS.map(({ fichier, fontWeight }) => ({
      // Data URL plutôt qu'un chemin : la lecture du fichier est faite ici, donc une police
      // absente échoue avec un message qui nomme le chemin cherché, pas par un timeout de rendu.
      src: `data:font/truetype;base64,${lire(fichier).toString("base64")}`,
      fontWeight,
      fontStyle: "normal" as const,
    })),
  });
  // Le découpage de mots par défaut coupe les références et les noms propres au milieu
  // (« Chaudron-nerie ») : sur un document commercial, mieux vaut une ligne un peu courte.
  Font.registerHyphenationCallback((mot) => [mot]);
  enregistrees = true;
}
