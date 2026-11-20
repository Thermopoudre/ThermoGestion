import type { TonBadge } from "@/lib/tons";
import { etalonnageInfo, labelExigeEpaisseur, TYPES_CONTROLE } from "@/lib/qualite";
import type { Controle, ControleType, Fournee, Instrument } from "@/lib/types";

/**
 * Certificat de conformité par projet — le document qu'un industriel ou une collectivité
 * réclame à la livraison, et le seul de tout le logiciel qui engage l'atelier par écrit.
 *
 * Il ne se génère donc pas « à la demande » : un certificat émis sur un dossier incomplet est
 * pire qu'aucun certificat, parce qu'il est opposable. Les blocages ci-dessous reproduisent ce
 * qu'un auditeur Qualicoat vérifie sur pièce, dans l'ordre où il le vérifie.
 */

export type BlocageCertificat = {
  code: "sans_epaisseur" | "aucun_controle" | "controle_non_conforme" | "cuisson_non_tracee" | "instrument_non_etalonne";
  message: string;
};

export type AvertissementCertificat = {
  code: "certification_expiree" | "sans_certification" | "sans_lot" | "label_sans_epaisseur";
  message: string;
};

/** Contrôle retenu pour un type donné : le plus récent. Une retouche recontrôlée doit primer
 *  sur la mesure qui l'avait déclenchée, sinon aucun projet retouché ne serait jamais certifiable. */
export function controlesRetenus(controles: Controle[]): Map<ControleType, Controle> {
  const parType = new Map<ControleType, Controle>();
  for (const c of [...controles].sort((a, b) => a.mesure_at.localeCompare(b.mesure_at))) {
    parType.set(c.type, c);
  }
  return parType;
}

export type ContexteCertificat = {
  controles: Controle[];
  instruments: Instrument[];
  fournees: Fournee[];
  lotNumero: string | null;
  certificationExpireLe: string | null;
  certificationLabel: string | null;
  /**
   * Contrôles que l'atelier pratique réellement (référentiel par défaut). Absent = les six, pour
   * qu'un appelant qui ne connaît pas encore le réglage ne relâche jamais un blocage par accident.
   */
  typesActifs?: ControleType[] | null;
};

/**
 * Types de contrôle que le certificat n'a **pas** le droit d'attester, faute de mesure retenue.
 * Sert à écrire noir sur blanc, sur le document, ce qui n'a pas été contrôlé — un certificat qui
 * tait ses silences en dit plus qu'il n'a mesuré.
 */
export function typesNonAttestes(ctx: Pick<ContexteCertificat, "controles" | "typesActifs">): ControleType[] {
  const retenus = controlesRetenus(ctx.controles);
  const actifs = ctx.typesActifs ?? TYPES_CONTROLE;
  return actifs.filter((t) => !retenus.has(t));
}

/** Fournée réellement cuite et relevée : c'est elle qui atteste le cycle imprimé sur le certificat. */
export function cuissonAttestee(fournees: Fournee[]): Fournee | null {
  const cuites = fournees.filter((f) => f.statut === "terminee" && f.temp_relevee != null);
  if (cuites.length === 0) return null;
  return cuites.sort((a, b) => (b.terminee_at ?? "").localeCompare(a.terminee_at ?? ""))[0];
}

export function blocagesCertificat(ctx: ContexteCertificat): BlocageCertificat[] {
  const blocages: BlocageCertificat[] = [];
  const retenus = controlesRetenus(ctx.controles);

  // L'épaisseur n'est exigée que si l'atelier la mesure. Un atelier qui ne contrôle pas l'épaisseur
  // ne doit pas être privé de certificat : le document se contentera de ne rien affirmer à son
  // sujet (cf. `typesNonAttestes`, imprimé sur le PDF).
  const epaisseurPratiquee = (ctx.typesActifs ?? TYPES_CONTROLE).includes("epaisseur");
  const epaisseur = retenus.get("epaisseur");
  if (epaisseurPratiquee && !epaisseur) {
    blocages.push({
      code: "sans_epaisseur",
      message: "Aucune mesure d'épaisseur sur ce projet. Un certificat de conformité sans épaisseur relevée n'atteste rien.",
    });
  }

  // Aucun contrôle du tout : il ne reste rien à attester. Le cas ne pouvait pas se produire tant
  // que l'épaisseur était obligatoire ; il le peut depuis qu'elle est désactivable. On ne le
  // signale qu'à défaut du blocage d'épaisseur, qui dit déjà la même chose de façon plus précise.
  if (retenus.size === 0 && !epaisseurPratiquee) {
    blocages.push({
      code: "aucun_controle",
      message: "Aucun contrôle enregistré sur ce projet. Un certificat n'attesterait rien du tout.",
    });
  }

  const nonConformes = [...retenus.values()].filter((c) => c.conforme === false);
  if (nonConformes.length > 0) {
    blocages.push({
      code: "controle_non_conforme",
      message:
        `Contrôle non conforme en vigueur (${nonConformes.map((c) => c.type).join(", ")}). ` +
        "Retouchez la pièce et refaites la mesure : le contrôle le plus récent fait foi.",
    });
  }

  if (!cuissonAttestee(ctx.fournees)) {
    blocages.push({
      code: "cuisson_non_tracee",
      message: "Aucune fournée clôturée avec température relevée pour ce projet : le cycle de cuisson ne peut pas être attesté.",
    });
  }

  // Un instrument non étalonné invalide la mesure prise avec — c'est le premier point de contrôle
  // d'un audit, et le plus facile à prendre en défaut. La vérification porte sur **tous** les
  // contrôles retenus, pas seulement l'épaisseur : un quadrillage d'adhérence ou un brillancemètre
  // hors étalonnage rend le certificat tout aussi attaquable.
  const nonEtalonnes: string[] = [];
  for (const controle of retenus.values()) {
    if (!controle.instrument_id) continue;
    const instrument = ctx.instruments.find((i) => i.id === controle.instrument_id);
    if (!instrument) continue;
    const statut = etalonnageInfo(instrument.dernier_etalonnage, instrument.periodicite_mois).statut;
    if (statut !== "retard" && statut !== "jamais") continue;
    const mention = `${controle.type} → « ${instrument.nom} »`;
    if (!nonEtalonnes.includes(mention)) nonEtalonnes.push(mention);
  }
  if (nonEtalonnes.length > 0) {
    blocages.push({
      code: "instrument_non_etalonne",
      message:
        `Mesure prise avec un instrument dont l'étalonnage n'est pas à jour (${nonEtalonnes.join(", ")}). ` +
        "La mesure n'est pas opposable.",
    });
  }

  return blocages;
}

export function avertissementsCertificat(ctx: ContexteCertificat, aujourdHui = new Date()): AvertissementCertificat[] {
  const avertissements: AvertissementCertificat[] = [];
  if (!ctx.certificationLabel) {
    avertissements.push({
      code: "sans_certification",
      message: "Aucune certification active : le certificat sera émis sous la seule responsabilité de l'atelier, sans label.",
    });
  } else if (ctx.certificationExpireLe && ctx.certificationExpireLe < isoJour(aujourdHui)) {
    avertissements.push({
      code: "certification_expiree",
      message: `Votre certification ${ctx.certificationLabel} a expiré le ${ctx.certificationExpireLe} : elle ne sera pas mentionnée sur le certificat.`,
    });
  }
  if (!ctx.lotNumero) {
    avertissements.push({
      code: "sans_lot",
      message: "Aucun lot de poudre rattaché au projet : la traçabilité amont du certificat sera incomplète.",
    });
  }
  // Le label impose l'épaisseur ; l'atelier l'a désactivée. Le certificat reste émettable et
  // n'affirmera rien sur l'épaisseur — mais un auditeur du label, lui, la réclamera.
  if (labelExigeEpaisseur(ctx.certificationLabel) && !(ctx.typesActifs ?? TYPES_CONTROLE).includes("epaisseur")) {
    avertissements.push({
      code: "label_sans_epaisseur",
      message:
        `Votre référentiel ne pratique pas le contrôle d'épaisseur alors que vous revendiquez le label ${ctx.certificationLabel}, ` +
        "qui l'impose. Le certificat n'attestera pas l'épaisseur — un audit du label, lui, l'exigera.",
    });
  }
  return avertissements;
}

function isoJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Le label n'est imprimé que s'il est encore valable à la date d'émission. */
export function labelOpposable(label: string | null, expireLe: string | null, aujourdHui = new Date()): string | null {
  if (!label) return null;
  if (expireLe && expireLe < isoJour(aujourdHui)) return null;
  return label;
}

export function certificatEmettable(ctx: ContexteCertificat): boolean {
  return blocagesCertificat(ctx).length === 0;
}

/** Numéro lisible et stable : un même projet redonne toujours le même numéro de certificat. */
export function numeroCertificat(projetNumero: string | null, projetId: string): string {
  return `CC-${projetNumero ?? projetId.slice(0, 8).toUpperCase()}`;
}

export function dateFinGarantie(depart: string | null, garantieMois: number): string | null {
  if (!depart) return null;
  const d = new Date(`${depart.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + Math.max(0, Math.round(garantieMois)));
  return isoJour(d);
}

// ── Certifications de l'atelier ──────────────────────────────────────────────

export const LABELS_CERTIFICATION = [
  "Qualicoat",
  "Qualisteelcoat",
  "Qualimarine",
  "Qualidéco",
  "ISO 9001",
  "ISO 14001",
  "Autre",
] as const;

export type StatutCertification = "valide" | "bientot" | "expiree" | "sans_echeance";

export const STATUT_CERTIFICATION_LABEL: Record<StatutCertification, string> = {
  valide: "Valide",
  bientot: "À renouveler",
  expiree: "Expirée",
  sans_echeance: "Sans échéance",
};

export const STATUT_CERTIFICATION_TON: Record<StatutCertification, TonBadge> = {
  valide: "success",
  bientot: "warning",
  expiree: "danger",
  sans_echeance: "neutral",
};

/** Un renouvellement Qualicoat se prépare : audit à programmer, échantillons à préparer.
 *  90 jours, c'est le délai en dessous duquel l'atelier doit avoir lancé la démarche. */
export const PREAVIS_CERTIFICATION_JOURS = 90;

export function statutCertification(expireLe: string | null, aujourdHui = new Date()): { statut: StatutCertification; joursRestants: number | null } {
  if (!expireLe) return { statut: "sans_echeance", joursRestants: null };
  const fin = new Date(`${expireLe}T00:00:00`);
  const jours = Math.round((fin.getTime() - new Date(aujourdHui).setHours(0, 0, 0, 0)) / 86400000);
  const statut: StatutCertification = jours < 0 ? "expiree" : jours <= PREAVIS_CERTIFICATION_JOURS ? "bientot" : "valide";
  return { statut, joursRestants: jours };
}

/** Certification à afficher partout ailleurs (écran Qualité, registre PDF, certificat) : la
 *  valable qui expire le plus tard, sinon rien. Une certification expirée ne représente pas
 *  l'atelier — c'est précisément ce qu'un auditeur reproche. */
export function certificationDeReference<T extends { label: string; expire_le: string | null; actif: boolean }>(
  certifications: T[],
  aujourdHui = new Date(),
): T | null {
  const valables = certifications.filter((c) => c.actif && statutCertification(c.expire_le, aujourdHui).statut !== "expiree");
  if (valables.length === 0) return null;
  return valables.sort((a, b) => (b.expire_le ?? "9999-12-31").localeCompare(a.expire_le ?? "9999-12-31"))[0];
}
