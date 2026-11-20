import { round2 } from "@/lib/utils";

/**
 * Exports comptables : un CSV lisible par l'expert-comptable, et le FEC réglementaire.
 *
 * Le FEC (fichier des écritures comptables, art. A.47 A-1 du livre des procédures fiscales) est le
 * format que l'administration réclame en cas de contrôle : 18 colonnes, dans cet ordre, séparées
 * par une tabulation. Ce n'est pas un export « pour information » — un champ mal nommé et le
 * fichier est réputé non conforme.
 */

export type LignePiece = { total_ht: number | string; tva: number | string };

export type PaiementCompta = { montant: number | string; moyen: string; paye_at: string };

export type FactureCompta = {
  id: string;
  numero: string | null;
  type: "acompte" | "solde" | "libre" | "avoir";
  status: string;
  emise_at: string | null;
  created_at: string;
  due_date: string | null;
  total_ht: number | string;
  total_tva: number | string;
  total_ttc: number | string;
  nature_operation: "biens" | "services" | "mixte";
  items: LignePiece[];
  client: { id: string; nom: string; siren: string | null; siret: string | null } | null;
  paiements: PaiementCompta[];
};

export const COLONNES_FEC = [
  "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib",
  "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
  "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
] as const;

/** Plan comptable général, comptes usuels d'un atelier de thermolaquage. */
export const COMPTES = {
  client: { numero: "411000", libelle: "Clients" },
  services: { numero: "706000", libelle: "Prestations de services" },
  biens: { numero: "707000", libelle: "Ventes de marchandises" },
  tva: { numero: "445710", libelle: "TVA collectée" },
  banque: { numero: "512000", libelle: "Banque" },
  caisse: { numero: "530000", libelle: "Caisse" },
};

function jour(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Montant à la française : virgule décimale, deux décimales, jamais de séparateur de milliers. */
export function montantFec(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return (Number.isFinite(v) ? v : 0).toFixed(2).replace(".", ",");
}

/**
 * Une tabulation ou un retour à la ligne dans un libellé décalerait toutes les colonnes. Les tirets
 * cadratins et guillemets typographiques sont ramenés à leur équivalent ASCII : beaucoup de
 * logiciels comptables lisent encore le FEC en ISO-8859-15 et les rendent illisibles.
 */
function propre(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[«»“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .trim();
}

/**
 * Compte auxiliaire du client : lisible par l'humain (c'est ce que le comptable lit dans son
 * grand-livre) mais suffixé de l'identifiant technique, sinon deux « Menuiserie Martin »
 * fusionneraient en un seul compte.
 */
export function codeAuxiliaire(client: { id: string; nom: string }): string {
  const base = client.nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
    .padEnd(3, "X");
  return `${base}${client.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

/** Ventilation par taux de TVA : c'est la vue dont l'expert-comptable a besoin pour la CA3. */
export function ventilationTva(items: LignePiece[], totalHt: number, totalTva: number) {
  const parTaux = new Map<number, number>();
  for (const it of items ?? []) {
    const taux = Number(it.tva ?? 0);
    parTaux.set(taux, round2((parTaux.get(taux) ?? 0) + (Number(it.total_ht) || 0)));
  }
  const brut = [...parTaux.values()].reduce((s, v) => s + v, 0);
  if (brut <= 0) return [{ taux: 0, base: round2(totalHt), tva: round2(totalTva) }];
  // Les totaux enregistrés font foi (ils portent la remise) : les bases sont donc reventilées au
  // prorata, et la dernière absorbe l'arrondi pour que la somme retombe exactement sur le total.
  const lignes = [...parTaux.entries()].sort((a, b) => b[0] - a[0]).map(([taux, base]) => ({ taux, part: base / brut }));
  let baseCumul = 0;
  let tvaCumul = 0;
  return lignes.map((l, i) => {
    const dernier = i === lignes.length - 1;
    const base = dernier ? round2(totalHt - baseCumul) : round2(Number(totalHt) * l.part);
    const tva = dernier ? round2(totalTva - tvaCumul) : round2(base * (l.taux / 100));
    baseCumul = round2(baseCumul + base);
    tvaCumul = round2(tvaCumul + tva);
    return { taux: l.taux, base, tva };
  });
}

export type LigneFec = Record<(typeof COLONNES_FEC)[number], string>;

function ligne(v: Partial<LigneFec>): LigneFec {
  const base = Object.fromEntries(COLONNES_FEC.map((c) => [c, ""])) as LigneFec;
  return { ...base, ...v, Idevise: v.Idevise ?? "", Montantdevise: v.Montantdevise ?? "" };
}

/**
 * Écritures de vente et d'encaissement.
 *
 * Un avoir n'est pas une vente négative : il s'écrit en sens inverse, sinon le journal des ventes
 * affiche des débits au crédit et le grand-livre devient illisible.
 */
export function lignesFec(factures: FactureCompta[]): LigneFec[] {
  const out: LigneFec[] = [];

  for (const f of factures) {
    if (!f.numero || f.status === "brouillon" || f.status === "annulee") continue;
    const date = jour(f.emise_at ?? f.created_at);
    const avoir = f.type === "avoir";
    const client = f.client;
    const aux = client ? codeAuxiliaire(client) : "";
    const libelle = propre(`${avoir ? "Avoir" : "Facture"} ${f.numero}${client ? ` ${client.nom}` : ""}`);
    const vente = f.nature_operation === "biens" ? COMPTES.biens : COMPTES.services;
    const commun = {
      JournalCode: "VT",
      JournalLib: "Ventes",
      EcritureNum: propre(f.numero),
      EcritureDate: date,
      PieceRef: propre(f.numero),
      PieceDate: date,
      EcritureLib: libelle,
      ValidDate: date,
    };

    const ttc = round2(Number(f.total_ttc));
    out.push(ligne({
      ...commun,
      CompteNum: COMPTES.client.numero,
      CompteLib: COMPTES.client.libelle,
      CompAuxNum: aux,
      CompAuxLib: propre(client?.nom),
      Debit: montantFec(avoir ? 0 : ttc),
      Credit: montantFec(avoir ? ttc : 0),
    }));

    for (const v of ventilationTva(f.items, Number(f.total_ht), Number(f.total_tva))) {
      if (v.base === 0 && v.tva === 0) continue;
      out.push(ligne({
        ...commun,
        CompteNum: vente.numero,
        CompteLib: vente.libelle,
        EcritureLib: propre(`${libelle} - base ${v.taux} %`),
        Debit: montantFec(avoir ? v.base : 0),
        Credit: montantFec(avoir ? 0 : v.base),
      }));
      if (v.tva !== 0) {
        out.push(ligne({
          ...commun,
          CompteNum: COMPTES.tva.numero,
          CompteLib: COMPTES.tva.libelle,
          EcritureLib: propre(`${libelle} - TVA ${v.taux} %`),
          Debit: montantFec(avoir ? v.tva : 0),
          Credit: montantFec(avoir ? 0 : v.tva),
        }));
      }
    }

    f.paiements.forEach((p, i) => {
      const dateP = jour(p.paye_at);
      const compte = p.moyen === "especes" ? COMPTES.caisse : COMPTES.banque;
      const num = `${f.numero}-R${i + 1}`;
      const libP = propre(`Règlement ${f.numero}${client ? ` ${client.nom}` : ""}`);
      const communP = {
        JournalCode: "BQ",
        JournalLib: "Banque",
        EcritureNum: num,
        EcritureDate: dateP,
        PieceRef: propre(f.numero),
        PieceDate: date,
        EcritureLib: libP,
        ValidDate: dateP,
      };
      out.push(ligne({ ...communP, CompteNum: compte.numero, CompteLib: compte.libelle, Debit: montantFec(p.montant), Credit: montantFec(0) }));
      out.push(ligne({
        ...communP,
        CompteNum: COMPTES.client.numero,
        CompteLib: COMPTES.client.libelle,
        CompAuxNum: aux,
        CompAuxLib: propre(client?.nom),
        Debit: montantFec(0),
        Credit: montantFec(p.montant),
      }));
    });
  }

  return out;
}

/** Sérialisation FEC : en-tête normalisé puis une ligne par écriture, séparateur tabulation. */
export function versFec(lignes: LigneFec[]): string {
  const entete = COLONNES_FEC.join("\t");
  const corps = lignes.map((l) => COLONNES_FEC.map((c) => l[c]).join("\t"));
  return [entete, ...corps].join("\r\n") + "\r\n";
}

/** `<SIREN>FEC<AAAAMMJJ>.txt` — nom de fichier imposé, la date étant la clôture de l'exercice. */
export function nomFichierFec(siren: string | null | undefined, dateFin: string): string {
  const s = (siren ?? "000000000").replace(/\D/g, "").padStart(9, "0").slice(0, 9);
  return `${s}FEC${jour(dateFin)}.txt`;
}

const COLONNES_CSV = [
  "Date", "Numéro", "Type", "Statut", "Client", "SIREN client", "Nature de l'opération",
  "Taux TVA", "Base HT", "Montant TVA", "Total TTC facture", "Échéance", "Payée le", "Moyen de paiement",
] as const;

function champCsv(v: string): string {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const TYPE_LISIBLE: Record<string, string> = {
  acompte: "Facture d'acompte", solde: "Facture de solde", libre: "Facture", avoir: "Avoir",
};
const NATURE_LISIBLE: Record<string, string> = {
  biens: "Livraison de biens", services: "Prestation de services", mixte: "Opération mixte",
};

/**
 * CSV de contrôle : une ligne par taux de TVA et par facture, c'est la maille dont l'expert
 * comptable a besoin pour rapprocher la déclaration de TVA. Séparateur point-virgule et
 * décimales à la virgule — sans quoi Excel en français ouvre tout dans une seule colonne.
 */
export function versCsv(factures: FactureCompta[]): string {
  const lignes: string[] = [COLONNES_CSV.join(";")];
  for (const f of factures) {
    if (f.status === "brouillon" || f.status === "annulee") continue;
    const dernierPaiement = f.paiements[0] ?? null;
    for (const v of ventilationTva(f.items, Number(f.total_ht), Number(f.total_tva))) {
      lignes.push([
        jour(f.emise_at ?? f.created_at).replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1"),
        f.numero ?? "",
        TYPE_LISIBLE[f.type] ?? f.type,
        f.status === "payee" ? "Payée" : "Émise",
        f.client?.nom ?? "",
        f.client?.siren ?? "",
        NATURE_LISIBLE[f.nature_operation] ?? "",
        `${String(v.taux).replace(".", ",")} %`,
        montantFec(v.base),
        montantFec(v.tva),
        montantFec(f.total_ttc),
        f.due_date ? jour(f.due_date).replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1") : "",
        dernierPaiement ? jour(dernierPaiement.paye_at).replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1") : "",
        dernierPaiement?.moyen ?? "",
      ].map((c) => champCsv(propre(c))).join(";"));
    }
  }
  // BOM : sans lui, Excel ouvre l'UTF-8 en Latin-1 et « Émise » devient « Ãmise ».
  return `﻿${lignes.join("\r\n")}\r\n`;
}
