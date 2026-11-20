/**
 * Réception de factures fournisseurs — couche d'ingestion AGNOSTIQUE (amélioration n°1,
 * AMELIORATIONS-07-09-2026.md).
 *
 * POURQUOI ce fichier existe alors qu'on pourrait écrire directement dans `factures_recues` depuis
 * l'écran de dépôt manuel. La réception de factures électroniques passera un jour par une
 * Plateforme Agréée — obligation en vigueur depuis le 01/09/2026, partenaire pas encore choisi par
 * Alexis (décision de 4 à 8 semaines, hors code, cf. le document ci-dessus). Ce choix fait, un
 * webhook recevra des factures SANS intervention humaine : pas de fichier choisi à la souris, pas
 * de session utilisateur, et le document arrivera vraisemblablement déjà structuré (XML CII/UBL,
 * avec ou sans PDF joint) plutôt que comme un PDF à ouvrir.
 *
 * En faisant transiter les DEUX chemins — le dépôt manuel d'aujourd'hui et le webhook de demain —
 * par la même fonction `ingererFactureRecue()`, le jour du branchement :
 *   - la table, la RLS, les triggers et l'écran `/factures-recues` ne changent PAS ;
 *   - le webhook n'a qu'à construire un `DocumentEntrant` à partir de sa charge utile et appeler
 *     cette fonction avec `provenance: "plateforme_agreee"`, en lui passant un client Supabase
 *     `service_role` (le webhook n'a pas de session utilisateur — voir plus bas la raison pour
 *     laquelle `atelierId` est un paramètre explicite plutôt que déduit de `current_atelier_id()`).
 *
 * CE QUI RESTE À ÉCRIRE LE JOUR DU CHOIX DU PARTENAIRE (volontairement ABSENT d'ici, et de tout ce
 * fichier) :
 *   1. Le connecteur propriétaire de la plateforme retenue : authentification, abonnement aux
 *      notifications de factures reçues, format exact de la charge utile de son webhook — chaque
 *      plateforme a le sien, deviner aujourd'hui reviendrait à coder contre une API qui n'existe
 *      pas et à le jeter au choix réel (c'est exactement ce que le cadrage du 07/09/2026 demande
 *      d'éviter).
 *   2. La route API qui reçoit ce webhook (`/api/reception/<plateforme>` ou équivalent), qui doit
 *      vérifier la signature/l'authenticité de l'appel avant d'appeler `ingererFactureRecue()`.
 *   3. La correspondance entre l'identifiant d'atelier côté plateforme (SIREN, identifiant de
 *      compte PA) et `atelier_id` côté Thermogestion — probablement une colonne sur `ateliers`,
 *      qui n'existe pas encore puisqu'aucune plateforme n'est choisie.
 *   4. Éventuellement, l'accusé de réception technique que certaines plateformes exigent en retour
 *      du webhook (« j'ai bien reçu, voici mon identifiant interne ») — dépend de l'API retenue.
 * Rien de tout cela n'est esquissé : ni signature de fonction, ni format de payload, ni nom de
 * variable d'environnement pour une clé qui n'existe pas encore.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extraireXmlDuPdf,
  formatXmlFacture,
  lireFactureXml,
  type DonneesLuesFacture,
} from "@/lib/facturx/lecture";
import { nomSain, TAILLE_MAX_OCTETS } from "@/lib/pieces-jointes";

export type ProvenanceFactureRecue = "depot_manuel" | "plateforme_agreee";
export type FormatSourceFactureRecue = "factur-x" | "ubl" | "cii" | "pdf_simple";

/** Un document reçu, indépendamment de son transport (glisser-déposer aujourd'hui, webhook demain). */
export type DocumentEntrant = {
  nom: string;
  mime: string;
  octets: Uint8Array;
};

export type ResultatIngestion = {
  id: string;
  formatSource: FormatSourceFactureRecue;
  /** Ce que l'atelier doit savoir avant de considérer la fiche complète — jamais bloquant. */
  avertissements: string[];
};

const MIME_PDF = "application/pdf";
const MIMES_XML = ["text/xml", "application/xml"];

function estPdf(doc: DocumentEntrant): boolean {
  return doc.mime === MIME_PDF || /\.pdf$/i.test(doc.nom);
}
function estXml(doc: DocumentEntrant): boolean {
  return MIMES_XML.includes(doc.mime) || /\.xml$/i.test(doc.nom);
}

/**
 * Le motif de refus, ou `null` si le document passe. Même bornes que les pièces jointes
 * ordinaires (`TAILLE_MAX_OCTETS`, 10 Mo) : une facture fournisseur n'a aucune raison de peser
 * plus qu'un plan de chantier, et la table porte la même contrainte en base (défense en profondeur).
 */
export function refusDeDocument(doc: DocumentEntrant): string | null {
  if (doc.octets.length <= 0) return `« ${doc.nom} » est vide.`;
  if (doc.octets.length > TAILLE_MAX_OCTETS) {
    return `« ${doc.nom} » dépasse la taille maximale acceptée (10 Mo).`;
  }
  if (!estPdf(doc) && !estXml(doc)) {
    return `« ${doc.nom} » n'est ni un PDF ni un XML de facture (CII ou UBL).`;
  }
  return null;
}

/**
 * Point d'entrée UNIQUE de réception d'une facture fournisseur, quelle que soit sa provenance.
 *
 * Déroulé :
 *  1. Extraction best-effort (Factur-X → XML CII embarqué ; XML nu → CII ou UBL ; sinon
 *     `pdf_simple`, rien à lire).
 *  2. Insertion de la fiche (statut `a_traiter`), pour obtenir un identifiant.
 *  3. Si un PDF a été fourni, envoi dans le bucket `documents` (famille `comptable`, cf. migration
 *     66) puis mise à jour de la fiche avec son chemin. Un échec à cette étape retire la fiche
 *     plutôt que de laisser une ligne « fantôme » sans document associé — même précaution que
 *     `PiecesJointes.tsx` pour les pièces jointes ordinaires.
 *
 * `atelierId` est un paramètre explicite, jamais déduit de la session : c'est ce qui rend la
 * fonction utilisable aussi bien depuis un écran (session `authenticated`, RLS active — la valeur
 * doit de toute façon coïncider avec `current_atelier_id()` ou l'écriture sera refusée) que,
 * demain, depuis un webhook `service_role` qui n'a pas de session du tout.
 */
export async function ingererFactureRecue(params: {
  supabase: SupabaseClient;
  atelierId: string;
  provenance: ProvenanceFactureRecue;
  document: DocumentEntrant;
  /** Document XML séparé, quand le PDF et le structuré arrivent en deux fichiers distincts —
   *  cas possible d'un futur webhook de Plateforme Agréée, absent du dépôt manuel d'aujourd'hui. */
  documentXml?: DocumentEntrant | null;
  utilisateurId?: string | null;
}): Promise<ResultatIngestion> {
  const { supabase, atelierId, provenance, document, documentXml } = params;
  const avertissements: string[] = [];

  const refus = refusDeDocument(document);
  if (refus) throw new Error(refus);
  if (documentXml) {
    const refusXml = refusDeDocument(documentXml);
    if (refusXml) throw new Error(refusXml);
  }

  let formatSource: FormatSourceFactureRecue = "pdf_simple";
  let donnees: DonneesLuesFacture | null = null;
  let xmlBrut: string | null = null;
  let pdfOctets: Uint8Array | null = null;
  let pdfNom: string | null = null;
  let tailleOctets = document.octets.length;

  if (estPdf(document)) {
    pdfOctets = document.octets;
    pdfNom = document.nom;
  }
  // Si `document` n'est pas un PDF, c'est forcément du XML nu (seuls ces deux types passent
  // `refusDeDocument` ci-dessus) : pas de PDF à archiver, juste le structuré à lire plus bas.

  // XML à lire : celui fourni séparément prime (charge utile explicite d'un futur webhook), sinon
  // celui embarqué dans le PDF, sinon celui du document lui-même s'il est directement du XML.
  let sourceXmlBrut: string | null = null;
  if (documentXml) {
    sourceXmlBrut = new TextDecoder("utf-8").decode(documentXml.octets);
    tailleOctets += documentXml.octets.length;
  } else if (pdfOctets) {
    const piece = await extraireXmlDuPdf(pdfOctets);
    if (piece) sourceXmlBrut = piece.xml;
  } else if (estXml(document)) {
    sourceXmlBrut = new TextDecoder("utf-8").decode(document.octets);
  }

  if (sourceXmlBrut) {
    const format = formatXmlFacture(sourceXmlBrut);
    if (format) {
      xmlBrut = sourceXmlBrut;
      formatSource = pdfOctets ? "factur-x" : format;
      donnees = lireFactureXml(sourceXmlBrut, format);
    } else if (pdfOctets) {
      avertissements.push(
        "Un fichier XML est joint au PDF, mais son format n'a été reconnu ni comme CII ni comme UBL : à saisir à la main.",
      );
    } else {
      throw new Error(`« ${document.nom} » est un XML, mais son format n'est reconnu ni comme CII ni comme UBL.`);
    }
  } else if (pdfOctets) {
    avertissements.push("Aucun XML structuré trouvé dans ce PDF : à saisir à la main (PDF simple).");
  }

  if (donnees) {
    const manques: string[] = [];
    if (!donnees.numero) manques.push("le numéro de facture");
    if (!donnees.fournisseurNom) manques.push("le nom du fournisseur");
    if (donnees.totalTtc == null) manques.push("le montant TTC");
    if (manques.length > 0) {
      avertissements.push(`Extraction partielle : il manque ${manques.join(", ")}. Complétez la fiche.`);
    }
  }

  const ligne = {
    atelier_id: atelierId,
    provenance,
    format_source: formatSource,
    statut: "a_traiter" as const,
    fournisseur_nom: donnees?.fournisseurNom ?? null,
    fournisseur_siren: donnees?.fournisseurSiren ?? null,
    fournisseur_tva: donnees?.fournisseurTva ?? null,
    numero: donnees?.numero ?? null,
    date_emission: donnees?.dateEmission ?? null,
    date_echeance: donnees?.dateEcheance ?? null,
    total_ht: donnees?.totalHt ?? null,
    total_tva: donnees?.totalTva ?? null,
    total_ttc: donnees?.totalTtc ?? null,
    devise: donnees?.devise ?? "EUR",
    xml_brut: xmlBrut,
    nom_fichier_origine: document.nom.slice(0, 255),
    taille_octets: tailleOctets,
    created_by: params.utilisateurId ?? null,
  };

  const { data: inseree, error: errInsert } = await supabase
    .from("factures_recues")
    .insert(ligne)
    .select("id")
    .single();
  if (errInsert) throw new Error(errInsert.message);
  const id = (inseree as { id: string }).id;

  if (pdfOctets && pdfNom) {
    const chemin = `${atelierId}/comptable/${id}/${Date.now()}-${nomSain(pdfNom)}`;
    const { error: errUpload } = await supabase.storage
      .from("documents")
      .upload(chemin, pdfOctets, { contentType: MIME_PDF });
    if (errUpload) {
      // Rattrapage : une fiche sans aucun document (ni PDF, ni parfois même de XML pour un dépôt
      // `pdf_simple` raté) n'aide personne — mieux vaut faire échouer tout le dépôt et laisser
      // l'atelier réessayer que de laisser une ligne muette dans « à traiter ».
      await supabase.from("factures_recues").delete().eq("id", id);
      throw new Error(`Envoi du PDF impossible : ${errUpload.message}`);
    }
    const { error: errMaj } = await supabase
      .from("factures_recues")
      .update({ storage_path_pdf: chemin })
      .eq("id", id);
    if (errMaj) {
      await supabase.storage.from("documents").remove([chemin]);
      await supabase.from("factures_recues").delete().eq("id", id);
      throw new Error(`Enregistrement du PDF impossible : ${errMaj.message}`);
    }
  }

  return { id, formatSource, avertissements };
}
