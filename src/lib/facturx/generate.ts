/**
 * Génération Factur-X / ZUGFeRD
 * Norme EN16931 - Facturation électronique obligatoire France 2026-2027
 * 
 * Profil: MINIMUM (suffisant pour conformité réception sept. 2026)
 * Format: Factur-X 1.0 / ZUGFeRD 2.1
 */

interface FacturXData {
  // Facture
  numero: string
  dateEmission: string     // YYYYMMDD
  datePrestation: string   // YYYYMMDD
  dateEcheance?: string    // YYYYMMDD
  devise: string           // EUR
  type: 'facture' | 'avoir'
  
  // Émetteur (atelier)
  emetteur: {
    nom: string
    siret?: string
    tvaIntra?: string
    adresse?: string
    codePostal?: string
    ville?: string
    pays?: string           // FR
    email?: string
    telephone?: string
    rcs?: string
    iban?: string
    bic?: string
  }
  
  // Client
  client: {
    nom: string
    siret?: string
    tvaIntra?: string
    adresse?: string
    codePostal?: string
    ville?: string
    pays?: string
    email?: string
  }
  
  // Lignes
  lignes: {
    designation: string
    quantite: number
    prixUnitaireHT: number
    tauxTVA: number
    totalHT: number
  }[]
  
  // Totaux
  totalHT: number
  totalTVA: number
  totalTTC: number
  
  // Paiement
  modesPaiement?: string
  referenceCommande?: string
}

/**
 * Format date YYYYMMDD pour Factur-X
 */
function formatDateFX(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

/**
 * Générer le XML Factur-X conforme EN16931 profil MINIMUM
 */
export function generateFacturXML(data: FacturXData): string {
  const typeCode = data.type === 'avoir' ? '381' : '380' // 380 = facture, 381 = avoir
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <!-- Contexte Factur-X -->
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <!-- Document -->
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(data.numero)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${data.dateEmission}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <!-- Transaction -->
  <rsm:SupplyChainTradeTransaction>

    <!-- Parties -->
    <ram:ApplicableHeaderTradeAgreement>
      <!-- Vendeur (Atelier) -->
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(data.emetteur.nom)}</ram:Name>
        ${data.emetteur.siret ? `<ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(data.emetteur.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        ${data.emetteur.tvaIntra ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(data.emetteur.tvaIntra)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
        <ram:PostalTradeAddress>
          ${data.emetteur.adresse ? `<ram:LineOne>${escapeXml(data.emetteur.adresse)}</ram:LineOne>` : ''}
          ${data.emetteur.codePostal ? `<ram:PostcodeCode>${escapeXml(data.emetteur.codePostal)}</ram:PostcodeCode>` : ''}
          ${data.emetteur.ville ? `<ram:CityName>${escapeXml(data.emetteur.ville)}</ram:CityName>` : ''}
          <ram:CountryID>${data.emetteur.pays || 'FR'}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${data.emetteur.email ? `<ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${escapeXml(data.emetteur.email)}</ram:URIID>
        </ram:URIUniversalCommunication>` : ''}
      </ram:SellerTradeParty>

      <!-- Acheteur (Client) -->
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(data.client.nom)}</ram:Name>
        ${data.client.siret ? `<ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(data.client.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        ${data.client.tvaIntra ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(data.client.tvaIntra)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
        <ram:PostalTradeAddress>
          ${data.client.adresse ? `<ram:LineOne>${escapeXml(data.client.adresse)}</ram:LineOne>` : ''}
          ${data.client.codePostal ? `<ram:PostcodeCode>${escapeXml(data.client.codePostal)}</ram:PostcodeCode>` : ''}
          ${data.client.ville ? `<ram:CityName>${escapeXml(data.client.ville)}</ram:CityName>` : ''}
          <ram:CountryID>${data.client.pays || 'FR'}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>

      ${data.referenceCommande ? `<ram:BuyerOrderReferencedDocument>
        <ram:IssuerAssignedID>${escapeXml(data.referenceCommande)}</ram:IssuerAssignedID>
      </ram:BuyerOrderReferencedDocument>` : ''}
    </ram:ApplicableHeaderTradeAgreement>

    <!-- Livraison -->
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${data.datePrestation}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <!-- Règlement -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${data.devise}</ram:InvoiceCurrencyCode>
      
      ${data.emetteur.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(data.emetteur.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        ${data.emetteur.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(data.emetteur.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}

      ${data.dateEcheance ? `<ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${data.dateEcheance}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ''}

      <!-- TVA -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${data.totalTVA.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${data.totalHT.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${data.lignes[0]?.tauxTVA || 20}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>

      <!-- Totaux -->
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${data.totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${data.totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${data.devise}">${data.totalTVA.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${data.totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${data.totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

    <!-- Lignes de facture -->
    ${data.lignes.map((ligne, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(ligne.designation)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${ligne.prixUnitaireHT.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${ligne.quantite}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${ligne.tauxTVA}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${ligne.totalHT.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('\n')}

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`

  return xml
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Construire les données Factur-X depuis une facture et un atelier
 */
export function buildFacturXData(facture: any, atelier: any, client: any): FacturXData {
  const items = (facture.items as any[]) || []
  const dateEmission = formatDateFX(facture.created_at)
  const datePrestation = formatDateFX(facture.projets?.date_livre || facture.projets?.date_depot || facture.created_at)
  
  // Parser l'adresse pour extraire code postal et ville
  const parseAdresse = (addr: string | null) => {
    if (!addr) return { adresse: '', codePostal: '', ville: '' }
    const parts = addr.split(',').map((s: string) => s.trim())
    const lastPart = parts[parts.length - 1] || ''
    const cpMatch = lastPart.match(/(\d{5})\s+(.+)/)
    return {
      adresse: parts.slice(0, -1).join(', ') || addr,
      codePostal: cpMatch?.[1] || '',
      ville: cpMatch?.[2] || lastPart,
    }
  }

  const emetteurAddr = parseAdresse(atelier?.address)
  const clientAddr = parseAdresse(client?.address)

  return {
    numero: facture.numero,
    dateEmission,
    datePrestation,
    dateEcheance: facture.due_date ? formatDateFX(facture.due_date) : undefined,
    devise: 'EUR',
    type: facture.type === 'avoir' ? 'avoir' : 'facture',
    emetteur: {
      nom: atelier?.name || 'Atelier',
      siret: atelier?.siret?.replace(/\s/g, ''),
      tvaIntra: atelier?.tva_intra,
      adresse: emetteurAddr.adresse,
      codePostal: emetteurAddr.codePostal,
      ville: emetteurAddr.ville,
      pays: 'FR',
      email: atelier?.email,
      telephone: atelier?.phone,
      rcs: atelier?.rcs,
      iban: atelier?.iban,
      bic: atelier?.bic,
    },
    client: {
      nom: client?.full_name || '',
      siret: client?.siret?.replace(/\s/g, ''),
      tvaIntra: client?.tva_intra,
      adresse: clientAddr.adresse,
      codePostal: clientAddr.codePostal,
      ville: clientAddr.ville,
      pays: 'FR',
      email: client?.email,
    },
    lignes: items.length > 0 
      ? items.map(item => ({
          designation: item.designation || 'Prestation',
          quantite: item.quantite || 1,
          prixUnitaireHT: item.prix_unitaire_ht || 0,
          tauxTVA: item.tva_rate || facture.tva_rate || 20,
          totalHT: item.total_ht || 0,
        }))
      : [{
          designation: 'Prestation de thermolaquage',
          quantite: 1,
          prixUnitaireHT: Number(facture.total_ht),
          tauxTVA: facture.tva_rate || 20,
          totalHT: Number(facture.total_ht),
        }],
    totalHT: Number(facture.total_ht),
    totalTVA: Number(facture.total_ttc) - Number(facture.total_ht),
    totalTTC: Number(facture.total_ttc),
    referenceCommande: facture.projets?.numero,
  }
}

/**
 * Calculer le hash SHA-256 d'un contenu pour archivage légal
 */
export async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
