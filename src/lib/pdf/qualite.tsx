import { createElement } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { accentAtelier, COMMUN, COULEURS, PiedPage, stylePage, type LogoSource } from "@/lib/pdf/styles";
import { dateFr, eur, nombreFr } from "@/lib/utils";
import { coutFournee, MESSAGE_PRIX_KWH_MANQUANT } from "@/lib/energie";
import { normaliserSeuils, resumeSeuils, resumeValeurs, TYPE_CONTROLE_LABEL, verdictLabel } from "@/lib/qualite";
import { controlesRetenus, cuissonAttestee, dateFinGarantie, numeroCertificat } from "@/lib/certificat";
import { poudreLabel, tauxRemplissage } from "@/lib/fournees";
import { STATUS_FOURNEE } from "@/lib/types";
import type { Atelier, Certification, Controle, ControleType, Fournee } from "@/lib/types";

/**
 * Documents PDF du lot 2 : certificat de conformité et fiche de cuisson.
 *
 * Ils vivent ici plutôt que dans leurs routes pour la même raison que la facture et le devis :
 * seule cette forme est testable. `tests/pdf-polices.test.ts` vérifie sur le fichier produit
 * qu'aucune des 14 polices standard interdites par PDF/A n'a pu se réintroduire — un certificat
 * remis à un donneur d'ordre industriel doit se rendre à l'identique partout.
 */

const h = createElement;

// ── Certificat de conformité ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Un certificat de conformité tient sur une seule page : c'est le document que l'atelier joint
  // au bon de livraison et qu'un donneur d'ordre classe dans son dossier d'ouvrage. Les mesures
  // ci-dessous sont serrées pour que l'attestation et la signature restent sous les contrôles.
  page: stylePage({ paddingTop: 32, paddingBottom: 44, paddingHorizontal: 42, fontSize: 8.5, lineHeight: 1.35 }),
  entete: { ...COMMUN.entete, marginBottom: 10 },
  enteteGauche: COMMUN.enteteGauche,
  logo: { width: 42, height: 42, marginRight: 10, objectFit: "contain" },
  emetteurNom: { ...COMMUN.emetteurNom, fontSize: 12 },
  petit: { ...COMMUN.petit, fontSize: 7.5 },
  titre: { ...COMMUN.titre, fontSize: 16, letterSpacing: 0.3 },
  numero: { ...COMMUN.sousTitre, fontSize: 8.5, marginBottom: 8 },
  section: { ...COMMUN.section, marginTop: 9, marginBottom: 3, fontSize: 9.5, paddingBottom: 2.5 },
  ligne: { flexDirection: "row", paddingVertical: 1.4, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  cle: { width: "34%", color: COULEURS.secondaire },
  valeur: { width: "66%", fontWeight: 700 },
  thead: { ...COMMUN.theadLeger, marginTop: 3 },
  th: { ...COMMUN.th, fontSize: 6.5, letterSpacing: 0.4 },
  tr: { ...COMMUN.tr, paddingVertical: 2.5 },
  conforme: { ...COMMUN.conforme, fontWeight: 700 },
  attestation: { marginTop: 9, padding: 7, backgroundColor: COULEURS.fond, borderLeftWidth: 2, fontSize: 8, lineHeight: 1.35 },
  signature: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cadreSignature: { width: 200, borderTopWidth: 0.5, borderTopColor: COULEURS.filetMoyen, paddingTop: 5 },
});

/**
 * Le cartouche du label (Qualicoat, Qualisteelcoat…) et le filet de l'attestation, à la couleur
 * de l'atelier.
 *
 * Ces deux styles codaient `#147085` en dur, c'est-à-dire le cyan de Thermopoudre : un atelier
 * qui avait pris la peine de régler sa couleur de marque envoyait à SON donneur d'ordre un
 * certificat de conformité aux couleurs de l'éditeur de son logiciel. Devis, facture, bon de
 * livraison et bon de prise en charge respectaient déjà `atelier.couleur` ; les deux documents
 * qui sortent le plus loin de l'atelier, non.
 */
function styleLabelBadge(accent: string) {
  return { fontSize: 9, fontWeight: 700 as const, color: accent, borderWidth: 1, borderColor: accent, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 7 };
}

function identiteEmetteur(a: Atelier) {
  return [a.forme_juridique, a.siren ? `SIREN ${a.siren}` : null, a.siret && !a.siren ? `SIRET ${a.siret}` : null]
    .filter(Boolean)
    .join(" · ");
}

function Ligne({ cle, valeur }: { cle: string; valeur: string }) {
  return h(View, { style: styles.ligne }, h(Text, { style: styles.cle }, cle), h(Text, { style: styles.valeur }, valeur));
}

function EnteteAtelier({ atelier, logo, droite }: { atelier: Atelier; logo: LogoSource | null; droite: React.ReactNode }) {
  return h(View, { style: styles.entete },
    h(View, { style: styles.enteteGauche },
      logo ? h(Image, { src: logo, style: styles.logo }) : null,
      h(View, {},
        h(Text, { style: styles.emetteurNom }, atelier.nom),
        atelier.adresse
          ? h(Text, { style: styles.petit }, `${atelier.adresse}${atelier.code_postal || atelier.ville ? `, ${[atelier.code_postal, atelier.ville].filter(Boolean).join(" ")}` : ""}`)
          : null,
        identiteEmetteur(atelier) ? h(Text, { style: styles.petit }, identiteEmetteur(atelier)) : null,
      ),
    ),
    droite,
  );
}

export type ProjetCertificat = {
  id: string;
  numero: string | null;
  nom: string;
  surface_m2: number | null;
  couches: number | null;
  teinte_origine: string | null;
  date_reception: string | null;
  date_livraison: string | null;
  clients: { nom: string } | null;
  poudres: {
    marque: string | null; reference: string; ral: string | null; finition: string | null; type: string | null;
    epaisseur_um_min: number | null; epaisseur_um_max: number | null;
  } | null;
  poudre_lots: { numero: string; fournisseur: string | null; dlu: string | null } | null;
};

export type ControleAvecOperateur = Controle & { users?: { nom: string | null } | null };
export type FourneeAvecOperateur = Fournee & { users?: { nom: string | null } | null };

export type CertificatProps = {
  projet: ProjetCertificat;
  atelier: Atelier & { garantie_mois: number };
  controles: ControleAvecOperateur[];
  fournees: FourneeAvecOperateur[];
  certification: Certification | null;
  /** Label réellement opposable à la date d'émission (`null` si la certification a expiré). */
  label: string | null;
  /**
   * Contrôles pratiqués par l'atelier mais absents de ce dossier. Imprimés noir sur blanc :
   * un certificat qui tait ses silences laisse croire qu'il atteste plus qu'il n'a mesuré.
   */
  nonAttestes?: ControleType[];
  logo: LogoSource | null;
  emisLe?: Date;
};

function teinteLisible(projet: ProjetCertificat): string {
  const parts = [projet.poudres?.ral ? `RAL ${projet.poudres.ral}` : null, projet.teinte_origine].filter(Boolean);
  return parts.length ? parts.join(" · ") : projet.poudres?.reference ?? "—";
}

function SectionControles({
  retenus,
  plageAttendue,
  nonAttestes,
}: {
  retenus: Map<ControleType, ControleAvecOperateur>;
  plageAttendue: string | null;
  nonAttestes: ControleType[];
}) {
  const lignes = [...retenus.values()];
  // Le barème qui a rendu chaque verdict est celui figé sur le contrôle, pas le réglage du jour où
  // le certificat est imprimé : c'est ce qui rend le document vérifiable des mois plus tard.
  const baremes = [...new Set(lignes.map((c) => `${c.referentiel_nom ?? "Référentiel non renseigné"} (${resumeSeuils(normaliserSeuils(c.seuils))})`))];
  return h(View, {},
    h(Text, { style: styles.section }, "Contrôles réalisés"),
    plageAttendue ? h(Text, { style: [styles.petit, { marginBottom: 2 }] }, `Épaisseur spécifiée pour cette poudre : ${plageAttendue}.`) : null,
    baremes.length > 0 ? h(Text, { style: [styles.petit, { marginBottom: 4 }] }, `Barème appliqué : ${baremes.join(" ; ")}.`) : null,
    h(View, { style: styles.thead },
      h(Text, { style: [styles.th, { width: "22%" }] }, "Contrôle"),
      h(Text, { style: [styles.th, { width: "34%" }] }, "Mesure"),
      h(Text, { style: [styles.th, { width: "16%" }] }, "Verdict"),
      h(Text, { style: [styles.th, { width: "14%" }] }, "Date"),
      h(Text, { style: [styles.th, { width: "14%" }] }, "Opérateur"),
    ),
    ...lignes.map((c) => h(View, { key: c.id, style: styles.tr, wrap: false },
      h(Text, { style: { width: "22%" } }, TYPE_CONTROLE_LABEL[c.type]),
      h(Text, { style: { width: "34%" } }, resumeValeurs(c.type, c.valeurs)),
      h(Text, { style: [{ width: "16%" }, c.conforme ? styles.conforme : undefined] }, verdictLabel(c.conforme)),
      h(Text, { style: { width: "14%" } }, dateFr(c.mesure_at)),
      h(Text, { style: { width: "14%" } }, c.users?.nom ?? "—"),
    )),
    // Le certificat n'atteste que ce qui est mesuré. Ce qui manque est nommé, pas passé sous
    // silence : c'est ce qui le rend exact chez un atelier qui ne pratique pas les six contrôles.
    nonAttestes.length > 0
      ? h(Text, { style: [styles.petit, { marginTop: 4 }] },
          `Contrôles non réalisés sur ce dossier, et donc non attestés par le présent certificat : ` +
            `${nonAttestes.map((t) => TYPE_CONTROLE_LABEL[t].toLowerCase()).join(", ")}.`)
      : null,
  );
}

export function CertificatDocument({ projet, atelier, controles, fournees, certification, label, nonAttestes = [], logo, emisLe = new Date() }: CertificatProps) {
  const retenus = controlesRetenus(controles) as Map<ControleType, ControleAvecOperateur>;
  const cuisson = cuissonAttestee(fournees) as FourneeAvecOperateur | null;
  const finGarantie = dateFinGarantie(projet.date_livraison ?? emisLe.toISOString().slice(0, 10), atelier.garantie_mois);
  // La plage d'épaisseur de la poudre n'a rien à faire sur un certificat qui ne rapporte aucune
  // mesure d'épaisseur : imprimée seule, elle se lit comme une épaisseur constatée.
  const accent = accentAtelier(atelier);
  const plageAttendue =
    retenus.has("epaisseur") && (projet.poudres?.epaisseur_um_min != null || projet.poudres?.epaisseur_um_max != null)
      ? `${projet.poudres?.epaisseur_um_min ?? "—"} à ${projet.poudres?.epaisseur_um_max ?? "—"} µm`
      : null;

  return h(Document,
    { title: `Certificat de conformité ${numeroCertificat(projet.numero, projet.id)}`, author: atelier.nom, creator: "Thermogestion", producer: "Thermogestion" },
    h(Page, { size: "A4", style: styles.page },
      h(EnteteAtelier, { atelier, logo, droite: label ? h(Text, { style: styleLabelBadge(accent) }, label) : null }),
      h(Text, { style: styles.titre }, "Certificat de conformité"),
      h(Text, { style: styles.numero }, `${numeroCertificat(projet.numero, projet.id)} · émis le ${dateFr(emisLe.toISOString())}`),

      h(Text, { style: styles.section }, "Ouvrage traité"),
      h(Ligne, { cle: "Donneur d'ordre", valeur: projet.clients?.nom ?? "—" }),
      h(Ligne, { cle: "Dossier", valeur: `${projet.numero ? `${projet.numero} — ` : ""}${projet.nom}` }),
      projet.surface_m2 != null ? h(Ligne, { cle: "Surface traitée", valeur: `${nombreFr(projet.surface_m2)} m²` }) : null,
      h(Ligne, { cle: "Nombre de couches", valeur: String(projet.couches ?? 1) }),
      projet.date_reception ? h(Ligne, { cle: "Réception des pièces", valeur: dateFr(projet.date_reception) }) : null,
      projet.date_livraison ? h(Ligne, { cle: "Livraison", valeur: dateFr(projet.date_livraison) }) : null,

      h(Text, { style: styles.section }, "Revêtement appliqué"),
      h(Ligne, { cle: "Teinte", valeur: teinteLisible(projet) }),
      h(Ligne, { cle: "Poudre", valeur: [projet.poudres?.marque, projet.poudres?.reference].filter(Boolean).join(" ") || "—" }),
      projet.poudres?.type ? h(Ligne, { cle: "Nature de la poudre", valeur: projet.poudres.type }) : null,
      projet.poudres?.finition ? h(Ligne, { cle: "Finition", valeur: projet.poudres.finition }) : null,
      h(Ligne, { cle: "N° de lot de poudre", valeur: projet.poudre_lots?.numero ?? "—" }),
      projet.poudre_lots?.fournisseur ? h(Ligne, { cle: "Fournisseur du lot", valeur: projet.poudre_lots.fournisseur }) : null,
      projet.poudre_lots?.dlu ? h(Ligne, { cle: "Date limite d'utilisation du lot", valeur: dateFr(projet.poudre_lots.dlu) }) : null,

      h(Text, { style: styles.section }, "Cycle de cuisson relevé"),
      h(Ligne, { cle: "Fournée", valeur: cuisson?.numero ?? "—" }),
      h(Ligne, { cle: "Consigne", valeur: cuisson?.temp_consigne != null ? `${nombreFr(cuisson.temp_consigne)} °C pendant ${cuisson.duree_min ?? "—"} min` : "—" }),
      h(Ligne, { cle: "Température relevée", valeur: cuisson?.temp_relevee != null ? `${nombreFr(cuisson.temp_relevee)} °C` : "—" }),
      h(Ligne, { cle: "Cuite le", valeur: cuisson?.terminee_at ? dateFr(cuisson.terminee_at) : "—" }),
      h(Ligne, { cle: "Opérateur four", valeur: cuisson?.users?.nom ?? "—" }),

      h(SectionControles, { retenus, plageAttendue, nonAttestes }),

      h(View, { style: [styles.attestation, { borderLeftColor: accent }] },
        h(Text, {},
          `${atelier.nom} atteste que les pièces désignées ci-dessus ont été revêtues conformément aux ` +
            "spécifications rappelées dans ce document, et que les contrôles reportés ont été réalisés " +
            "sur la production concernée avec des instruments dont l'étalonnage était à jour à la date de la mesure. " +
            "La présente attestation porte sur ces seuls contrôles, à l'exclusion de toute caractéristique " +
            "non reportée au tableau ci-dessus."),
        label
          ? h(Text, { style: { marginTop: 5 } },
              `Traitement réalisé sous agrément ${label}` +
                (certification?.numero ? ` n° ${certification.numero}` : "") +
                (certification?.organisme ? `, délivré par ${certification.organisme}` : "") +
                (certification?.expire_le ? `, valable jusqu'au ${dateFr(certification.expire_le)}` : "") + ".")
          : h(Text, { style: { marginTop: 5 } },
              "Ce certificat est émis sous la seule responsabilité de l'atelier ; aucun agrément de label n'est invoqué."),
        h(Text, { style: { marginTop: 5 } },
          `Garantie du revêtement : ${atelier.garantie_mois} mois` + (finGarantie ? `, soit jusqu'au ${dateFr(finGarantie)}` : "") +
            ". Elle couvre l'adhérence et la tenue du film dans des conditions normales d'usage et d'entretien, " +
            "à l'exclusion des chocs, rayures, agents chimiques agressifs et modifications ultérieures des pièces."),
      ),

      h(View, { style: styles.signature },
        h(View, {}, h(Text, { style: styles.petit }, (atelier.ville ? `Fait à ${atelier.ville}, le ` : "Le ") + dateFr(emisLe.toISOString()))),
        h(View, { style: styles.cadreSignature },
          h(Text, { style: styles.petit }, "Pour l'atelier — nom, qualité et signature"),
          h(Text, { style: { marginTop: 22, fontWeight: 700 } }, atelier.nom),
        ),
      ),

      h(PiedPage, { gauche: `${atelier.nom} — certificat émis par Thermogestion`, bas: 20, marge: 42 }),
    ),
  );
}

// ── Fiche de cuisson ─────────────────────────────────────────────────────────

const stylesCuisson = StyleSheet.create({
  titre: { fontWeight: 700, fontSize: 18 },
  sousTitre: { fontSize: 9, color: "#6b7280", marginBottom: 16 },
  releve: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  case: { width: "25%", paddingVertical: 6 },
  caseTitre: { fontSize: 7, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 },
  caseValeur: { fontSize: 13, fontWeight: 700 },
  ecart: COMMUN.ecart,
  visa: { marginTop: 26, flexDirection: "row", justifyContent: "space-between" },
  cadreVisa: { width: 210, borderTopWidth: 0.5, borderTopColor: "#9ca3af", paddingTop: 5, minHeight: 46 },
});

/** Écart consigne / relevé : c'est le seul chiffre qu'un auditeur regarde sur une fiche de cuisson. */
export function ecartTemperature(consigne: number | null, relevee: number | null): number | null {
  if (consigne == null || relevee == null) return null;
  return Math.round((Number(relevee) - Number(consigne)) * 10) / 10;
}

export type LigneCuisson = {
  surface_m2: number | null;
  projets: {
    numero: string | null; nom: string; couches: number | null;
    clients: { nom: string } | null;
    poudre_lots: { numero: string } | null;
  } | null;
};

export type FicheCuissonProps = {
  fournee: FourneeAvecOperateur;
  lignes: LigneCuisson[];
  /** `prix_kwh` est indispensable au coût énergétique : sans lui, la fiche ne chiffre rien. */
  atelier: Atelier & { four_capacite_m2: number | null; prix_kwh?: number | null };
  logo: LogoSource | null;
};

function Case({ titre, valeur, alerte }: { titre: string; valeur: string; alerte?: boolean }) {
  return h(View, { style: stylesCuisson.case },
    h(Text, { style: stylesCuisson.caseTitre }, titre),
    h(Text, { style: [stylesCuisson.caseValeur, alerte ? stylesCuisson.ecart : undefined] }, valeur),
  );
}

export function FicheCuissonDocument({ fournee, lignes, atelier, logo }: FicheCuissonProps) {
  const accent = accentAtelier(atelier);
  const surface = Math.round(lignes.reduce((s, l) => s + Number(l.surface_m2 ?? 0), 0) * 100) / 100;
  const taux = tauxRemplissage(surface, atelier.four_capacite_m2);
  const ecart = ecartTemperature(fournee.temp_consigne, fournee.temp_relevee);
  const alerte = ecart != null && Math.abs(ecart) > 5;
  // Le coût du cycle : la fiche relevait des kWh sans jamais dire ce qu'ils valaient.
  const cout = coutFournee({
    consoKwh: fournee.conso_kwh,
    prixKwh: atelier.prix_kwh,
    surfaceM2: surface,
    capaciteM2: atelier.four_capacite_m2,
  });

  return h(Document,
    { title: `Fiche de cuisson ${fournee.numero ?? fournee.id.slice(0, 8)}`, author: atelier.nom, creator: "Thermogestion", producer: "Thermogestion" },
    h(Page, { size: "A4", style: styles.page },
      h(EnteteAtelier, { atelier, logo, droite: h(Text, { style: [styles.petit, { fontWeight: 700, color: accent }] }, "Document qualité") }),
      h(Text, { style: stylesCuisson.titre }, `Fiche de cuisson ${fournee.numero ?? ""}`),
      h(Text, { style: stylesCuisson.sousTitre },
        `${STATUS_FOURNEE[fournee.statut].label} · ${poudreLabel(fournee.poudres)}` +
          (fournee.date_prevue ? ` · prévue le ${dateFr(fournee.date_prevue)}` : "")),

      h(Text, { style: styles.section }, "Relevé du cycle"),
      h(View, { style: stylesCuisson.releve },
        h(Case, { titre: "Consigne", valeur: fournee.temp_consigne != null ? `${nombreFr(fournee.temp_consigne)} °C` : "—" }),
        h(Case, { titre: "Température relevée", valeur: fournee.temp_relevee != null ? `${nombreFr(fournee.temp_relevee)} °C` : "—", alerte }),
        h(Case, { titre: "Écart", valeur: ecart != null ? `${ecart > 0 ? "+" : ""}${nombreFr(ecart)} °C` : "—", alerte }),
        h(Case, { titre: "Durée", valeur: fournee.duree_min != null ? `${fournee.duree_min} min` : "—" }),
        h(Case, { titre: "Consommation", valeur: fournee.conso_kwh != null ? `${nombreFr(fournee.conso_kwh)} kWh` : "—" }),
        h(Case, { titre: "Charge du four", valeur: `${nombreFr(surface)} m²${taux != null ? ` (${taux} %)` : ""}` }),
        h(Case, { titre: "Lancée le", valeur: fournee.demarree_at ? dateFr(fournee.demarree_at) : "—" }),
        h(Case, { titre: "Clôturée le", valeur: fournee.terminee_at ? dateFr(fournee.terminee_at) : "—" }),
        // Les deux cases de coût n'apparaissent que si elles ont une valeur exacte à porter :
        // un « — » en face de « Coût énergie » sur un document qualité n'apprend rien.
        cout.coutEur != null ? h(Case, { titre: "Coût énergie", valeur: eur(cout.coutEur) }) : null,
        cout.coutM2Eur != null
          ? h(Case, { titre: "Au m² embarqué", valeur: `${eur(cout.coutM2Eur)} / m²`, alerte: cout.fourneeCreuse })
          : null,
      ),
      cout.manque === "prix_kwh"
        ? h(Text, { style: [styles.petit, { marginTop: 6 }] }, MESSAGE_PRIX_KWH_MANQUANT)
        : null,
      cout.fourneeCreuse && cout.coutM2PleinEur != null
        ? h(Text, { style: [styles.petit, { marginTop: 6, color: COULEURS.alerte }] },
            `Four rempli à ${cout.tauxRemplissagePct} % : à pleine charge, le même cycle serait revenu à ` +
            `${eur(cout.coutM2PleinEur)} / m² — soit ${eur(cout.surcoutVideEur)} de chauffe payée pour du vide.`)
        : null,
      h(Text, { style: [styles.petit, { marginTop: 6 }] }, `Opérateur : ${fournee.users?.nom ?? "non renseigné"}`),
      fournee.note ? h(Text, { style: [styles.petit, { marginTop: 4 }] }, `Note : ${fournee.note}`) : null,

      h(Text, { style: styles.section }, `Pièces embarquées (${lignes.length})`),
      lignes.length === 0
        ? h(Text, { style: styles.petit }, "Aucun projet dans cette fournée.")
        : h(View, {},
            h(View, { style: styles.thead },
              h(Text, { style: [styles.th, { width: "6%" }] }, "N°"),
              h(Text, { style: [styles.th, { width: "20%" }] }, "Dossier"),
              h(Text, { style: [styles.th, { width: "26%" }] }, "Désignation"),
              h(Text, { style: [styles.th, { width: "22%" }] }, "Client"),
              h(Text, { style: [styles.th, { width: "12%" }] }, "Lot poudre"),
              h(Text, { style: [styles.th, { width: "8%" }] }, "Couches"),
              h(Text, { style: [styles.th, { width: "6%" }] }, "m²"),
            ),
            ...lignes.map((l, i) => h(View, { key: i, style: styles.tr, wrap: false },
              h(Text, { style: { width: "6%" } }, String(i + 1)),
              h(Text, { style: { width: "20%" } }, l.projets?.numero ?? "—"),
              h(Text, { style: { width: "26%" } }, l.projets?.nom ?? "—"),
              h(Text, { style: { width: "22%" } }, l.projets?.clients?.nom ?? "—"),
              h(Text, { style: { width: "12%" } }, l.projets?.poudre_lots?.numero ?? "—"),
              h(Text, { style: { width: "8%" } }, String(l.projets?.couches ?? 1)),
              h(Text, { style: { width: "6%" } }, l.surface_m2 != null ? nombreFr(l.surface_m2) : "—"),
            )),
          ),

      h(View, { style: stylesCuisson.visa },
        h(View, { style: stylesCuisson.cadreVisa }, h(Text, { style: styles.petit }, "Visa opérateur four")),
        h(View, { style: stylesCuisson.cadreVisa }, h(Text, { style: styles.petit }, "Visa responsable qualité")),
      ),

      h(PiedPage, { gauche: `${atelier.nom} — fiche de cuisson conservée au dossier qualité`, bas: 20, marge: 42 }),
    ),
  );
}
