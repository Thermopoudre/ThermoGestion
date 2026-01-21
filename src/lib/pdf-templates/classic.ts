// Template Classic - Design professionnel et épuré
import type { TemplateData } from './index'
import type { CustomColors } from './generator'

const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const getCouchesDisplay = (couches: number | Array<{ type: string }> | undefined): string => {
  if (!couches) return '1'
  if (Array.isArray(couches)) return couches.length.toString()
  return couches.toString()
}

// Couleurs par défaut du template
const DEFAULT_COLORS = {
  primary: '#1e3a5f',
  accent: '#3b82f6',
}

export function generateClassicTemplate(data: TemplateData, customColors?: CustomColors): string {
  const isDevis = data.type === 'devis'
  const title = isDevis ? 'DEVIS' : 'FACTURE'
  
  // Utiliser les couleurs personnalisées ou les couleurs par défaut
  const colors = {
    primary: customColors?.primary || DEFAULT_COLORS.primary,
    accent: customColors?.accent || DEFAULT_COLORS.accent,
  }
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title} ${data.numero}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { height: 297mm; width: 210mm; }
    }
    
    html, body {
      width: 210mm;
      min-height: 297mm;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1f2937;
      background: white;
      padding: 15mm;
      margin: 0 auto;
      box-sizing: border-box;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${colors.primary};
    }
    
    .logo-section {
      flex: 1;
    }
    
    .company-name {
      font-size: 20pt;
      font-weight: 700;
      color: ${colors.primary};
      margin-bottom: 8px;
    }
    
    .company-details {
      color: #6b7280;
      font-size: 10px;
      line-height: 1.6;
    }
    
    .document-info {
      text-align: right;
    }
    
    .document-type {
      font-size: 24pt;
      font-weight: 700;
      color: ${colors.primary};
      letter-spacing: 2px;
      margin-bottom: 10px;
    }
    
    .document-number {
      font-size: 12pt;
      color: ${colors.accent};
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .document-date {
      color: #6b7280;
      font-size: 11px;
    }
    
    .parties-section {
      display: flex;
      gap: 40px;
      margin-bottom: 35px;
    }
    
    .party-box {
      flex: 1;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 8px;
      padding: 15px;
      border-left: 4px solid ${colors.primary};
    }
    
    .party-label {
      font-size: 8pt;
      font-weight: 600;
      color: ${colors.primary};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    
    .party-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 6px;
    }
    
    .party-details {
      color: #6b7280;
      font-size: 10px;
      line-height: 1.6;
    }
    
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 25px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .items-table th {
      background: ${colors.primary};
      color: white;
      padding: 12px 10px;
      text-align: left;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .items-table th:last-child {
      text-align: right;
    }
    
    .items-table td {
      padding: 14px 12px;
      border-bottom: 1px solid #e5e7eb;
      background: white;
    }
    
    .items-table tr:last-child td {
      border-bottom: none;
    }
    
    .items-table tr:nth-child(even) td {
      background: #f9fafb;
    }
    
    .items-table td:last-child {
      text-align: right;
      font-weight: 600;
      color: ${colors.primary};
    }
    
    .item-designation {
      font-weight: 500;
      color: #1f2937;
    }
    
    .item-dimensions {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
    
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    
    .totals-box {
      width: 280px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 10px;
      padding: 20px;
      border: 1px solid #e5e7eb;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 11px;
    }
    
    .total-row.subtotal {
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 8px;
      padding-bottom: 12px;
    }
    
    .total-row.grand-total {
      font-size: 14pt;
      font-weight: 700;
      color: ${colors.primary};
      padding-top: 12px;
      border-top: 2px solid ${colors.primary};
      margin-top: 8px;
    }
    
    .total-label {
      color: #6b7280;
    }
    
    .total-value {
      font-weight: 600;
      color: #1f2937;
    }
    
    .notes-section {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 25px;
    }
    
    .notes-title {
      font-weight: 600;
      color: #92400e;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .notes-content {
      color: #78350f;
      font-size: 10px;
    }
    
    .signature-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding: 20px;
      background: #f0fdf4;
      border-radius: 10px;
      border: 1px solid #86efac;
    }
    
    .signature-status {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #166534;
      font-weight: 600;
    }
    
    .signature-check {
      width: 24px;
      height: 24px;
      background: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }
    
    .unsigned-box {
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      color: #9ca3af;
    }
    
    .unsigned-text {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .footer {
      margin-top: auto;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    
    .cgv {
      font-size: 9px;
      color: #9ca3af;
      text-align: center;
      line-height: 1.6;
    }
    
    .legal-info {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-top: 15px;
      font-size: 9px;
      color: #6b7280;
    }
    
    .legal-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      <div class="company-name">${data.atelier.nom}</div>
      <div class="company-details">
        ${data.atelier.adresse ? `${data.atelier.adresse}<br>` : ''}
        ${data.atelier.telephone ? `Tél: ${data.atelier.telephone}<br>` : ''}
        ${data.atelier.email ? `${data.atelier.email}<br>` : ''}
        ${data.atelier.siret ? `SIRET: ${data.atelier.siret}` : ''}
      </div>
    </div>
    <div class="document-info">
      <div class="document-type">${title}</div>
      <div class="document-number">N° ${data.numero}</div>
      <div class="document-date">${formatDate(data.date)}</div>
      ${data.validite ? `<div class="document-date">Valide jusqu'au ${formatDate(data.validite)}</div>` : ''}
    </div>
  </div>

  <div class="parties-section">
    <div class="party-box">
      <div class="party-label">Client</div>
      <div class="party-name">${data.client.nom}</div>
      <div class="party-details">
        ${data.client.adresse ? `${data.client.adresse}<br>` : ''}
        ${data.client.telephone ? `Tél: ${data.client.telephone}<br>` : ''}
        ${data.client.email ? `${data.client.email}<br>` : ''}
        ${data.client.type === 'professionnel' && data.client.siret ? `SIRET: ${data.client.siret}` : ''}
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40%">Désignation</th>
        <th style="width: 15%">Qté</th>
        <th style="width: 15%">Surface</th>
        <th style="width: 10%">Couches</th>
        <th style="width: 20%">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(item => `
        <tr>
          <td>
            <div class="item-designation">${item.designation}</div>
            ${item.description ? `<div class="item-dimensions">${item.description}</div>` : ''}
          </td>
          <td>${item.quantite}</td>
          <td>${item.surface_m2 ? `${item.surface_m2.toFixed(2)} m²` : '-'}</td>
          <td>${getCouchesDisplay(item.couches)}</td>
          <td>${formatMoney(item.total_ht)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <div class="total-row subtotal">
        <span class="total-label">Sous-total HT</span>
        <span class="total-value">${formatMoney(data.totalHt)}</span>
      </div>
      ${data.remise && data.remise.valeur > 0 ? `
        <div class="total-row">
          <span class="total-label">Remise ${data.remise.type === 'pourcentage' ? `(${data.remise.valeur}%)` : ''}</span>
          <span class="total-value" style="color: #dc2626">-${formatMoney(data.remise.type === 'pourcentage' ? data.totalHt * data.remise.valeur / 100 : data.remise.valeur)}</span>
        </div>
      ` : ''}
      <div class="total-row">
        <span class="total-label">TVA (${data.tvaRate}%)</span>
        <span class="total-value">${formatMoney(data.totalTva)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total TTC</span>
        <span>${formatMoney(data.totalTtc)}</span>
      </div>
    </div>
  </div>

  ${data.notes ? `
    <div class="notes-section">
      <div class="notes-title">Notes</div>
      <div class="notes-content">${data.notes}</div>
    </div>
  ` : ''}

  ${isDevis ? `
    <div class="${data.signed ? 'signature-section' : ''}">
      ${data.signed ? `
        <div class="signature-status">
          <div class="signature-check">✓</div>
          <div>
            <strong>Devis accepté</strong><br>
            <span style="font-size: 10px; font-weight: normal">Signé le ${formatDate(data.signed.date)}</span>
          </div>
        </div>
      ` : `
        <div class="unsigned-box" style="flex: 1">
          <div class="unsigned-text">Bon pour accord - Signature client</div>
          <div style="height: 60px"></div>
          <div style="font-size: 9px; color: #9ca3af; margin-top: 10px">Date : ____/____/________</div>
        </div>
      `}
    </div>
  ` : ''}

  <div class="footer">
    <div class="cgv">${data.cgv || 'Devis valable 30 jours. Paiement à réception de facture. En cas de retard de paiement, une pénalité de 3 fois le taux d\'intérêt légal sera appliquée.'}</div>
    <div class="legal-info">
      ${data.atelier.siret ? `<span class="legal-item">SIRET: ${data.atelier.siret}</span>` : ''}
      ${data.atelier.tvaIntra ? `<span class="legal-item">TVA: ${data.atelier.tvaIntra}</span>` : ''}
      ${data.atelier.rcs ? `<span class="legal-item">RCS: ${data.atelier.rcs}</span>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim()
}
