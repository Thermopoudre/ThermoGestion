import { createElement } from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { POLICE, enregistrerPolices } from "@/lib/pdf/polices";

/**
 * L'enregistrement des polices se fait ici, une fois, au chargement du module.
 *
 * Ce n'est pas un détail d'implémentation : `pdf/qualite.tsx` ne l'appelait pas lui-même, il en
 * héritait par effet de bord d'un `import` de `pdf/document.tsx` fait pour une constante de
 * couleur. Retirer cet import (parce que la constante a déménagé) suffisait à faire échouer le
 * rendu du certificat sur « Font family not registered: Liberation Sans ». Le module qui porte la
 * police dans ses styles est le bon endroit pour l'enregistrer — tous les gabarits l'importent.
 */
enregistrerPolices();

/**
 * Le style commun des six documents PDF du produit.
 *
 * POURQUOI. Il y avait six `StyleSheet.create` et **rien** en commun entre eux : six définitions
 * du gris secondaire, quatre pieds de page différents (dont un qui imprimait « Page 1 / 1 » sur
 * un document d'une seule page), trois épaisseurs de filet de tableau, deux tailles de logo. Un
 * atelier qui recevait devis, facture, certificat et registre des déchets recevait quatre
 * documents qui ne se ressemblaient pas — et changer le gris du produit demandait six retouches
 * dont on en oubliait toujours une.
 *
 * Ce fichier ne fusionne pas les six gabarits : un certificat de conformité tient sur une page
 * avec des marges serrées, un devis respire. Il met en commun ce qui *doit* être commun — les
 * couleurs, la typographie, la structure d'un tableau, et un pied de page unique.
 */

/**
 * Cyan Thermopoudre, servi quand l'atelier n'a pas choisi sa couleur.
 *
 * Il n'a **rien** à faire dans le corps d'un document, seulement en repli de `accentAtelier` :
 * un certificat de conformité aux couleurs de l'éditeur du logiciel plutôt qu'à celles du
 * laqueur qui l'émet, c'est le donneur d'ordre du client qui reçoit la mauvaise marque.
 */
export const ACCENT_DEFAUT = "#147085";

/** Image déjà téléchargée : @react-pdf n'ira pas chercher l'URL au moment du rendu. */
export type LogoSource = { data: Buffer; format: "png" | "jpg" };

/**
 * La couleur d'accent réellement à employer. Devis, facture, BL et jantes le faisaient déjà ;
 * le certificat de conformité et la fiche de cuisson codaient `#147085` en dur (trois endroits :
 * le cartouche du label, le filet de l'attestation et la mention « Document qualité »).
 */
export function accentAtelier(atelier: { couleur?: string | null }): string {
  return atelier.couleur || ACCENT_DEFAUT;
}

/** Les seules couleurs autorisées dans un document. Six nuances de gris valaient une de trop. */
export const COULEURS = {
  /** Corps de texte. Un noir pur « bave » à l'impression laser sur du papier ordinaire. */
  encre: "#1f2937",
  /** Étiquettes, mentions légales, tout ce qui se lit après le chiffre. */
  secondaire: "#6b7280",
  /** Pied de page : présent, jamais concurrent du contenu. */
  tenu: "#9ca3af",
  /** Filet fin entre deux lignes de tableau. */
  filet: "#e5e7eb",
  /** Filet fort : sous un en-tête de tableau, au-dessus d'un total. */
  filetFort: "#374151",
  /** Filet moyen : en-tête des tableaux de registre, cadres de signature. */
  filetMoyen: "#9ca3af",
  /** Bordure d'un cadre (signature, encadré de jante). */
  cadre: "#d1d5db",
  /** Fond des blocs d'information (adresse client, note, attestation). */
  fond: "#f9fafb",
  /** Verdicts : conforme, à surveiller, non conforme. */
  conforme: "#15803d",
  alerte: "#b45309",
  nonConforme: "#b91c1c",
} as const;

/** Corps de page : la police incorporée et l'encre, communes aux six documents. */
export function stylePage(mesures: {
  paddingTop: number;
  paddingBottom: number;
  paddingHorizontal: number;
  fontSize: number;
  lineHeight: number;
}) {
  return { ...mesures, fontFamily: POLICE, color: COULEURS.encre };
}

/**
 * Les briques partagées, en une seule feuille.
 *
 * Les tailles en points sont celles des documents existants : le certificat reste sur une page
 * (`tests/pdf-qualite.test.ts` le vérifie), le devis garde sa mise en page au point près.
 */
export const COMMUN = StyleSheet.create({
  // ── En-tête émetteur ───────────────────────────────────────────────────────
  entete: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  enteteGauche: { flexDirection: "row", alignItems: "center" },
  emetteurNom: { fontWeight: 700 },

  // ── Typographie ────────────────────────────────────────────────────────────
  petit: { color: COULEURS.secondaire },
  gras: { fontWeight: 700 },
  titre: { fontWeight: 700 },
  sousTitre: { color: COULEURS.secondaire },

  // ── Blocs ──────────────────────────────────────────────────────────────────
  bloc: { backgroundColor: COULEURS.fond, borderRadius: 3 },
  blocLabel: { letterSpacing: 0.6, color: COULEURS.secondaire, textTransform: "uppercase" },

  // ── Tableau ────────────────────────────────────────────────────────────────
  /** En-tête de tableau : filet fort pour les documents commerciaux. */
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COULEURS.filetFort, paddingBottom: 4 },
  /** En-tête de tableau de registre : filet moyen, l'inspecteur lit des dizaines de lignes. */
  theadLeger: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COULEURS.filetMoyen, paddingBottom: 3 },
  th: { letterSpacing: 0.6, color: COULEURS.secondaire, textTransform: "uppercase" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COULEURS.filet },

  // ── Section ────────────────────────────────────────────────────────────────
  section: { fontWeight: 700, borderBottomWidth: 1, borderBottomColor: COULEURS.filetFort },

  // ── Verdicts ───────────────────────────────────────────────────────────────
  conforme: { color: COULEURS.conforme },
  nonConforme: { color: COULEURS.nonConforme, fontWeight: 700 },
  ecart: { color: COULEURS.alerte },

  // ── Mentions et cadres ─────────────────────────────────────────────────────
  mentions: { borderTopWidth: 0.5, borderTopColor: COULEURS.filet },
  mentionsTexte: { fontSize: 7, lineHeight: 1.5, color: COULEURS.secondaire, marginBottom: 3 },
  cadre: { borderWidth: 0.5, borderColor: COULEURS.cadre, borderRadius: 3 },
  vide: { color: COULEURS.tenu },

  // ── Pied de page ───────────────────────────────────────────────────────────
  piedTexte: { fontSize: 7, color: COULEURS.tenu },
});

const h = createElement;

/**
 * Le pied de page, unique, des six documents.
 *
 * À gauche le nom de l'atelier et, selon le document, ce qu'il est. À droite la pagination —
 * **et seulement quand il y a plus d'une page**. `pdf/jantes.tsx` imprimait « Page 1 / 1 » sur
 * tous ses bons de prise en charge : une pagination qui ne pagine rien n'informe personne et
 * laisse penser qu'une seconde page a été perdue.
 *
 * `fixed` : le pied se répète sur chaque page. Sans lui, il ne s'imprime que sur la première, et
 * la deuxième page d'un devis long sort anonyme.
 */
export function PiedPage({
  gauche,
  bas = 24,
  marge = 40,
}: {
  /** Ce que dit le document de lui-même, à gauche : « ThermoLaque — certificat émis par… ». */
  gauche: string;
  /** Distance au bas de page, en points. Elle suit le `paddingBottom` du document. */
  bas?: number;
  /** Marge latérale, en points. Elle suit le `paddingHorizontal` du document. */
  marge?: number;
}) {
  return h(
    View,
    {
      style: {
        position: "absolute",
        bottom: bas,
        left: marge,
        right: marge,
        flexDirection: "row",
        justifyContent: "space-between",
        borderTopWidth: 0.5,
        borderTopColor: COULEURS.filet,
        paddingTop: 6,
      },
      fixed: true,
    },
    h(Text, { style: COMMUN.piedTexte }, gauche),
    h(Text, {
      style: COMMUN.piedTexte,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        totalPages > 1 ? `Page ${pageNumber} / ${totalPages}` : "",
    }),
  );
}
