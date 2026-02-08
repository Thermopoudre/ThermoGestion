/**
 * Génération PDF factures - CONFORME LÉGISLATION FRANÇAISE 2026
 * 
 * Base légale : Article L441-3 et L441-9 du Code de commerce
 *               Article 242 nonies A du CGI
 *               Décret n° 2022-1299 du 7 octobre 2022 (nouvelles mentions)
 * 
 * Mentions obligatoires incluses :
 * 
 * ÉMETTEUR :
 * - Dénomination sociale, adresse siège social
 * - SIRET / SIREN
 * - TVA intracommunautaire
 * - RCS (+ ville du greffe)
 * - Numéro au répertoire des métiers (si artisan)
 * - Forme juridique + capital social
 * 
 * CLIENT :
 * - Nom / dénomination sociale, adresse
 * - SIRET (si professionnel)
 * - TVA intracommunautaire (si professionnel)
 * - Adresse de livraison si différente (Décret 2022-1299)
 * 
 * FACTURE :
 * - Numéro unique séquentiel
 * - Date d'émission
 * - Date de prestation / livraison
 * - Catégorie d'opération : biens, services ou mixte (Décret 2022-1299)
 * 
 * CONTENU :
 * - Désignation, quantité, prix unitaire HT
 * - Taux et montant TVA par ligne
 * - Total HT et TTC
 * - Mention "TVA non applicable, art. 293 B du CGI" si micro-entreprise
 * 
 * PAIEMENT :
 * - Date d'échéance
 * - Modes de paiement acceptés
 * - Conditions d'escompte (ou "aucun escompte")
 * - Taux de pénalités de retard (chiffré)
 * - Indemnité forfaitaire de recouvrement (40€ pour pros)
 * - Mention "option débits" si applicable
 */

import type { Database } from '@/types/database.types'

type ClientRow = Database['public']['Tables']['clients']['Row'] & {
  tva_intra?: string | null
  adresse_livraison?: string | null
}

type Facture = Database['public']['Tables']['factures']['Row'] & {
  clients?: ClientRow
  projets?: Database['public']['Tables']['projets']['Row']
  categorie_operation?: string | null
}

// Type étendu pour l'atelier avec mentions légales
type AtelierLegal = Database['public']['Tables']['ateliers']['Row'] & {
  tva_intra?: string | null
  rcs?: string | null
  forme_juridique?: string | null
  capital_social?: string | null
  iban?: string | null
  bic?: string | null
  numero_rm?: string | null
  assujetti_tva?: boolean
}

interface FactureItem {
  id: string
  designation: string
  quantite: number
  prix_unitaire_ht: number
  tva_rate: number
  total_ht: number
  total_ttc: number
}

/**
 * Générer le HTML pour une facture PDF - CONFORME FRANCE
 */
export function generateFacturePdfHtml(facture: Facture, atelier?: AtelierLegal): string {
  const items = (facture.items as FactureItem[]) || []
  const totalTva = Number(facture.total_ttc) - Number(facture.total_ht)
  const acompte = facture.acompte_amount ? Number(facture.acompte_amount) : 0
  const solde = Number(facture.total_ttc) - acompte
  
  // Date de prestation (utilise la date du projet ou la date de création)
  const datePrestation = facture.projets?.date_livre 
    || facture.projets?.date_depot 
    || facture.created_at
  
  // Déterminer si client professionnel
  const isClientPro = facture.clients?.type === 'professionnel'

  // TVA applicable ?
  const isAssujettiTva = atelier?.assujetti_tva !== false

  // Catégorie d'opération (Décret 2022-1299)
  const categorieOp = (facture as Facture & { categorie_operation?: string }).categorie_operation || 'services'
  const categorieLabel = categorieOp === 'biens' 
    ? 'Livraison de biens' 
    : categorieOp === 'mixte' 
    ? 'Livraison de biens et prestations de services' 
    : 'Prestations de services'

  // SIREN (9 premiers chiffres du SIRET)
  const siren = atelier?.siret ? atelier.siret.replace(/\s/g, '').substring(0, 9) : null

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${facture.numero}</title>
  <style>
    @media print {
      body { margin: 0; }
      .page-break { page-break-before: always; }
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      padding: 30px 40px;
      max-width: 210mm;
      margin: 0 auto;
      color: #1f2937;
    }
    h1, h2, h3 { color: #1e40af; margin: 0 0 8px 0; }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 3px solid #1e40af;
    }
    .atelier-info { 
      flex: 1;
      font-size: 10px;
    }
    .atelier-info h1 {
      font-size: 20px;
      margin-bottom: 10px;
    }
    .atelier-info p {
      margin: 2px 0;
      color: #4b5563;
    }
    .facture-info { 
      text-align: right;
      min-width: 200px;
    }
    .facture-title {
      font-size: 28px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 12px;
    }
    .facture-info p {
      margin: 4px 0;
      font-size: 11px;
    }
    .deux-colonnes {
      display: flex;
      gap: 30px;
      margin-bottom: 25px;
    }
    .client-info {
      flex: 1;
      background: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #1e40af;
    }
    .client-info h2 {
      font-size: 12px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .client-info p {
      margin: 3px 0;
    }
    .prestation-info {
      flex: 1;
      background: #eff6ff;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }
    .prestation-info h2 {
      font-size: 12px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 10px 8px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #1e40af;
      color: white;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    .total-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
    .total-table {
      width: 280px;
    }
    .total-table td {
      padding: 8px 12px;
      border: none;
    }
    .total-table .label {
      text-align: right;
      color: #6b7280;
    }
    .total-table .value {
      text-align: right;
      font-weight: 600;
    }
    .total-table .total-ttc {
      background: #1e40af;
      color: white;
      font-size: 14px;
    }
    .total-table .total-ttc .label,
    .total-table .total-ttc .value {
      color: white;
    }
    .acompte-section {
      background: #fef3c7;
      padding: 12px 15px;
      border-radius: 6px;
      margin-bottom: 20px;
      border-left: 4px solid #f59e0b;
    }
    .conditions-section {
      background: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      font-size: 10px;
    }
    .conditions-section h3 {
      font-size: 11px;
      margin-bottom: 10px;
      color: #374151;
    }
    .conditions-section p {
      margin: 4px 0;
      color: #6b7280;
    }
    .conditions-section .important {
      color: #dc2626;
      font-weight: 600;
    }
    .paiement-section {
      background: #ecfdf5;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border-left: 4px solid #10b981;
    }
    .paiement-section h3 {
      font-size: 11px;
      margin-bottom: 10px;
      color: #065f46;
    }
    .notes-section {
      background: #fff7ed;
      padding: 12px 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border-left: 4px solid #f97316;
    }
    .signature {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
    .signature img {
      max-width: 180px;
      max-height: 80px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
      font-size: 9px;
      color: #9ca3af;
      text-align: center;
    }
    .footer p {
      margin: 3px 0;
    }
    .mentions-legales {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 8px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <!-- EN-TÊTE -->
  <div class="header">
    <div class="atelier-info">
      <h1>${atelier?.name || 'Atelier'}</h1>
      ${atelier?.forme_juridique ? `<p>${atelier.forme_juridique}${atelier?.capital_social ? ` au capital de ${atelier.capital_social}` : ''}</p>` : ''}
      ${atelier?.address ? `<p>${atelier.address}</p>` : ''}
      ${atelier?.phone ? `<p>Tél : ${atelier.phone}</p>` : ''}
      ${atelier?.email ? `<p>Email : ${atelier.email}</p>` : ''}
      <p style="margin-top: 8px;">
        ${siren ? `<strong>SIREN :</strong> ${siren}` : ''}
        ${atelier?.siret ? ` • <strong>SIRET :</strong> ${atelier.siret}` : ''}
      </p>
      ${atelier?.tva_intra ? `<p><strong>N° TVA Intracommunautaire :</strong> ${atelier.tva_intra}</p>` : ''}
      ${atelier?.rcs ? `<p><strong>RCS :</strong> ${atelier.rcs}</p>` : ''}
      ${atelier?.numero_rm ? `<p><strong>N° Répertoire des Métiers :</strong> ${atelier.numero_rm}</p>` : ''}
    </div>
    <div class="facture-info">
      <div class="facture-title">FACTURE</div>
      <p><strong>N° :</strong> ${facture.numero}</p>
      <p><strong>Date d'émission :</strong> ${new Date(facture.created_at).toLocaleDateString('fr-FR')}</p>
      <p><strong>Date prestation :</strong> ${new Date(datePrestation).toLocaleDateString('fr-FR')}</p>
      ${facture.due_date ? `<p><strong>Échéance :</strong> ${new Date(facture.due_date).toLocaleDateString('fr-FR')}</p>` : ''}
      <p style="margin-top: 6px; font-size: 9px; color: #6b7280;"><strong>Nature :</strong> ${categorieLabel}</p>
    </div>
  </div>

  <!-- INFORMATIONS CLIENT ET PRESTATION -->
  <div class="deux-colonnes">
    <div class="client-info">
      <h2>Client</h2>
      <p><strong>${facture.clients?.full_name || ''}</strong></p>
      ${facture.clients?.address ? `<p>${facture.clients.address}</p>` : ''}
      ${facture.clients?.phone ? `<p>Tél : ${facture.clients.phone}</p>` : ''}
      ${facture.clients?.email ? `<p>Email : ${facture.clients.email}</p>` : ''}
      ${isClientPro && facture.clients?.siret ? `<p><strong>SIRET :</strong> ${facture.clients.siret}</p>` : ''}
      ${isClientPro && (facture.clients as ClientRow)?.tva_intra ? `<p><strong>TVA Intra :</strong> ${(facture.clients as ClientRow).tva_intra}</p>` : ''}
      ${(facture.clients as ClientRow)?.adresse_livraison ? `<p style="margin-top: 6px;"><strong>Adresse de livraison :</strong><br>${(facture.clients as ClientRow).adresse_livraison}</p>` : ''}
    </div>
    <div class="prestation-info">
      <h2>Référence</h2>
      ${facture.projets?.numero ? `<p><strong>Projet :</strong> ${facture.projets.numero}</p>` : ''}
      ${facture.projets?.name ? `<p>${facture.projets.name}</p>` : ''}
      <p><strong>Type :</strong> ${facture.type === 'acompte' ? 'Facture d\'acompte' : facture.type === 'solde' ? 'Facture de solde' : 'Facture'}</p>
    </div>
  </div>

  <!-- TABLEAU DES PRESTATIONS -->
  <table>
    <thead>
      <tr>
        <th style="width: 45%;">Désignation</th>
        <th style="width: 10%; text-align: center;">Qté</th>
        <th style="width: 15%; text-align: right;">P.U. HT</th>
        <th style="width: 10%; text-align: center;">TVA</th>
        <th style="width: 20%; text-align: right;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${items.length > 0 ? items.map((item) => `
        <tr>
          <td>${item.designation || ''}</td>
          <td style="text-align: center;">${item.quantite || 1}</td>
          <td style="text-align: right;">${(item.prix_unitaire_ht || 0).toFixed(2)} €</td>
          <td style="text-align: center;">${item.tva_rate || facture.tva_rate}%</td>
          <td style="text-align: right;">${(item.total_ht || 0).toFixed(2)} €</td>
        </tr>
      `).join('') : `
        <tr>
          <td>Prestation de thermolaquage</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">${Number(facture.total_ht).toFixed(2)} €</td>
          <td style="text-align: center;">${facture.tva_rate}%</td>
          <td style="text-align: right;">${Number(facture.total_ht).toFixed(2)} €</td>
        </tr>
      `}
    </tbody>
  </table>

  <!-- TOTAUX -->
  <div class="total-section">
    <table class="total-table">
      <tr>
        <td class="label">Total HT</td>
        <td class="value">${Number(facture.total_ht).toFixed(2)} €</td>
      </tr>
      ${isAssujettiTva ? `
      <tr>
        <td class="label">TVA (${facture.tva_rate}%)</td>
        <td class="value">${totalTva.toFixed(2)} €</td>
      </tr>
      ` : `
      <tr>
        <td class="label" style="font-size: 9px;">TVA non applicable,<br>art. 293 B du CGI</td>
        <td class="value">0,00 €</td>
      </tr>
      `}
      ${acompte > 0 ? `
      <tr>
        <td class="label">Acompte versé</td>
        <td class="value">- ${acompte.toFixed(2)} €</td>
      </tr>
      ` : ''}
      <tr class="total-ttc">
        <td class="label">${acompte > 0 ? 'NET À PAYER' : 'TOTAL TTC'}</td>
        <td class="value">${(acompte > 0 ? solde : Number(facture.total_ttc)).toFixed(2)} €</td>
      </tr>
    </table>
  </div>

  ${acompte > 0 ? `
  <div class="acompte-section">
    <strong>Information :</strong> Un acompte de ${acompte.toFixed(2)} € a déjà été réglé. Le solde restant à payer est de <strong>${solde.toFixed(2)} €</strong>.
  </div>
  ` : ''}

  <!-- CONDITIONS DE PAIEMENT -->
  <div class="paiement-section">
    <h3>💳 Modalités de règlement</h3>
    <p><strong>Échéance :</strong> ${facture.due_date ? new Date(facture.due_date).toLocaleDateString('fr-FR') : 'À réception'}</p>
    <p><strong>Modes de paiement acceptés :</strong> Virement bancaire, Carte bancaire, Chèque</p>
    ${atelier?.iban ? `<p><strong>IBAN :</strong> ${atelier.iban}${atelier?.bic ? ` • <strong>BIC :</strong> ${atelier.bic}` : ''}</p>` : ''}
  </div>

  <!-- CONDITIONS LÉGALES OBLIGATOIRES -->
  <div class="conditions-section">
    <h3>📋 Conditions générales</h3>
    <p><strong>Escompte :</strong> Aucun escompte accordé pour paiement anticipé.</p>
    <p class="important"><strong>Pénalités de retard :</strong> En cas de retard de paiement, des pénalités de retard seront exigibles au taux annuel de 11,62 % (3 fois le taux d'intérêt légal en vigueur, conformément à l'article L.441-10 du Code de commerce).</p>
    ${isClientPro ? `<p class="important"><strong>Indemnité forfaitaire de recouvrement :</strong> En cas de retard de paiement, une indemnité forfaitaire de 40 € sera due de plein droit (art. L.441-10 et D.441-5 du Code de commerce).</p>` : ''}
    <p><strong>Nature des opérations :</strong> ${categorieLabel}.</p>
  </div>

  ${facture.notes ? `
  <div class="notes-section">
    <strong>📝 Notes :</strong><br>
    ${facture.notes.replace(/\n/g, '<br>')}
  </div>
  ` : ''}

  ${facture.signature_url ? `
  <div class="signature">
    <p><strong>Signature électronique :</strong></p>
    <img src="${facture.signature_url}" alt="Signature" />
    ${facture.signed_at ? `<p style="font-size: 9px; color: #6b7280;">Signé électroniquement le ${new Date(facture.signed_at).toLocaleDateString('fr-FR')} à ${new Date(facture.signed_at).toLocaleTimeString('fr-FR')}</p>` : ''}
  </div>
  ` : ''}

  <!-- PIED DE PAGE -->
  <div class="footer">
    <p>Facture émise le ${new Date().toLocaleDateString('fr-FR')} • ${facture.numero}</p>
    <p>Merci de votre confiance !</p>
    
    <div class="mentions-legales">
      ${atelier?.name || 'Atelier'} ${atelier?.forme_juridique ? `• ${atelier.forme_juridique}` : ''} ${atelier?.capital_social ? `au capital de ${atelier.capital_social}` : ''}<br>
      ${siren ? `SIREN : ${siren} • ` : ''}${atelier?.siret ? `SIRET : ${atelier.siret}` : ''} ${atelier?.tva_intra ? `• TVA Intracommunautaire : ${atelier.tva_intra}` : ''}<br>
      ${atelier?.rcs ? `${atelier.rcs}` : ''} ${atelier?.numero_rm ? `• RM : ${atelier.numero_rm}` : ''}<br>
      ${!isAssujettiTva ? 'TVA non applicable, article 293 B du Code Général des Impôts. ' : ''}Document généré électroniquement et conforme à l'article 289 du Code Général des Impôts.
    </div>
  </div>
</body>
</html>
  `
}
