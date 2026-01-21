// Template Industrial - Conçu pour ateliers de thermolaquage
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
  primary: '#dc2626',
  accent: '#f97316',
}

export function generateIndustrialTemplate(data: TemplateData, customColors?: CustomColors): string {
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
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Roboto+Condensed:wght@700&display=swap');
    
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
      font-family: 'Roboto', sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1f2937;
      background: white;
      margin: 0;
    }
    
    .page {
      position: relative;
      min-height: 297mm;
      width: 210mm;
      box-sizing: border-box;
    }
    
    /* Bande diagonale décorative */
    .deco-stripe {
      position: absolute;
      top: 0;
      right: 0;
      width: 150px;
      height: 150px;
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%);
      clip-path: polygon(100% 0, 0 0, 100% 100%);
      opacity: 0.1;
    }
    
    .content {
      padding: 15mm;
      position: relative;
    }
    
    /* Header avec style industriel */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 4px solid ${colors.primary};
    }
    
    .company {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    
    .company-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;
      box-shadow: 0 4px 15px ${colors.primary}40;
    }
    
    .company-info h1 {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 26px;
      font-weight: 700;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    
    .company-subtitle {
      color: ${colors.primary};
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    
    .company-contact {
      font-size: 10px;
      color: #6b7280;
      line-height: 1.6;
    }
    
    .doc-header {
      text-align: right;
    }
    
    .doc-type-badge {
      display: inline-block;
      background: #1f2937;
      color: white;
      padding: 8px 20px;
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 24px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 12px;
    }
    
    .doc-number {
      font-size: 14pt;
      font-weight: 700;
      color: ${colors.primary};
      margin-bottom: 5px;
    }
    
    .doc-date {
      color: #6b7280;
      font-size: 11px;
    }
    
    /* Informations client style industriel */
    .client-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-left: 5px solid ${colors.primary};
      padding: 15px 20px;
      margin-bottom: 25px;
    }
    
    .client-label {
      font-size: 8pt;
      font-weight: 700;
      color: ${colors.primary};
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    
    .client-name {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .client-details {
      color: #6b7280;
      font-size: 11px;
      line-height: 1.7;
    }
    
    /* Tableau industriel */
    .table-container {
      margin-bottom: 25px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .items-table th {
      background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
      color: white;
      padding: 14px 15px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .items-table th.amount {
      text-align: right;
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%);
    }
    
    .items-table td {
      padding: 14px 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .items-table tr:nth-child(even) td {
      background: #f9fafb;
    }
    
    .items-table tr:last-child td {
      border-bottom: none;
    }
    
    .items-table td.amount {
      text-align: right;
      font-weight: 700;
      color: ${colors.primary};
      font-size: 11pt;
    }
    
    .item-name {
      font-weight: 600;
      color: #1f2937;
    }
    
    .item-desc {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 2px;
    }
    
    /* Totaux style industriel */
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    
    .totals-card {
      width: 320px;
      background: #1f2937;
      border-radius: 10px;
      overflow: hidden;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 20px;
      color: white;
      font-size: 12px;
    }
    
    .totals-row.sub {
      background: #374151;
    }
    
    .totals-row.discount {
      background: ${colors.primary};
    }
    
    .totals-row.final {
      background: linear-gradient(135deg, ${colors.accent} 0%, ${colors.primary} 100%);
      padding: 18px 20px;
    }
    
    .totals-label {
      font-weight: 500;
    }
    
    .totals-value {
      font-weight: 700;
    }
    
    .totals-row.final .totals-label,
    .totals-row.final .totals-value {
      font-size: 16px;
      font-weight: 700;
    }
    
    /* Notes */
    .notes-card {
      background: #fffbeb;
      border: 2px solid #fcd34d;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 25px;
    }
    
    .notes-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    
    .notes-icon {
      font-size: 16px;
    }
    
    .notes-title {
      font-size: 10px;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .notes-text {
      color: #78350f;
      font-size: 11px;
      line-height: 1.6;
    }
    
    /* Signature */
    .signature-section {
      display: flex;
      gap: 30px;
      margin-bottom: 30px;
    }
    
    .signature-box {
      flex: 1;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .signature-box.signed {
      border-style: solid;
      border-color: #22c55e;
      background: #f0fdf4;
    }
    
    .signature-label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    
    .signature-area {
      height: 60px;
      border-bottom: 1px solid #d1d5db;
      margin-bottom: 10px;
    }
    
    .signature-date {
      font-size: 10px;
      color: #9ca3af;
    }
    
    .signed-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #22c55e;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 11px;
    }
    
    /* Footer industriel */
    .footer {
      border-top: 3px solid #e5e7eb;
      padding-top: 20px;
    }
    
    .footer-content {
      text-align: center;
    }
    
    .footer-legal {
      font-size: 9px;
      color: #9ca3af;
      line-height: 1.8;
      margin-bottom: 12px;
    }
    
    .footer-info {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .footer-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
      color: #6b7280;
    }
    
    .footer-icon {
      color: ${colors.primary};
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="deco-stripe"></div>
    
    <div class="content">
      <div class="header">
        <div class="company">
          <div class="company-icon">🔥</div>
          <div class="company-info">
            <h1>${data.atelier.nom}</h1>
            <div class="company-subtitle">Thermolaquage Professionnel</div>
            <div class="company-contact">
              ${data.atelier.adresse ? `${data.atelier.adresse}<br>` : ''}
              ${data.atelier.telephone ? `📞 ${data.atelier.telephone}` : ''}
              ${data.atelier.email ? ` • ✉️ ${data.atelier.email}` : ''}
            </div>
          </div>
        </div>
        <div class="doc-header">
          <div class="doc-type-badge">${title}</div>
          <div class="doc-number">N° ${data.numero}</div>
          <div class="doc-date">${formatDate(data.date)}</div>
          ${data.validite ? `<div class="doc-date">Valide jusqu'au ${formatDate(data.validite)}</div>` : ''}
        </div>
      </div>

      <div class="client-card">
        <div class="client-label">Client</div>
        <div class="client-name">${data.client.nom}</div>
        <div class="client-details">
          ${data.client.adresse ? `📍 ${data.client.adresse}<br>` : ''}
          ${data.client.telephone ? `📞 ${data.client.telephone}` : ''}
          ${data.client.email ? ` • ✉️ ${data.client.email}` : ''}<br>
          ${data.client.type === 'professionnel' && data.client.siret ? `🏢 SIRET: ${data.client.siret}` : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 40%">Désignation</th>
              <th style="width: 12%">Quantité</th>
              <th style="width: 15%">Surface</th>
              <th style="width: 13%">Couches</th>
              <th style="width: 20%" class="amount">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>
                  <div class="item-name">${item.designation}</div>
                  ${item.description ? `<div class="item-desc">${item.description}</div>` : ''}
                </td>
                <td>${item.quantite}</td>
                <td>${item.surface_m2 ? `${item.surface_m2.toFixed(2)} m²` : '-'}</td>
                <td>${getCouchesDisplay(item.couches)}</td>
                <td class="amount">${formatMoney(item.total_ht)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="totals-wrapper">
        <div class="totals-card">
          <div class="totals-row sub">
            <span class="totals-label">Sous-total HT</span>
            <span class="totals-value">${formatMoney(data.totalHt)}</span>
          </div>
          ${data.remise && data.remise.valeur > 0 ? `
            <div class="totals-row discount">
              <span class="totals-label">Remise ${data.remise.type === 'pourcentage' ? `${data.remise.valeur}%` : ''}</span>
              <span class="totals-value">-${formatMoney(data.remise.type === 'pourcentage' ? data.totalHt * data.remise.valeur / 100 : data.remise.valeur)}</span>
            </div>
          ` : ''}
          <div class="totals-row">
            <span class="totals-label">TVA ${data.tvaRate}%</span>
            <span class="totals-value">${formatMoney(data.totalTva)}</span>
          </div>
          <div class="totals-row final">
            <span class="totals-label">TOTAL TTC</span>
            <span class="totals-value">${formatMoney(data.totalTtc)}</span>
          </div>
        </div>
      </div>

      ${data.notes ? `
        <div class="notes-card">
          <div class="notes-header">
            <span class="notes-icon">📝</span>
            <span class="notes-title">Remarques</span>
          </div>
          <div class="notes-text">${data.notes}</div>
        </div>
      ` : ''}

      ${isDevis ? `
        <div class="signature-section">
          <div class="signature-box ${data.signed ? 'signed' : ''}">
            <div class="signature-label">Signature Client</div>
            ${data.signed ? `
              <div class="signed-badge">✓ Accepté le ${formatDate(data.signed.date)}</div>
            ` : `
              <div class="signature-area"></div>
              <div class="signature-date">Date : ___/___/______</div>
            `}
          </div>
          <div class="signature-box">
            <div class="signature-label">Bon pour accord</div>
            <div class="signature-area"></div>
            <div class="signature-date">Mention "Lu et approuvé"</div>
          </div>
        </div>
      ` : ''}

      <div class="footer">
        <div class="footer-content">
          <div class="footer-legal">
            ${data.cgv || 'Devis valable 30 jours. Acompte de 30% à la commande. Solde à la livraison. Conditions générales disponibles sur demande.'}
          </div>
          <div class="footer-info">
            ${data.atelier.siret ? `<span class="footer-item"><span class="footer-icon">🏭</span> SIRET ${data.atelier.siret}</span>` : ''}
            ${data.atelier.tvaIntra ? `<span class="footer-item"><span class="footer-icon">🇪🇺</span> TVA ${data.atelier.tvaIntra}</span>` : ''}
            ${data.atelier.rcs ? `<span class="footer-item"><span class="footer-icon">⚖️</span> RCS ${data.atelier.rcs}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
