import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { emballerFacturX } from "@/lib/facturx/pdf";
import { manquesFacturX, NOM_PROFIL, xmlFacturX, type DonneesFacturX } from "@/lib/facturx/xml";
import type { Atelier, Client, Facture } from "@/lib/types";
import { factureARegler } from "@/lib/utils";

/**
 * Conditions de paiement en clair (BT-20). C'est le même texte que celui imprimé au pied du PDF :
 * le XML et la représentation lisible doivent dire la même chose, sinon les deux se contredisent
 * dans le dossier du client.
 */
export function conditionsPaiement(atelier: Atelier, client: Client, aRegler: boolean): string {
  if (!aRegler) return "Ce document n'appelle aucun règlement.";
  const jours = client.delai_paiement_jours ?? atelier.delai_paiement_jours;
  const escompte = atelier.escompte_texte || "Pas d'escompte pour paiement anticipé.";
  return (
    `Paiement à ${jours} jours à compter de la date d'émission. ` +
    `En cas de retard, pénalités au taux annuel de ${atelier.penalites_taux} % ` +
    `et indemnité forfaitaire pour frais de recouvrement de 40 €. ${escompte}`
  );
}

/** Passerelle entre le modèle de données de l'application et les champs normalisés du CII. */
export function donneesFacturX(
  facture: Facture & { devis?: { numero: string | null } | null },
  client: Client,
  atelier: Atelier,
  referenceCommande?: string | null,
): DonneesFacturX {
  // Ni un avoir, ni un document annulé, ni une facture à zéro euro n'appellent de règlement :
  // pas d'échéance à annoncer, pas d'IBAN à créditer.
  const aRegler = factureARegler(facture);

  return {
    facture: {
      numero: facture.numero ?? "",
      type: facture.type,
      // La date d'émission fait foi ; sans émission, la date de création tient lieu de repère.
      date: facture.emise_at ?? facture.created_at,
      lignes: (facture.items ?? []).map((i) => ({
        libelle: i.libelle,
        qte: Number(i.qte),
        unite: i.unite,
        pu_ht: Number(i.pu_ht),
        total_ht: Number(i.total_ht),
        tva: Number(i.tva),
        meta: i.meta ?? null,
      })),
      remise: facture.remise ?? null,
      total_ht: Number(facture.total_ht),
      total_tva: Number(facture.total_tva),
      total_ttc: Number(facture.total_ttc),
      echeance: aRegler ? facture.due_date : null,
      conditions_paiement: conditionsPaiement(atelier, client, aRegler),
      reference_commande: referenceCommande ?? null,
      nature_operation: facture.nature_operation,
    },
    vendeur: {
      nom: atelier.nom,
      siren: atelier.siren,
      siret: atelier.siret,
      tva_intra: atelier.assujetti_tva ? atelier.tva_intra : null,
      adresse: [atelier.adresse, atelier.adresse_complement].filter(Boolean).join("\n") || null,
      code_postal: atelier.code_postal,
      ville: atelier.ville,
      pays: atelier.pays,
    },
    acheteur: {
      nom: client.nom,
      siren: client.siren,
      siret: client.siret,
      // Le numéro de TVA du client n'a de sens que s'il est assujetti ; un particulier n'en a pas.
      tva_intra: client.tva_intra,
      adresse: client.adresse,
      code_postal: client.code_postal,
      ville: client.ville,
      pays: client.pays,
      professionnel: client.type === "pro",
    },
    // Mention obligatoire depuis le 01/09/2026 : l'adresse de livraison quand elle diffère de
    // l'adresse de facturation. La fiche client ne la renseigne que dans ce cas-là.
    livraison: client.adresse_livraison
      ? {
          nom: client.nom,
          adresse: client.adresse_livraison,
          code_postal: client.code_postal_livraison,
          ville: client.ville_livraison,
          pays: client.pays,
        }
      : null,
    assujetti_tva: atelier.assujetti_tva,
    tva_sur_debits: atelier.tva_sur_debits,
    iban: aRegler ? atelier.iban : null,
  };
}

/**
 * Rendu du PDF puis emballage Factur-X. Les deux étapes sont séparées à dessein : le document
 * imprimé reste exactement celui que l'atelier connaît, on ne fait qu'y adjoindre le XML.
 */
export async function facturXDepuisFacture(
  document: ReactElement<DocumentProps>,
  donnees: DonneesFacturX,
): Promise<{ pdf: Uint8Array; manques: string[] }> {
  const manques = manquesFacturX(donnees);
  if (manques.length > 0) return { pdf: new Uint8Array(), manques };

  const xml = xmlFacturX(donnees);
  const base = await renderToBuffer(document);
  const pdf = await emballerFacturX(base, {
    xml,
    titre: `Facture ${donnees.facture.numero}`,
    auteur: donnees.vendeur.nom,
    // Le profil annoncé dans le XMP doit être celui du XML : un validateur compare les deux.
    profil: NOM_PROFIL,
    date: new Date(donnees.facture.date),
  });
  return { pdf, manques: [] };
}
