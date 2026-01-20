// Génération PDF factures (similaire aux devis)
// Utilise les templates de devis comme base

import type { Database } from '@/types/database.types'
import { generatePdfHtml } from '@/lib/devis-templates'

type Facture = Database['public']['Tables']['factures']['Row'] & {
  clients?: Database['public']['Tables']['clients']['Row']
  projets?: Database['public']['Tables']['projets']['Row']
}
type Atelier = Database['public']['Tables']['ateliers']['Row']

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
 * Générer le HTML pour une facture PDF
 */
export function generateFacturePdfHtml(facture: Facture, atelier?: Atelier): string {
  const items = (facture.items as FactureItem[]) || []
  const totalTva = Number(facture.total_ttc) - Number(facture.total_ht)
  const acompte = facture.acompte_amount ? Number(facture.acompte_amount) : 0
  const solde = Number(facture.total_ttc) - acompte

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Facture ${facture.numero}</title>
  <style>
    @media print {
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      padding: 40px;
      max-width: 210mm;
      margin: 0 auto;
      color: #374151;
    }
    h1, h2, h3 { color: #2563eb; }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2563eb;
    }
    .atelier-info { flex: 1; }
    .facture-info { text-align: right; }
    .facture-title {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    .client-info {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: bold;
      color: #374151;
    }
    .total-row {
      font-weight: bold;
      background: #eff6ff;
    }
    .total-ttc {
      font-size: 20px;
      color: #2563eb;
    }
    .acompte-section {
      background: #fef3c7;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    ${facture.signature_url ? `
    .signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .signature img {
      max-width: 200px;
      max-height: 100px;
    }
    ` : ''}
  </style>
</head>
<body>
  <div class="header">
    <div class="atelier-info">
      <h1>${atelier?.name || 'Atelier'}</h1>
      ${atelier?.address ? `<p>${atelier.address}</p>` : ''}
      ${atelier?.phone ? `<p>Tel: ${atelier.phone}</p>` : ''}
      ${atelier?.email ? `<p>Email: ${atelier.email}</p>` : ''}
      ${atelier?.siret ? `<p>SIRET: ${atelier.siret}</p>` : ''}
    </div>
    <div class="facture-info">
      <div class="facture-title">FACTURE</div>
      <p><strong>Numéro:</strong> ${facture.numero}</p>
      <p><strong>Date:</strong> ${new Date(facture.created_at).toLocaleDateString('fr-FR')}</p>
      ${facture.due_date ? `<p><strong>Échéance:</strong> ${new Date(facture.due_date).toLocaleDateString('fr-FR')}</p>` : ''}
    </div>
  </div>

  <div class="client-info">
    <h2>Facturer à:</h2>
    <p><strong>${facture.clients?.full_name || ''}</strong></p>
    ${facture.clients?.address ? `<p>${facture.clients.address}</p>` : ''}
    ${facture.clients?.phone ? `<p>Tel: ${facture.clients.phone}</p>` : ''}
    ${facture.clients?.email ? `<p>Email: ${facture.clients.email}</p>` : ''}
    ${facture.clients?.type === 'professionnel' && facture.clients?.siret ? `<p>SIRET: ${facture.clients.siret}</p>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th>Qté</th>
        <th>Prix unitaire HT</th>
        <th>TVA</th>
        <th style="text-align: right;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => `
        <tr>
          <td>${item.designation || ''}</td>
          <td>${item.quantite || 1}</td>
          <td>${(item.prix_unitaire_ht || 0).toFixed(2)} €</td>
          <td>${item.tva_rate || facture.tva_rate}%</td>
          <td style="text-align: right;">${(item.total_ht || 0).toFixed(2)} €</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4" style="text-align: right;"><strong>Total HT</strong></td>
        <td style="text-align: right;">${Number(facture.total_ht).toFixed(2)} €</td>
      </tr>
      <tr class="total-row">
        <td colspan="4" style="text-align: right;"><strong>TVA (${facture.tva_rate}%)</strong></td>
        <td style="text-align: right;">${totalTva.toFixed(2)} €</td>
      </tr>
      ${acompte > 0 ? `
      <tr class="total-row">
        <td colspan="4" style="text-align: right;"><strong>Acompte</strong></td>
        <td style="text-align: right;">- ${acompte.toFixed(2)} €</td>
      </tr>
      ` : ''}
      <tr class="total-row total-ttc">
        <td colspan="4" style="text-align: right;"><strong>${acompte > 0 ? 'Solde à payer' : 'Total TTC'}</strong></td>
        <td style="text-align: right;">${(acompte > 0 ? solde : Number(facture.total_ttc)).toFixed(2)} €</td>
      </tr>
    </tfoot>
  </table>

  ${acompte > 0 ? `
  <div class="acompte-section">
    <p><strong>Note :</strong> Un acompte de ${acompte.toFixed(2)} € a déjà été réglé.</p>
    <p>Le solde de ${solde.toFixed(2)} € reste à payer.</p>
  </div>
  ` : ''}

  ${facture.notes ? `
  <div class="notes" style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px;">
    <p><strong>Notes :</strong></p>
    <p>${facture.notes.replace(/\n/g, '<br>')}</p>
  </div>
  ` : ''}

  ${facture.signature_url ? `
  <div class="signature">
    <p><strong>Signature électronique :</strong></p>
    <img src="${facture.signature_url}" alt="Signature" />
    ${facture.signed_at ? `<p>Signé le ${new Date(facture.signed_at).toLocaleDateString('fr-FR')} à ${new Date(facture.signed_at).toLocaleTimeString('fr-FR')}</p>` : ''}
  </div>
  ` : ''}

  <div class="footer">
    <p>Facture générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    <p>Merci de votre confiance.</p>
  </div>
</body>
</html>
  `
}
