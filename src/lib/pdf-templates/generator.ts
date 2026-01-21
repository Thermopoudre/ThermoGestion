// Générateur principal de PDF
// Sélectionne et génère le bon template

import type { TemplateData, TemplateName } from './index'
import { generateClassicTemplate } from './classic'
import { generateModernTemplate } from './modern'
import { generateIndustrialTemplate } from './industrial'
import { generatePremiumTemplate } from './premium'

export function generatePDF(templateName: TemplateName, data: TemplateData): string {
  switch (templateName) {
    case 'classic':
      return generateClassicTemplate(data)
    case 'modern':
      return generateModernTemplate(data)
    case 'industrial':
      return generateIndustrialTemplate(data)
    case 'premium':
      return generatePremiumTemplate(data)
    default:
      return generateClassicTemplate(data)
  }
}

// Préparer les données du devis pour le template
export function prepareDevisData(
  devis: any,
  atelier: any,
  client: any
): TemplateData {
  const items = (devis.items || []).map((item: any) => ({
    designation: item.designation || 'Article',
    description: item.description,
    quantite: item.quantite || 1,
    surface_m2: item.surface_m2,
    couches: item.couches,
    prixUnitaire: item.prix_unitaire,
    total_ht: item.total_ht || 0,
  }))

  const totalHt = Number(devis.total_ht) || 0
  const totalTtc = Number(devis.total_ttc) || 0
  const tvaRate = Number(devis.tva_rate) || 20
  const totalTva = totalTtc - totalHt

  // Parser la remise si elle existe
  let remise: { type: 'pourcentage' | 'montant'; valeur: number } | undefined
  if (devis.remise) {
    if (typeof devis.remise === 'object') {
      remise = {
        type: devis.remise.type || 'montant',
        valeur: devis.remise.valeur || 0,
      }
    }
  }

  return {
    type: 'devis',
    numero: devis.numero || 'N/A',
    date: devis.created_at || new Date().toISOString(),
    validite: devis.valid_until,
    totalHt,
    totalTtc,
    tvaRate,
    totalTva,
    remise,
    totalRevient: devis.total_revient ? Number(devis.total_revient) : undefined,
    margePct: devis.marge_pct ? Number(devis.marge_pct) : undefined,
    items,
    client: {
      nom: client?.full_name || 'Client',
      email: client?.email,
      telephone: client?.phone,
      adresse: client?.address,
      siret: client?.siret,
      type: client?.type,
    },
    atelier: {
      nom: atelier?.name || 'Atelier',
      adresse: atelier?.address,
      telephone: atelier?.phone,
      email: atelier?.email,
      siret: atelier?.siret,
      tvaIntra: atelier?.tva_intra,
      rcs: atelier?.rcs,
      logo: atelier?.logo_url,
      iban: atelier?.iban,
      bic: atelier?.bic,
    },
    signed: devis.signed_at
      ? {
          date: devis.signed_at,
          signatureData: devis.signature_data,
        }
      : undefined,
    notes: devis.notes,
    cgv: atelier?.settings?.cgv_devis,
  }
}

// Préparer les données de facture pour le template
export function prepareFactureData(
  facture: any,
  atelier: any,
  client: any
): TemplateData {
  const items = (facture.items || []).map((item: any) => ({
    designation: item.designation || 'Article',
    description: item.description,
    quantite: item.quantite || 1,
    surface_m2: item.surface_m2,
    couches: item.couches,
    prixUnitaire: item.prix_unitaire,
    total_ht: item.total_ht || 0,
  }))

  const totalHt = Number(facture.total_ht) || 0
  const totalTtc = Number(facture.total_ttc) || 0
  const tvaRate = Number(facture.tva_rate) || 20
  const totalTva = totalTtc - totalHt

  return {
    type: 'facture',
    numero: facture.numero || 'N/A',
    date: facture.created_at || new Date().toISOString(),
    totalHt,
    totalTtc,
    tvaRate,
    totalTva,
    items,
    client: {
      nom: client?.full_name || 'Client',
      email: client?.email,
      telephone: client?.phone,
      adresse: client?.address,
      siret: client?.siret,
      type: client?.type,
    },
    atelier: {
      nom: atelier?.name || 'Atelier',
      adresse: atelier?.address,
      telephone: atelier?.phone,
      email: atelier?.email,
      siret: atelier?.siret,
      tvaIntra: atelier?.tva_intra,
      rcs: atelier?.rcs,
      logo: atelier?.logo_url,
      iban: atelier?.iban,
      bic: atelier?.bic,
    },
    notes: facture.notes,
    cgv: atelier?.settings?.cgv_facture,
  }
}
