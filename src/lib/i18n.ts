/**
 * Français / italien pour les pages que voit le client final.
 *
 * Le périmètre est assumé : les écrans de l'atelier restent en français, ce sont les documents
 * qui partent chez le client — devis, facture, bon de livraison, bon de réception, suivi — qui
 * sont traduits. C'est là que la langue décide si un client italien signe ou appelle pour
 * demander ce que veut dire « Bon pour accord ».
 *
 * Les mentions légales françaises (293 B du CGI, L441-10 du code de commerce) ne sont **pas**
 * traduites : ce sont des citations de textes français, et une traduction libre leur ferait perdre
 * leur valeur. Elles restent en français sur la facture, quelle que soit la langue d'affichage.
 */

export const LANGUES = ["fr", "it"] as const;
export type Langue = (typeof LANGUES)[number];

export const NOM_LANGUE: Record<Langue, string> = { fr: "Français", it: "Italiano" };

/** Étiquette de la locale pour `toLocaleString` : les séparateurs de milliers diffèrent. */
const LOCALE: Record<Langue, string> = { fr: "fr-FR", it: "it-IT" };

export function estLangue(v: string | null | undefined): v is Langue {
  return !!v && (LANGUES as readonly string[]).includes(v);
}

/**
 * Langue retenue pour la page : le paramètre d'URL d'abord (c'est ce que l'atelier envoie dans
 * son lien), puis le choix mémorisé, puis la langue du navigateur. Tout le reste tombe en
 * français — la clientèle est française par défaut.
 */
export function langueInitiale(param?: string | null): Langue {
  if (estLangue(param)) return param;
  if (typeof window !== "undefined") {
    const memo = window.localStorage.getItem("tg_langue");
    if (estLangue(memo)) return memo;
    const nav = window.navigator.language?.slice(0, 2).toLowerCase();
    if (estLangue(nav)) return nav;
  }
  return "fr";
}

export function euroL(n: number | string | null | undefined, l: Langue) {
  const v = Number(n ?? 0);
  return (Number.isNaN(v) ? 0 : v).toLocaleString(LOCALE[l], { style: "currency", currency: "EUR" });
}

export function dateL(d: string | null | undefined, l: Langue) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(LOCALE[l]);
}

export function dateHeureL(d: string | null | undefined, l: Langue) {
  if (!d) return "—";
  return new Date(d).toLocaleString(LOCALE[l], { dateStyle: "long", timeStyle: "short" });
}

export function nombreL(n: number | string | null | undefined, l: Langue, max = 2) {
  const v = Number(n ?? 0);
  return (Number.isNaN(v) ? 0 : v).toLocaleString(LOCALE[l], { maximumFractionDigits: max });
}

type Textes = {
  imprimer: string;
  imprimerAria: string;
  designation: string;
  qte: string;
  puHt: string;
  totalLigneHt: string;
  sousTotalHt: string;
  remise: string;
  /** Plancher de facturation, ajouté après la remise : sans cette ligne, le total ne se recalcule pas. */
  forfaitMinimum: string;
  totalHt: string;
  tva: string;
  totalTtc: string;
  pour: string;
  emisLe: string;
  valable: string;
  jours: string;
  // Devis
  devis: string;
  bonPourAccord: string;
  bonPourAccordAide: string;
  votreNom: string;
  signature: string;
  signatureInvite: string;
  signatureEffacer: string;
  signer: string;
  envoi: string;
  signerAide: string;
  signerMention: (montant: string) => string;
  devisAccepte: string;
  devisAccepteLe: (date: string) => string;
  devisAccepteAide: string;
  devisNonSignable: (statut: string) => string;
  /** Le statut affiché au client doit être un mot, pas le code interne (« refuse », « expire »). */
  statutsDevis: Record<string, string>;
  /**
   * Message générique d'échec technique — réseau, RLS, ou toute erreur non identifiée. C'est le
   * SEUL cas où on ne sait vraiment pas ce qui s'est passé : il dit de réessayer, et donne un
   * recours immédiat (le téléphone de l'atelier, s'il est connu) plutôt que de laisser le client
   * deviner. Les cas identifiés (expiré, déjà signé, démonstration) ont chacun leur propre message,
   * plus honnête.
   */
  erreurSignatureDevis: (tel?: string | null) => string;
  /** `signer_devis` renvoie `false` sans distinguer la cause : un devis déjà signé par quelqu'un
   *  d'autre (double clic, deux onglets) n'est pas un échec — on le dit tel quel. */
  erreurDevisDejaSigne: string;
  /** L'atelier de démonstration refuse toute écriture (`DEMO_LECTURE_SEULE`) : un visiteur qui
   *  essaie de signer ne doit pas croire à un bug. */
  erreurDemo: string;
  /**
   * L'échéance en toutes lettres. « Valable jusqu'au 20 septembre » se décide plus vite que
   * « valable 30 jours » : le client n'a pas à compter, et il voit que le délai est réel.
   */
  valableJusquau: (date: string) => string;
  /** Le devis a dépassé sa validité : la base refuse la signature, la page doit le dire avant. */
  devisPerimeTitre: string;
  devisPerimeAide: (date: string) => string;
  /** Refus renvoyé par `signer_devis` (code `DEVIS_EXPIRE`), traduit pour le client. */
  erreurDevisExpire: string;
  // Facture
  facture: string;
  /** Titre du document selon son type : un avoir n'est pas une facture, et le dire évite un litige. */
  typesFacture: Record<string, string>;
  factureAnnulee: string;
  factureAnnuleeAide: string;
  avoirMention: string;
  rienARegler: string;
  factureALe: string;
  nonEmise: string;
  echeance: string;
  factureA: string;
  livraison: string;
  virement: string;
  payer: (montant: string) => string;
  paiementSecurise: string;
  paiementVirement: string;
  paiementIndispo: string;
  factureReglee: string;
  merci: string;
  natures: Record<string, string>;
  // Bon de livraison
  bonLivraison: string;
  livreLe: string;
  colis: string;
  bonPourReception: string;
  bonPourReceptionAide: string;
  confirmerReception: string;
  receptionConfirmee: string;
  receptionConfirmeeLe: (date: string) => string;
  receptionMerci: string;
  blNonSignable: string;
  /** Même principe que `erreurSignatureDevis` : réseau/technique uniquement, avec un recours. */
  erreurSignatureBl: (tel?: string | null) => string;
  // Bon de réception
  bonReception: string;
  piecesRecuesLe: string;
  deposePar: string;
  remisPar: string;
  nbPieces: string;
  etatConstate: string;
  reserves: string;
  photosReception: string;
  signatureDeposant: string;
  mentionReception: string;
  etats: Record<string, string>;
  // Suivi
  suiviTitre: string;
  suiviPretes: string;
  suiviLivrees: string;
  suiviAnnule: string;
  enCours: string;
  datePrevue: string;
  appelerAtelier: string;
  // Commun
  propulsePar: string;
};

const FR: Textes = {
  imprimer: "Imprimer / PDF",
  imprimerAria: "Imprimer ou enregistrer ce document en PDF",
  designation: "Désignation",
  qte: "Qté",
  puHt: "PU HT",
  totalLigneHt: "Total HT",
  sousTotalHt: "Sous-total HT",
  remise: "Remise",
  forfaitMinimum: "Forfait minimum",
  totalHt: "Total HT",
  tva: "TVA",
  totalTtc: "Total TTC",
  pour: "Pour",
  emisLe: "émis le",
  valable: "valable",
  jours: "jours",
  devis: "Devis",
  bonPourAccord: "Bon pour accord",
  bonPourAccordAide:
    "Votre signature vaut acceptation ferme de ce devis. Elle est horodatée et conservée avec le document.",
  votreNom: "Votre nom *",
  signature: "Signature *",
  signatureInvite: "Signez ici, au doigt ou à la souris",
  signatureEffacer: "Effacer",
  signer: "Accepter et signer le devis",
  envoi: "Envoi…",
  signerAide: "Renseignez votre nom et signez pour continuer.",
  signerMention: (m) => `En signant, vous acceptez ce devis pour la somme de ${m} TTC. Signature électronique horodatée.`,
  devisAccepte: "Devis accepté",
  devisAccepteLe: (d) => `Devis accepté le ${d}`,
  devisAccepteAide: "L'atelier a été prévenu et vous tiendra informé de l'avancement.",
  devisNonSignable: (s) => `Ce devis n'est plus signable (statut : ${s}).`,
  statutsDevis: { brouillon: "brouillon", envoye: "envoyé", signe: "signé", refuse: "refusé", expire: "expiré", remplace: "remplacé par une version plus récente" },
  erreurSignatureDevis: (tel) =>
    `La signature n'a pas pu être enregistrée. Réessayez` +
    (tel ? ` ; si ça persiste, appelez l'atelier au ${tel}.` : ", et contactez l'atelier si ça persiste."),
  erreurDevisDejaSigne: "Ce devis a déjà été signé.",
  erreurDemo: "Vous consultez la démonstration : rien n'y est enregistré.",
  valableJusquau: (d) => `valable jusqu'au ${d}`,
  devisPerimeTitre: "Ce devis n'est plus valable",
  devisPerimeAide: (d) =>
    `Sa durée de validité s'est achevée le ${d}. Contactez l'atelier pour en obtenir un nouveau : les prix ont pu changer depuis.`,
  erreurDevisExpire:
    "Ce devis a dépassé sa durée de validité et ne peut plus être signé. Demandez-en un nouveau à l'atelier.",
  facture: "Facture",
  typesFacture: {
    acompte: "Facture d'acompte",
    solde: "Facture de solde",
    libre: "Facture",
    avoir: "Avoir",
  },
  factureAnnulee: "Facture annulée",
  factureAnnuleeAide: "Ce document a été annulé par l'atelier : il n'y a rien à régler. Contactez l'atelier si vous avez un doute.",
  avoirMention: "Cet avoir vient en déduction de votre compte. Il n'appelle aucun règlement de votre part.",
  rienARegler: "Rien à régler sur ce document.",
  factureALe: "Émise le",
  nonEmise: "Non émise",
  echeance: "échéance",
  factureA: "Facturé à",
  livraison: "Livraison",
  virement: "Virement",
  // Le cadenas était un caractère « 🔒 » dans le texte du bouton (lot E-P1) : rendu en noir et
  // blanc sur Android, en couleur sur iOS, et lu « cadenas fermé » par un lecteur d'écran en
  // plein milieu de la phrase. Le composant appelant pose maintenant l'icône séparément.
  payer: (m) => `Payer ${m} en ligne`,
  paiementSecurise: "Paiement sécurisé par carte bancaire",
  paiementVirement: " — ou par virement (coordonnées ci-dessus)",
  paiementIndispo:
    "Paiement en ligne non disponible pour cette facture — réglez par virement ou contactez l'atelier.",
  factureReglee: "Facture réglée",
  merci: "Merci !",
  natures: {
    biens: "Livraison de biens",
    services: "Prestation de services",
    mixte: "Opération mixte (biens et services)",
  },
  bonLivraison: "Bon de livraison",
  livreLe: "livré le",
  colis: "colis",
  bonPourReception: "Bon pour réception",
  bonPourReceptionAide:
    "Signez à la remise de vos pièces. Vérifiez le nombre de colis et l'état des pièces avant de signer.",
  confirmerReception: "Confirmer la réception des pièces",
  receptionConfirmee: "Réception confirmée",
  receptionConfirmeeLe: (d) => `Réception confirmée le ${d}`,
  receptionMerci: "Merci, vos pièces vous ont bien été remises.",
  blNonSignable: "Ce bon de livraison n'est pas encore signable.",
  erreurSignatureBl: (tel) =>
    `La signature n'a pas pu être enregistrée. Réessayez` +
    (tel ? ` ; si ça persiste, appelez l'atelier au ${tel}.` : ", et contactez l'atelier si ça persiste."),
  bonReception: "Bon de réception",
  piecesRecuesLe: "Pièces reçues le",
  deposePar: "Déposé par",
  remisPar: "Remis par",
  nbPieces: "Nombre de pièces",
  etatConstate: "État constaté à l'arrivée",
  reserves: "Réserves",
  photosReception: "Photos prises à la réception",
  signatureDeposant: "Signature du déposant",
  mentionReception:
    "Ce document constate l'état des pièces au moment de leur dépôt dans l'atelier. En l'absence de réclamation de votre part dans les 48 heures, il est réputé accepté.",
  etats: {
    bon: "Bon état",
    rayures: "Rayures",
    chocs: "Chocs / déformations",
    corrosion: "Corrosion",
    ancien_revetement: "Ancien revêtement",
    autre: "Autre",
  },
  suiviTitre: "Suivi de vos pièces",
  suiviPretes: "Vos pièces sont prêtes, vous pouvez venir les récupérer.",
  suiviLivrees: "Vos pièces vous ont été livrées. Merci !",
  suiviAnnule: "Ce projet a été annulé. Contactez l'atelier pour plus d'informations.",
  enCours: "En cours",
  datePrevue: "Date prévue",
  // Même raison que `payer` ci-dessus : le combiné était dans le texte, il est maintenant posé
  // comme icône par le composant appelant.
  appelerAtelier: "Appeler l'atelier",
  propulsePar: "Propulsé par",
};

const IT: Textes = {
  imprimer: "Stampa / PDF",
  imprimerAria: "Stampa o salva questo documento in PDF",
  designation: "Descrizione",
  qte: "Q.tà",
  puHt: "Prezzo unit. netto",
  totalLigneHt: "Totale netto",
  sousTotalHt: "Totale parziale netto",
  remise: "Sconto",
  forfaitMinimum: "Importo minimo di fatturazione",
  totalHt: "Totale imponibile",
  tva: "IVA",
  totalTtc: "Totale IVA inclusa",
  pour: "Per",
  emisLe: "emesso il",
  valable: "valido",
  jours: "giorni",
  devis: "Preventivo",
  bonPourAccord: "Accettazione del preventivo",
  bonPourAccordAide:
    "La sua firma vale come accettazione definitiva del preventivo. Viene registrata con data e ora e conservata insieme al documento.",
  votreNom: "Il suo nome *",
  signature: "Firma *",
  signatureInvite: "Firmi qui, con il dito o con il mouse",
  signatureEffacer: "Cancellare",
  signer: "Accettare e firmare il preventivo",
  envoi: "Invio…",
  signerAide: "Inserisca il suo nome e firmi per continuare.",
  signerMention: (m) => `Firmando, accetta questo preventivo per l'importo di ${m} IVA inclusa. Firma elettronica con data e ora.`,
  devisAccepte: "Preventivo accettato",
  devisAccepteLe: (d) => `Preventivo accettato il ${d}`,
  devisAccepteAide: "L'officina è stata avvisata e la terrà informata sull'avanzamento.",
  devisNonSignable: (s) => `Questo preventivo non è più firmabile (stato: ${s}).`,
  statutsDevis: { brouillon: "bozza", envoye: "inviato", signe: "firmato", refuse: "rifiutato", expire: "scaduto", remplace: "sostituito da una versione più recente" },
  erreurSignatureDevis: (tel) =>
    `Non è stato possibile registrare la firma. Riprovi` +
    (tel ? ` ; se il problema persiste, chiami l'officina al ${tel}.` : ", e contatti l'officina se il problema persiste."),
  erreurDevisDejaSigne: "Questo preventivo è già stato firmato.",
  erreurDemo: "Sta consultando la demo: qui non viene registrato nulla.",
  valableJusquau: (d) => `valido fino al ${d}`,
  devisPerimeTitre: "Questo preventivo non è più valido",
  devisPerimeAide: (d) =>
    `La sua validità è terminata il ${d}. Contatti l'officina per riceverne uno nuovo: i prezzi potrebbero essere cambiati.`,
  erreurDevisExpire:
    "Questo preventivo ha superato il periodo di validità e non può più essere firmato. Ne richieda uno nuovo all'officina.",
  facture: "Fattura",
  typesFacture: {
    acompte: "Fattura di acconto",
    solde: "Fattura a saldo",
    libre: "Fattura",
    avoir: "Nota di credito",
  },
  factureAnnulee: "Fattura annullata",
  factureAnnuleeAide: "Questo documento è stato annullato dall'officina: non c'è nulla da pagare. Contatti l'officina in caso di dubbi.",
  avoirMention: "Questa nota di credito viene detratta dal suo conto. Non richiede alcun pagamento da parte sua.",
  rienARegler: "Nessun importo da pagare su questo documento.",
  factureALe: "Emessa il",
  nonEmise: "Non emessa",
  echeance: "scadenza",
  factureA: "Fatturato a",
  livraison: "Consegna",
  virement: "Bonifico",
  payer: (m) => `Pagare ${m} online`,
  paiementSecurise: "Pagamento sicuro con carta di credito",
  paiementVirement: " — oppure con bonifico (coordinate qui sopra)",
  paiementIndispo:
    "Pagamento online non disponibile per questa fattura — effettui un bonifico o contatti l'officina.",
  factureReglee: "Fattura saldata",
  merci: "Grazie!",
  natures: {
    biens: "Cessione di beni",
    services: "Prestazione di servizi",
    mixte: "Operazione mista (beni e servizi)",
  },
  bonLivraison: "Bolla di consegna",
  livreLe: "consegnato il",
  colis: "colli",
  bonPourReception: "Conferma di ricevimento",
  bonPourReceptionAide:
    "Firmi al momento della consegna dei pezzi. Verifichi il numero di colli e lo stato dei pezzi prima di firmare.",
  confirmerReception: "Confermare il ricevimento dei pezzi",
  receptionConfirmee: "Ricevimento confermato",
  receptionConfirmeeLe: (d) => `Ricevimento confermato il ${d}`,
  receptionMerci: "Grazie, i suoi pezzi le sono stati consegnati.",
  blNonSignable: "Questa bolla di consegna non è ancora firmabile.",
  erreurSignatureBl: (tel) =>
    `Non è stato possibile registrare la firma. Riprovi` +
    (tel ? ` ; se il problema persiste, chiami l'officina al ${tel}.` : ", e contatti l'officina se il problema persiste."),
  bonReception: "Bolla di presa in carico",
  piecesRecuesLe: "Pezzi ricevuti il",
  deposePar: "Depositato da",
  remisPar: "Consegnato da",
  nbPieces: "Numero di pezzi",
  etatConstate: "Stato rilevato all'arrivo",
  reserves: "Riserve",
  photosReception: "Foto scattate al ricevimento",
  signatureDeposant: "Firma del depositante",
  mentionReception:
    "Questo documento attesta lo stato dei pezzi al momento del deposito in officina. In assenza di reclamo entro 48 ore, si considera accettato.",
  etats: {
    bon: "Buono stato",
    rayures: "Graffi",
    chocs: "Urti / deformazioni",
    corrosion: "Corrosione",
    ancien_revetement: "Rivestimento preesistente",
    autre: "Altro",
  },
  suiviTitre: "Stato dei suoi pezzi",
  suiviPretes: "I suoi pezzi sono pronti, può venire a ritirarli.",
  suiviLivrees: "I suoi pezzi le sono stati consegnati. Grazie!",
  suiviAnnule: "Questo progetto è stato annullato. Contatti l'officina per maggiori informazioni.",
  enCours: "In corso",
  datePrevue: "Data prevista",
  appelerAtelier: "Chiamare l'officina",
  propulsePar: "Realizzato con",
};

export const TEXTES: Record<Langue, Textes> = { fr: FR, it: IT };

export function textes(l: Langue) {
  return TEXTES[l];
}

/**
 * Quantité + unité dans la langue d'affichage. Les unités techniques (m², ml, kg) s'écrivent
 * pareil dans les deux langues ; « pièce » et « heure », non — et c'est ce qui saute aux yeux
 * d'un client italien sur une ligne de devis.
 */
const UNITES_L: Record<Langue, Record<string, string>> = {
  fr: { m2: "m²", ml: "ml", piece: "pièce", pieces: "pièces", kg: "kg", heure: "h", forfait: "forfait" },
  it: { m2: "m²", ml: "ml", piece: "pz", pieces: "pz", kg: "kg", heure: "h", forfait: "forfait" },
};

export function qteL(qte: unknown, unite: string | null | undefined, l: Langue) {
  if (unite === "forfait") return "—";
  const n = Number(qte ?? 0);
  const table = UNITES_L[l];
  const libelle = !unite ? "" : unite === "piece" && n > 1 ? table.pieces : table[unite] ?? unite;
  return `${nombreL(n, l, 3)} ${libelle}`.trim();
}
