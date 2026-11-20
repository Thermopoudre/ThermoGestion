/**
 * Lecture d'un tableur déposé par l'atelier : CSV ou XLSX.
 *
 * Pas de bibliothèque tierce, et ce n'est pas une coquetterie : les paquets de lecture XLSX les
 * plus répandus traînent des alertes de sécurité et pèsent quelques centaines de kilo-octets dans
 * le navigateur, pour un écran utilisé une fois dans la vie d'un atelier. Un .xlsx est une archive
 * ZIP de XML, et le navigateur sait décompresser depuis `DecompressionStream`.
 *
 * Ce qui est volontairement hors périmètre : les formules (on lit la valeur calculée, stockée par
 * Excel à côté) et les feuilles multiples — c'est la première feuille qui est lue, et l'écran le
 * dit.
 *
 * Les dates, elles, ne sont pas interprétées ici : Excel les stocke comme un NOMBRE de jours
 * depuis le 30 décembre 1899, et ce fichier ne connaît pas les formats de cellule. C'est
 * `dateDepuisTexte()` dans `modeles.ts` qui reconnaît aussi bien « 03/09/2026 » que « 45900 » —
 * là où l'on sait quelle colonne est censée porter une date.
 */

export type Feuille = { entetes: string[]; lignes: string[][] };

export class FichierIllisible extends Error {}

// ── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Le séparateur est deviné sur la première ligne. Excel en français exporte en point-virgule,
 * les outils anglo-saxons en virgule : imposer l'un des deux garantit un import raté sur deux.
 */
export function separateur(premiereLigne: string): string {
  const candidats = [";", ",", "\t", "|"];
  let meilleur = ";";
  let max = -1;
  for (const c of candidats) {
    const n = premiereLigne.split(c).length - 1;
    if (n > max) { max = n; meilleur = c; }
  }
  return max > 0 ? meilleur : ";";
}

export function parserCsv(texte: string): Feuille {
  const propre = texte.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const premiere = propre.split("\n", 1)[0] ?? "";
  const sep = separateur(premiere);

  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let dansGuillemets = false;

  for (let i = 0; i < propre.length; i++) {
    const c = propre[i];
    if (dansGuillemets) {
      if (c === '"') {
        // Deux guillemets consécutifs = un guillemet littéral, pas la fin du champ.
        if (propre[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"' && champ === "") { dansGuillemets = true; continue; }
    if (c === sep) { ligne.push(champ); champ = ""; continue; }
    if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; continue; }
    champ += c;
  }
  if (champ !== "" || ligne.length > 0) { ligne.push(champ); lignes.push(ligne); }

  return depuisLignes(lignes);
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

type EntreeZip = { nom: string; donnees: Uint8Array; compresse: boolean };

/** Lecture du répertoire central du ZIP — plus fiable que de suivre les en-têtes locaux. */
function entreesZip(buf: Uint8Array): { nom: string; debut: number; taille: number; compresse: boolean }[] {
  const vue = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fin = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new FichierIllisible("Ce fichier n'est pas un classeur Excel lisible.");
  const nbEntrees = vue.getUint16(fin + 10, true);
  let p = vue.getUint32(fin + 16, true);

  const out: { nom: string; debut: number; taille: number; compresse: boolean }[] = [];
  for (let n = 0; n < nbEntrees; n++) {
    if (vue.getUint32(p, true) !== 0x02014b50) break;
    const methode = vue.getUint16(p + 10, true);
    const tailleCompressee = vue.getUint32(p + 20, true);
    const lgNom = vue.getUint16(p + 28, true);
    const lgExtra = vue.getUint16(p + 30, true);
    const lgCommentaire = vue.getUint16(p + 32, true);
    const offsetLocal = vue.getUint32(p + 42, true);
    const nom = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + lgNom));

    // L'en-tête local répète le nom et les extras, avec des longueurs qui peuvent différer
    // de celles du répertoire central : c'est lui qui donne le début réel des données.
    const lgNomLocal = vue.getUint16(offsetLocal + 26, true);
    const lgExtraLocal = vue.getUint16(offsetLocal + 28, true);
    const debut = offsetLocal + 30 + lgNomLocal + lgExtraLocal;

    out.push({ nom, debut, taille: tailleCompressee, compresse: methode === 8 });
    p += 46 + lgNom + lgExtra + lgCommentaire;
  }
  return out;
}

async function decompresser(donnees: Uint8Array): Promise<Uint8Array> {
  const flux = new Blob([donnees as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

async function fichiersDuClasseur(buf: Uint8Array): Promise<Map<string, string>> {
  const entrees = entreesZip(buf).filter(
    (e) => e.nom === "xl/sharedStrings.xml" || e.nom.startsWith("xl/worksheets/"),
  );
  const map = new Map<string, string>();
  for (const e of entrees) {
    const brut = buf.subarray(e.debut, e.debut + e.taille);
    const contenu: EntreeZip = { nom: e.nom, donnees: brut, compresse: e.compresse };
    const octets = contenu.compresse ? await decompresser(contenu.donnees) : contenu.donnees;
    map.set(e.nom, new TextDecoder().decode(octets));
  }
  return map;
}

function decoderXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** `<si>` peut contenir plusieurs `<t>` quand une cellule mélange des styles : on les concatène. */
function chainesPartagees(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const morceaux = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
    out.push(morceaux.map((m) => decoderXml(m.replace(/<[^>]+>/g, ""))).join(""));
  }
  return out;
}

/** « BC12 » → 54 : la colonne d'une cellule, pour ne pas décaler les valeurs quand une case est vide. */
export function indexColonne(ref: string): number {
  const lettres = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const c of lettres) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function parserFeuille(xml: string, partagees: string[]): string[][] {
  const lignes: string[][] = [];
  for (const row of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cellules: string[] = [];
    for (const c of row.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = c.match(/r="([A-Z]+\d+)"/)?.[1] ?? "A1";
      const type = c.match(/t="([^"]+)"/)?.[1] ?? "n";
      let valeur = "";
      if (type === "inlineStr") {
        valeur = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
          .map((m) => decoderXml(m.replace(/<[^>]+>/g, "")))
          .join("");
      } else {
        const v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (v != null) valeur = type === "s" ? partagees[Number(v)] ?? "" : decoderXml(v);
      }
      const i = indexColonne(ref);
      while (cellules.length < i) cellules.push("");
      cellules[i] = valeur;
    }
    lignes.push(cellules);
  }
  return lignes;
}

// ── Entrée commune ───────────────────────────────────────────────────────────

function depuisLignes(lignes: string[][]): Feuille {
  const utiles = lignes.filter((l) => l.some((c) => (c ?? "").trim() !== ""));
  if (utiles.length === 0) throw new FichierIllisible("Le fichier ne contient aucune ligne.");
  const entetes = (utiles[0] ?? []).map((c) => (c ?? "").trim());
  return { entetes, lignes: utiles.slice(1) };
}

export async function lireFichier(fichier: File): Promise<Feuille> {
  const nom = fichier.name.toLowerCase();
  if (nom.endsWith(".csv") || nom.endsWith(".txt") || fichier.type === "text/csv") {
    return parserCsv(await fichier.text());
  }
  if (!nom.endsWith(".xlsx")) {
    throw new FichierIllisible("Formats acceptés : .csv et .xlsx. Depuis Excel : Fichier → Enregistrer sous → CSV UTF-8.");
  }
  // Le .xls (ancien format binaire) n'est pas un ZIP : autant le dire tout de suite.
  const buf = new Uint8Array(await fichier.arrayBuffer());
  const fichiers = await fichiersDuClasseur(buf);
  const partagees = chainesPartagees(fichiers.get("xl/sharedStrings.xml") ?? "");
  const nomFeuille = [...fichiers.keys()].filter((k) => k.startsWith("xl/worksheets/") && k.endsWith(".xml")).sort()[0];
  if (!nomFeuille) throw new FichierIllisible("Aucune feuille trouvée dans ce classeur.");
  return depuisLignes(parserFeuille(fichiers.get(nomFeuille) ?? "", partagees));
}
