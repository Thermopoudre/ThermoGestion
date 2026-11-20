import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Atelier, BonLivraison, Client, Devis, DevisItem, Facture, LigneBL } from "@/lib/types";
import { calcTotaux, dateFr, estDeductionAcompte, factureARegler, montantAcomptesDeduits, montantForfaitMinimum, nombreFr, qteFr, remiseAffichee, sousTotalRemisable, ventilationParTaux, type TrancheTva } from "@/lib/utils";
import { joursPaiement, lignesFacturables, montantAcompte } from "@/lib/calculs";
import { echeanceDevisAffichable } from "@/lib/devis";
import { enregistrerPolices } from "@/lib/pdf/polices";
import { accentAtelier, COMMUN, COULEURS, PiedPage as PiedPageCommun, stylePage, type LogoSource } from "@/lib/pdf/styles";

enregistrerPolices();

/**
 * Documents PDF générés côté serveur (devis, facture, bon de livraison).
 *
 * Pourquoi un rendu serveur plutôt que window.print() : un devis signé et une facture
 * engagent juridiquement l'atelier. Le rendu du navigateur varie d'une machine à l'autre
 * (pagination, marges, en-têtes « about:blank » imprimés) — ici le fichier est bit-à-bit
 * identique quel que soit le poste, et il est archivable en l'état.
 */

export { ACCENT_DEFAUT, accentAtelier } from "@/lib/pdf/styles";
export type { LogoSource } from "@/lib/pdf/styles";

/**
 * Intl produit une espace fine insécable (U+202F) entre le nombre et le symbole € en français.
 * Elle est remplacée par une espace ordinaire : tous les lecteurs ne la gèrent pas, et un montant
 * illisible sur une facture se conteste. Le remplacement est conservé depuis le passage à une
 * police incorporée, pour que les documents déjà émis restent identiques au caractère près.
 */
export function eurPdf(n: number | null | undefined) {
  return (n ?? 0)
    .toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
    .replace(/[  ]/g, " ");
}

/** Même contrainte d'encodage que `eurPdf` sur les espaces insécables produites par Intl. */
function qtePdf(qte: number | null | undefined, unite: string | null | undefined) {
  return qteFr(qte, unite).replace(/[  ]/g, " ");
}

function ligneAdresse(cp: string | null, ville: string | null) {
  return [cp, ville].filter(Boolean).join(" ");
}

const styles = StyleSheet.create({
  page: stylePage({ paddingTop: 36, paddingBottom: 60, paddingHorizontal: 40, fontSize: 9, lineHeight: 1.45 }),
  entete: { ...COMMUN.entete, marginBottom: 22 },
  enteteGauche: COMMUN.enteteGauche,
  logo: { width: 46, height: 46, marginRight: 10, objectFit: "contain" },
  emetteurNom: { ...COMMUN.emetteurNom, fontSize: 13 },
  petit: { ...COMMUN.petit, fontSize: 8 },
  titre: { ...COMMUN.titre, fontSize: 17 },
  sousTitre: { ...COMMUN.sousTitre, fontSize: 9, marginBottom: 16 },

  bloc: { ...COMMUN.bloc, padding: 10, marginBottom: 16 },
  blocLabel: { ...COMMUN.blocLabel, fontSize: 7, marginBottom: 2 },
  gras: COMMUN.gras,

  thead: COMMUN.thead,
  th: { ...COMMUN.th, fontSize: 7 },
  tr: { ...COMMUN.tr, paddingVertical: 5 },
  colLibelle: { width: "48%", paddingRight: 8 },
  colQte: { width: "16%", textAlign: "right", paddingRight: 8 },
  colPu: { width: "18%", textAlign: "right", paddingRight: 8 },
  colTotal: { width: "18%", textAlign: "right" },

  totaux: { width: 190, marginLeft: "auto", marginTop: 12 },
  totalLigne: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalTtc: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COULEURS.filetFort,
    marginTop: 3,
    paddingTop: 4,
    fontSize: 11,
  },

  note: { ...COMMUN.bloc, padding: 9, fontSize: 8, color: "#4b5563", marginTop: 16 },
  mentions: { ...COMMUN.mentions, paddingTop: 10, marginTop: 22 },
  mentionsTexte: COMMUN.mentionsTexte,

  signature: { marginTop: 22, flexDirection: "row", justifyContent: "flex-end" },
  cadreSignature: { ...COMMUN.cadre, width: 230, padding: 10, minHeight: 92 },

  annexeTitre: { ...COMMUN.titre, fontSize: 13, marginBottom: 12 },
  annexeTexte: { fontSize: 8.5, lineHeight: 1.5, color: "#374151" },
});

// ── Briques communes ─────────────────────────────────────────────────────────

function Entete({ atelier, logo }: { atelier: Atelier; logo: LogoSource | null }) {
  const cpVille = ligneAdresse(atelier.code_postal, atelier.ville);
  const contact = [atelier.telephone, atelier.email].filter(Boolean).join(" · ");
  return (
    <View style={styles.entete}>
      <View style={styles.enteteGauche}>
        {logo && <Image src={logo} style={styles.logo} />}
        <View>
          <Text style={styles.emetteurNom}>{atelier.nom}</Text>
          {atelier.adresse && (
            <Text style={styles.petit}>
              {atelier.adresse}
              {cpVille ? `, ${cpVille}` : ""}
            </Text>
          )}
          {contact ? <Text style={styles.petit}>{contact}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function BlocClient({
  client,
  label = "Client",
  avecSiren = false,
  avecLivraison = false,
}: {
  client: Client;
  label?: string;
  avecSiren?: boolean;
  avecLivraison?: boolean;
}) {
  const cpVille = ligneAdresse(client.code_postal, client.ville);
  // L'adresse de livraison n'est reprise que si elle diffère de l'adresse de facturation :
  // c'est une mention obligatoire seulement dans ce cas.
  const livraison = avecLivraison && client.adresse_livraison
    ? [client.adresse_livraison, ligneAdresse(client.code_postal_livraison, client.ville_livraison)]
        .filter(Boolean)
        .join(", ")
    : null;
  return (
    <View style={styles.bloc}>
      <Text style={styles.blocLabel}>{label}</Text>
      <Text style={styles.gras}>{client.nom}</Text>
      {client.adresse ? (
        <Text style={styles.petit}>
          {client.adresse}
          {cpVille ? `, ${cpVille}` : ""}
        </Text>
      ) : null}
      {avecSiren && client.siren ? <Text style={styles.petit}>SIREN {client.siren}</Text> : null}
      {livraison ? <Text style={styles.petit}>Livraison — {livraison}</Text> : null}
    </View>
  );
}

type LigneTableau = { libelle: string; qte: number; unite: string; pu_ht: number; total_ht: number };

function Tableau({ lignes }: { lignes: LigneTableau[] }) {
  return (
    <View>
      {/* `fixed` : l'en-tête se répète en haut de chaque page quand le tableau déborde. */}
      <View style={styles.thead} fixed>
        <Text style={[styles.th, styles.colLibelle]}>Désignation</Text>
        <Text style={[styles.th, styles.colQte]}>Qté</Text>
        <Text style={[styles.th, styles.colPu]}>PU HT</Text>
        <Text style={[styles.th, styles.colTotal]}>Total HT</Text>
      </View>
      {lignes.map((l, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={styles.colLibelle}>{l.libelle}</Text>
          <Text style={styles.colQte}>{qtePdf(l.qte, l.unite)}</Text>
          <Text style={styles.colPu}>{eurPdf(l.pu_ht)}</Text>
          <Text style={styles.colTotal}>{eurPdf(l.total_ht)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Bloc de totaux. Le plancher de facturation apparaît **après** la remise, sinon l'addition ne
 * tombe pas : un devis imprimait « sous-total 13,50 € − remise 1,62 € » puis « total HT 25,00 € ».
 * L'ordre reproduit la règle : la remise porte sur les lignes remisables, le plancher s'ajoute.
 */
function Totaux({
  ht,
  tva,
  ttc,
  sousTotal,
  remise,
  forfait,
  acomptes,
  ventilation,
}: {
  ht: number;
  tva: number;
  ttc: number;
  sousTotal?: number;
  remise?: number;
  forfait?: number;
  /** Acomptes déjà facturés et déduits ici : mention attendue sur une facture de solde. */
  acomptes?: number;
  /**
   * Ventilation de la TVA par taux. Sur un document à un seul taux — le cas courant — elle
   * n'apporte rien et on garde la ligne « TVA » unique. Dès qu'il y en a deux, l'article
   * 242 nonies A de l'annexe II au CGI veut le montant de la taxe par taux, et le XML Factur-X
   * le porte de toute façon : les deux doivent dire la même chose.
   */
  ventilation?: TrancheTva[];
}) {
  const detaille = (remise != null && remise > 0) || (forfait != null && forfait > 0) || (acomptes != null && acomptes > 0);
  return (
    <View style={styles.totaux} wrap={false}>
      {detaille && sousTotal != null ? (
        <View style={styles.totalLigne}>
          <Text>Sous-total HT</Text>
          <Text>{eurPdf(sousTotal)}</Text>
        </View>
      ) : null}
      {remise != null && remise > 0 ? (
        <View style={styles.totalLigne}>
          <Text>Remise</Text>
          <Text>-{eurPdf(remise)}</Text>
        </View>
      ) : null}
      {acomptes != null && acomptes > 0 ? (
        <View style={styles.totalLigne}>
          <Text>Acompte(s) déjà facturé(s)</Text>
          <Text>-{eurPdf(acomptes)}</Text>
        </View>
      ) : null}
      {forfait != null && forfait > 0 ? (
        <View style={styles.totalLigne}>
          <Text>Forfait minimum</Text>
          <Text>+{eurPdf(forfait)}</Text>
        </View>
      ) : null}
      <View style={styles.totalLigne}>
        <Text>Total HT</Text>
        <Text style={styles.gras}>{eurPdf(ht)}</Text>
      </View>
      {ventilation && ventilation.length > 1 ? (
        ventilation.map((t) => (
          <View key={t.taux} style={styles.totalLigne}>
            <Text style={{ color: "#6b7280" }}>TVA {nombreFr(t.taux)} % sur {eurPdf(t.base)}</Text>
            <Text style={{ color: "#6b7280" }}>{eurPdf(t.taxe)}</Text>
          </View>
        ))
      ) : (
        <View style={styles.totalLigne}>
          <Text style={{ color: "#6b7280" }}>TVA</Text>
          <Text style={{ color: "#6b7280" }}>{eurPdf(tva)}</Text>
        </View>
      )}
      <View style={styles.totalTtc}>
        <Text>Total TTC</Text>
        <Text style={styles.gras}>{eurPdf(ttc)}</Text>
      </View>
    </View>
  );
}

/**
 * Identité de l'émetteur. Forme juridique, capital, SIREN et immatriculation (RCS pour les
 * commerçants, répertoire des métiers pour les artisans) sont obligatoires sur tout document
 * commercial d'une société — art. R.123-237 du code de commerce.
 */
function identiteEmetteur(a: Atelier) {
  return [
    a.forme_juridique,
    a.capital_social ? `au capital de ${eurPdf(a.capital_social)}` : null,
    a.siren ? `SIREN ${a.siren}` : null,
    a.siret && !a.siren ? `SIRET ${a.siret}` : null,
    a.rcs_ville ? `RCS ${a.rcs_ville}` : null,
    a.rm_numero ? `RM ${a.rm_numero}` : null,
    a.tva_intra ? `TVA ${a.tva_intra}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Le pied commun, avec les marges de ce gabarit (paddingBottom 60, paddingHorizontal 40). */
function PiedPage() {
  return <PiedPageCommun gauche="Propulsé par Thermogestion" bas={26} marge={40} />;
}

/**
 * Annexe des conditions générales de vente (migration 76) — une page dédiée, à la fin du document,
 * jamais mêlée aux mentions obligatoires de la face (art. L441-9) qui restent où elles sont.
 *
 * N'est rendue que si `texte` est non vide : pas d'annexe du tout sur un atelier qui n'a rien
 * renseigné. Le texte peut déborder sur une page suivante — c'est un `<Page>` de flux normal, pas
 * `wrap={false}` — de vraies conditions générales tiennent rarement sur une seule page.
 */
function AnnexeCgv({ texte }: { texte: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.annexeTitre}>Conditions générales de vente</Text>
      <Text style={styles.annexeTexte}>{texte}</Text>
      <PiedPage />
    </Page>
  );
}

// ── Facture ──────────────────────────────────────────────────────────────────

const NATURE_LABEL: Record<string, string> = {
  biens: "Livraison de biens",
  services: "Prestation de services",
  mixte: "Opération mixte (biens et services)",
};

const TYPE_FACTURE_LABEL: Record<string, string> = {
  acompte: "Facture d'acompte",
  solde: "Facture de solde",
  libre: "Facture",
  avoir: "Avoir",
};

export function FactureDocument({
  facture,
  client,
  atelier,
  logo,
  cgvTexte,
}: {
  facture: Facture;
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
  /**
   * Conditions générales de vente à annexer (migration 76) : le texte figé de la facture
   * (`facture.cgv_texte`) s'il existe, sinon — sur un brouillon — celui en vigueur
   * (`client.cgv ?? atelier.cgv`), calculé par l'appelant. `undefined`/vide/blanc = pas d'annexe.
   */
  cgvTexte?: string | null;
}) {
  const accent = accentAtelier(atelier);
  const cgv = cgvTexte?.trim() || null;
  const titre = TYPE_FACTURE_LABEL[facture.type] ?? "Facture";
  const items: DevisItem[] = facture.items ?? [];
  // La remise contractuelle doit être lisible sur la facture, sinon le total ne se rapproche pas
  // de la somme des lignes et le document devient incontrôlable pour la comptabilité du client.
  const brutHt = sousTotalRemisable(items);
  // Remise réellement appliquée, déduite du total HT : la répartition au prorata entre les taux de
  // TVA arrondit chaque part, et la somme des parts peut valoir un centime de plus que la remise
  // nominale. C'est le total HT qui fait foi — et c'est déjà lui que déclare BT-107 dans le XML.
  const remiseMontant =
    facture.remise && facture.remise.valeur > 0 ? remiseAffichee(items, facture.remise, facture.total_ht) : null;
  const forfait = montantForfaitMinimum(items);
  const acomptes = montantAcomptesDeduits(items);
  const acomptesDeduits = items.filter(estDeductionAcompte);
  // Un avoir n'appelle aucun règlement, une facture annulée non plus : ni échéance, ni pénalités.
  const annulee = facture.status === "annulee";
  const aRegler = factureARegler(facture);
  const sousTitre = [
    annulee ? "ANNULÉE" : null,
    facture.emise_at ? `Émise le ${dateFr(facture.emise_at)}` : "Non émise",
    aRegler && facture.due_date ? `échéance ${dateFr(facture.due_date)}` : null,
    NATURE_LABEL[facture.nature_operation] ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document
      title={`${titre} ${facture.numero ?? ""}`.trim()}
      author={atelier.nom}
      creator="Thermogestion"
      producer="Thermogestion"
    >
      <Page size="A4" style={styles.page}>
        <Entete atelier={atelier} logo={logo} />

        <Text style={[styles.titre, { color: accent }]}>
          {titre} {facture.numero ?? "(brouillon)"}
        </Text>
        <Text style={styles.sousTitre}>{sousTitre}</Text>

        {/* Le SIREN du client et, si elle diffère, l'adresse de livraison deviennent des
            mentions obligatoires avec la facturation électronique. */}
        <BlocClient client={client} label="Facturé à" avecSiren avecLivraison />

        <Tableau lignes={items} />
        <Totaux
          ht={facture.total_ht}
          tva={facture.total_tva}
          ttc={facture.total_ttc}
          sousTotal={brutHt}
          remise={remiseMontant ?? undefined}
          forfait={forfait}
          acomptes={acomptes}
          ventilation={ventilationParTaux(items, facture.remise)}
        />

        {/* Sur une facture de solde, la mention des acomptes déduits est attendue : le client doit
            pouvoir rapprocher chaque déduction de la facture d'acompte qui l'a précédée. */}
        {acomptesDeduits.length > 0 && (
          <View style={styles.note}>
            <Text>
              Acompte(s) déjà facturé(s) et déduit(s) du présent solde :{" "}
              {[...new Set(acomptesDeduits.map((l) => String(l.meta?.facture_numero ?? "")).filter(Boolean))].join(", ")}
              , pour {eurPdf(acomptes)} HT. Seul le solde ci-dessus reste dû.
            </Text>
          </View>
        )}

        {/* Franchise en base : sans cette mention, l'absence de TVA sur la facture est irrégulière. */}
        {!atelier.assujetti_tva && (
          <Text style={[styles.mentionsTexte, { marginTop: 14, fontSize: 8 }]}>
            TVA non applicable, article 293 B du CGI.
          </Text>
        )}
        {atelier.tva_sur_debits && (
          <Text style={[styles.mentionsTexte, { fontSize: 8 }]}>
            Option pour le paiement de la TVA d&apos;après les débits.
          </Text>
        )}

        {/* Pas de coordonnées bancaires sur un avoir ni sur un document annulé : rien n'est dû. */}
        {aRegler && atelier.iban && (
          <View style={styles.note}>
            <Text>
              Virement : IBAN {atelier.iban}
              {atelier.bic ? ` · BIC ${atelier.bic}` : ""}
            </Text>
          </View>
        )}

        {/* Mentions obligatoires de facture — art. L441-9 du code de commerce
            et art. 242 nonies A de l'annexe II au CGI. */}
        <View style={styles.mentions}>
          {identiteEmetteur(atelier) ? (
            <Text style={styles.mentionsTexte}>{identiteEmetteur(atelier)}</Text>
          ) : null}
          {aRegler ? (
            <>
              <Text style={styles.mentionsTexte}>
                Paiement à {client.delai_paiement_jours ?? atelier.delai_paiement_jours} jours à compter de la date d&apos;émission. En cas de retard,
                pénalités au taux annuel de {atelier.penalites_taux} % et indemnité forfaitaire pour frais de recouvrement
                de 40 € (art. L441-10 et D441-5 du code de commerce).
              </Text>
              <Text style={styles.mentionsTexte}>
                {atelier.escompte_texte || "Pas d'escompte pour paiement anticipé."}
              </Text>
            </>
          ) : (
            <Text style={styles.mentionsTexte}>
              {annulee
                ? "Document annulé : il n'appelle aucun règlement."
                : "Cet avoir vient en déduction du compte du client et n'appelle aucun règlement."}
            </Text>
          )}
          {atelier.assurance_nom ? (
            <Text style={styles.mentionsTexte}>
              Assurance professionnelle : {atelier.assurance_nom}
              {atelier.assurance_contrat ? ` — contrat ${atelier.assurance_contrat}` : ""}
              {atelier.assurance_zone ? ` — couverture : ${atelier.assurance_zone}` : ""}.
            </Text>
          ) : null}
          {/* C6 — mention obligatoire du médiateur de la consommation pour un client particulier. */}
          {client.type === "particulier" && (
            atelier.mediateur_nom ? (
              <Text style={styles.mentionsTexte}>
                Médiateur de la consommation : {atelier.mediateur_nom}
                {atelier.mediateur_adresse ? ` — ${atelier.mediateur_adresse}` : ""}.
              </Text>
            ) : (
              <Text style={styles.mentionsTexte}>
                Médiateur de la consommation : non renseigné par l&apos;atelier (Réglages → Atelier).
              </Text>
            )
          )}
        </View>

        <PiedPage />
      </Page>
      {cgv && <AnnexeCgv texte={cgv} />}
    </Document>
  );
}

// ── Devis ────────────────────────────────────────────────────────────────────

export function DevisDocument({
  devis,
  client,
  atelier,
  logo,
  cgvTexte,
}: {
  devis: Devis;
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
  /**
   * Conditions générales de vente à annexer (migration 76) : le texte figé du devis
   * (`devis.cgv_texte`) s'il existe, sinon — sur un brouillon — celui en vigueur
   * (`client.cgv ?? atelier.cgv`), calculé par l'appelant. `undefined`/vide/blanc = pas d'annexe.
   */
  cgvTexte?: string | null;
}) {
  const accent = accentAtelier(atelier);
  const cgv = cgvTexte?.trim() || null;
  const items: DevisItem[] = devis.items ?? [];
  // C5 — une option pas encore retenue s'affiche (avec son prix, pour que le client sache ce qu'il
  // ajouterait) mais ne pèse dans aucun total : les fonctions de totaux ne voient que les lignes
  // facturables, sinon le bloc de totaux du PDF ne s'additionnerait plus (cf. lib/calculs.ts).
  const itemsFacturables = lignesFacturables(items);
  const brutHt = sousTotalRemisable(itemsFacturables);
  const remiseMontant = devis.remise ? remiseAffichee(itemsFacturables, devis.remise, devis.total_ht) : null;
  const forfait = montantForfaitMinimum(itemsFacturables);
  const montantAcompteDevis = montantAcompte(devis.total_ttc, devis.acompte_pct);

  const lignes = items.map((it) => {
    const optionEnAttente = it.optionnel && !it.optionnel_accepte;
    const suffixe = it.type === "m2" && it.meta ? ` (${nombreFr(it.meta.surface)} m², ${it.meta.finition})` : "";
    return {
      ...it,
      libelle: `${it.libelle}${suffixe}${optionEnAttente ? " — en option" : it.optionnel ? " — option retenue" : ""}`.replace(/[  ]/g, " "),
    };
  });

  return (
    <Document title={`Devis ${devis.numero ?? ""}`.trim()} author={atelier.nom} creator="Thermogestion" producer="Thermogestion">
      <Page size="A4" style={styles.page}>
        <Entete atelier={atelier} logo={logo} />

        <Text style={[styles.titre, { color: accent }]}>Devis {devis.numero ?? "(brouillon)"}</Text>
        {/* La date d'émission est `envoye_at` : `created_at` est la date de saisie du brouillon,
            et depuis la migration 45 c'est bien `envoye_at` qui fait courir la validité. La date
            d'échéance est écrite en clair — un client qui lit « jusqu'au 20 septembre » se décide
            plus vite qu'avec « valable 30 jours », et le délai devient opposable des deux côtés. */}
        <Text style={styles.sousTitre}>
          Émis le {dateFr(devis.envoye_at ?? devis.created_at)} · valable {devis.validite_jours} jours,
          jusqu&apos;au {dateFr(echeanceDevisAffichable(devis))} inclus
        </Text>

        <BlocClient client={client} label="Destinataire" avecSiren />

        <Tableau lignes={lignes} />
        <Totaux
          ht={devis.total_ht}
          tva={devis.total_tva}
          ttc={devis.total_ttc}
          sousTotal={brutHt}
          remise={remiseMontant ?? undefined}
          forfait={forfait}
          ventilation={ventilationParTaux(itemsFacturables, devis.remise)}
        />

        {/* C1 — l'acompte demandé à la signature, chiffré : le client sait exactement ce qu'il
            paiera d'entrée et ce qu'il restera devoir. */}
        {montantAcompteDevis > 0 && (
          <View style={styles.note}>
            <Text>
              Acompte à la commande : {nombreFr(devis.acompte_pct)} % du total TTC, soit {eurPdf(montantAcompteDevis)},
              demandés à la signature de ce devis. Solde restant : {eurPdf(devis.total_ttc - montantAcompteDevis)}.
            </Text>
          </View>
        )}

        {devis.notes ? (
          <View style={styles.note}>
            <Text>{devis.notes}</Text>
          </View>
        ) : null}

        <View style={styles.signature} wrap={false}>
          <View style={styles.cadreSignature}>
            <Text style={styles.blocLabel}>Bon pour accord</Text>
            {devis.signed_at ? (
              <>
                <Text style={[styles.gras, { marginTop: 6 }]}>Devis accepté le {dateFr(devis.signed_at)}</Text>
                {devis.signed_by ? <Text style={{ marginTop: 2 }}>Par {devis.signed_by}</Text> : null}
                <Text style={[styles.petit, { marginTop: 6 }]}>
                  Signature électronique horodatée, conservée par l&apos;atelier.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.petit, { marginTop: 6 }]}>
                  Date, nom et signature précédés de la mention « Bon pour accord » :
                </Text>
                <Text style={[styles.petit, { marginTop: 34 }]}>
                  Devis valable {devis.validite_jours} jours à compter de son émission, soit
                  jusqu&apos;au {dateFr(echeanceDevisAffichable(devis))} inclus.
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.mentions}>
          {identiteEmetteur(atelier) ? (
            <Text style={styles.mentionsTexte}>{identiteEmetteur(atelier)}</Text>
          ) : null}
          {/* Un devis chiffre une opération non encore facturée : le prix ne peut pas être annoncé
              TTC si l'atelier relève de la franchise en base sans le préciser. */}
          {!atelier.assujetti_tva && (
            <Text style={styles.mentionsTexte}>TVA non applicable, article 293 B du CGI.</Text>
          )}
          {/* Même règle que sur la facture : le délai négocié avec le client prime. Annoncer 30
              jours sur le devis puis 45 sur la facture, c'est deux documents contradictoires sur
              le même chantier. */}
          <Text style={styles.mentionsTexte}>
            Paiement à {joursPaiement(client.delai_paiement_jours, atelier.delai_paiement_jours)} jours. En cas de retard, pénalités au taux annuel de{" "}
            {atelier.penalites_taux} % et indemnité forfaitaire pour frais de recouvrement de 40 €.
          </Text>
          {atelier.assurance_nom ? (
            <Text style={styles.mentionsTexte}>
              Assurance professionnelle : {atelier.assurance_nom}
              {atelier.assurance_contrat ? ` — contrat ${atelier.assurance_contrat}` : ""}
              {atelier.assurance_zone ? ` — couverture : ${atelier.assurance_zone}` : ""}.
            </Text>
          ) : null}
          {/* C6 — mentions B2C. Un client particulier doit connaître son médiateur de la
              consommation (art. L616-1 du code de la consommation) ; si l'atelier ne l'a pas
              renseigné, le PDF le signale plutôt que de garder le silence sur une obligation non
              tenue.
              Défaut n°3 (recette vague 3) — la mention de rétractation était posée derrière
              `devis.signature_hors_etablissement`, une colonne qui vaut `false` par défaut et que
              rien dans l'application n'écrit jamais (aucun écran ne demande « signé en atelier ou
              hors établissement ? ») : la mention n'est donc JAMAIS sortie sur aucun devis. Faute
              de savoir où la signature a réellement eu lieu, on l'affiche par défaut, formulée au
              conditionnel — c'est l'atelier qui reste juge de la situation réelle, mais le client
              particulier est informé de son droit dans tous les cas. Si `signature_hors_etablissement`
              est un jour vraiment posé à `true` quelque part, la formulation devient ferme. */}
          {client.type === "particulier" && (
            <>
              {atelier.mediateur_nom ? (
                <Text style={styles.mentionsTexte}>
                  Médiateur de la consommation : {atelier.mediateur_nom}
                  {atelier.mediateur_adresse ? ` — ${atelier.mediateur_adresse}` : ""}.
                </Text>
              ) : (
                <Text style={styles.mentionsTexte}>
                  Médiateur de la consommation : non renseigné par l&apos;atelier (Réglages → Atelier).
                </Text>
              )}
              {devis.signature_hors_etablissement ? (
                <Text style={styles.mentionsTexte}>
                  Ce devis a été signé hors établissement : vous disposez d&apos;un délai de 14 jours à
                  compter de la signature pour exercer votre droit de rétractation, sans avoir à
                  justifier de motif (art. L221-18 du code de la consommation).
                </Text>
              ) : (
                <Text style={styles.mentionsTexte}>
                  Si ce devis a été signé hors de l&apos;établissement, vous disposez d&apos;un délai de
                  rétractation de 14 jours (art. L221-18 du Code de la consommation).
                </Text>
              )}
            </>
          )}
        </View>

        <PiedPage />
      </Page>
      {cgv && <AnnexeCgv texte={cgv} />}
    </Document>
  );
}

// ── Bon de livraison ─────────────────────────────────────────────────────────

export function BonLivraisonDocument({
  bl,
  client,
  atelier,
  logo,
}: {
  bl: BonLivraison;
  client: Client;
  atelier: Atelier;
  logo: LogoSource | null;
}) {
  const accent = accentAtelier(atelier);
  const lignes: LigneBL[] = bl.lignes ?? [];
  // Le BL ne stocke pas ses totaux : ils se recalculent à partir des lignes et de la remise reprise
  // du devis, comme sur la page client. Sans la remise, ce PDF contredisait la facture.
  const totaux = calcTotaux(lignes, bl.remise);
  const brutHt = sousTotalRemisable(lignes);
  const remiseMontant = bl.remise && bl.remise.valeur > 0 ? remiseAffichee(lignes, bl.remise, totaux.total_ht) : null;
  const forfait = montantForfaitMinimum(lignes);
  const colisage = [
    bl.nb_colis ? `${bl.nb_colis} colis` : null,
    bl.poids_kg ? `${nombreFr(bl.poids_kg).replace(/[  ]/g, " ")} kg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document
      title={`Bon de livraison ${bl.numero ?? ""}`.trim()}
      author={atelier.nom}
      creator="Thermogestion"
      producer="Thermogestion"
    >
      <Page size="A4" style={styles.page}>
        <Entete atelier={atelier} logo={logo} />

        <Text style={[styles.titre, { color: accent }]}>Bon de livraison {bl.numero ?? "(brouillon)"}</Text>
        <Text style={styles.sousTitre}>
          Émis le {dateFr(bl.created_at)}
          {bl.livre_at ? ` · livré le ${dateFr(bl.livre_at)}` : ""}
        </Text>

        <BlocClient client={client} label="Livré à" avecLivraison />

        <Tableau lignes={lignes} />
        <Totaux
          ht={totaux.total_ht}
          tva={totaux.total_tva}
          ttc={totaux.total_ttc}
          sousTotal={brutHt}
          remise={remiseMontant ?? undefined}
          forfait={forfait}
        />

        {colisage ? <Text style={{ marginTop: 12 }}>{colisage}</Text> : null}

        {bl.note ? (
          <View style={styles.note}>
            <Text>{bl.note}</Text>
          </View>
        ) : null}

        <View style={styles.signature} wrap={false}>
          <View style={styles.cadreSignature}>
            <Text style={styles.blocLabel}>Bon pour réception</Text>
            {bl.signed_at ? (
              <>
                <Text style={[styles.gras, { marginTop: 6 }]}>Réception confirmée le {dateFr(bl.signed_at)}</Text>
                {bl.recu_par ? <Text style={{ marginTop: 2 }}>Par {bl.recu_par}</Text> : null}
                <Text style={[styles.petit, { marginTop: 6 }]}>Signature électronique horodatée.</Text>
              </>
            ) : (
              <>
                <Text style={[styles.petit, { marginTop: 6 }]}>
                  Vérifiez le nombre de colis et l&apos;état des pièces avant de signer.
                </Text>
                <Text style={[styles.petit, { marginTop: 30 }]}>Date, nom et signature :</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.mentions}>
          {identiteEmetteur(atelier) ? (
            <Text style={styles.mentionsTexte}>{identiteEmetteur(atelier)}</Text>
          ) : null}
          <Text style={styles.mentionsTexte}>
            Les réserves éventuelles doivent être portées sur ce bon au moment de la remise des pièces.
          </Text>
        </View>

        <PiedPage />
      </Page>
    </Document>
  );
}
