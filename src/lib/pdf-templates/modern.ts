// Template Modern - Design contemporain et épuré
import type { TemplateData } from './index'
import { getRetractationHTML, getDefaultCGV } from './index'
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
  primary: '#0f172a',
  accent: '#06b6d4',
}

export function generateModernTemplate(data: TemplateData, customColors?: CustomColors): string {
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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page { size: A4; margin: 0; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #0f172a;
      background: white;
    }
    
    .page-container {
      padding: 0;
      min-height: 297mm;
      position: relative;
    }
    
    .accent-bar {
      height: 8px;
      background: linear-gradient(90deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%);
    }
    
    .content {
      padding: 35px 45px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
    }
    
    .brand {
      flex: 1;
    }
    
    .brand-name {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    
    .brand-tagline {
      font-size: 11px;
      color: #06b6d4;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .brand-contact {
      margin-top: 12px;
      font-size: 10px;
      color: #64748b;
      line-height: 1.7;
    }
    
    .doc-badge {
      text-align: right;
    }
    
    .doc-type {
      display: inline-block;
      background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
      color: white;
      padding: 12px 28px;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 3px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    
    .doc-meta {
      font-size: 12px;
      color: #64748b;
    }
    
    .doc-number {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    
    .client-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
      border: 1px solid #e2e8f0;
    }
    
    .section-badge {
      display: inline-block;
      background: #0f172a;
      color: white;
      font-size: 9px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    
    .client-name {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    
    .client-details {
      color: #64748b;
      font-size: 11px;
      line-height: 1.8;
    }
    
    .items-section {
      margin-bottom: 30px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .items-table th {
      background: #0f172a;
      color: white;
      padding: 14px 16px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .items-table th:first-child {
      border-radius: 8px 0 0 0;
    }
    
    .items-table th:last-child {
      border-radius: 0 8px 0 0;
      text-align: right;
    }
    
    .items-table td {
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    
    .items-table tr:hover td {
      background: #f8fafc;
    }
    
    .items-table td:last-child {
      text-align: right;
      font-weight: 700;
      color: #0891b2;
      font-size: 12px;
    }
    
    .item-main {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 3px;
    }
    
    .item-sub {
      font-size: 10px;
      color: #94a3b8;
    }
    
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 35px;
    }
    
    .summary-card {
      width: 300px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 12px;
      padding: 25px;
      border: 1px solid #e2e8f0;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 12px;
    }
    
    .summary-row.divider {
      border-bottom: 1px dashed #cbd5e1;
      margin-bottom: 10px;
      padding-bottom: 15px;
    }
    
    .summary-label {
      color: #64748b;
    }
    
    .summary-value {
      font-weight: 600;
      color: #0f172a;
    }
    
    .summary-row.total {
      background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
      color: white;
      margin: 15px -25px -25px;
      padding: 18px 25px;
      border-radius: 0 0 12px 12px;
    }
    
    .summary-row.total .summary-label,
    .summary-row.total .summary-value {
      color: white;
      font-size: 16px;
      font-weight: 700;
    }
    
    .action-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .action-box {
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      padding: 25px;
      text-align: center;
    }
    
    .action-box.signed {
      border-style: solid;
      border-color: #10b981;
      background: #f0fdf4;
    }
    
    .action-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .action-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    
    .signed-status {
      color: #059669;
      font-weight: 700;
      font-size: 12px;
    }
    
    .signature-line {
      border-bottom: 1px solid #cbd5e1;
      height: 50px;
      margin-bottom: 10px;
    }
    
    .signature-date {
      font-size: 10px;
      color: #94a3b8;
    }
    
    .notes-box {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .notes-label {
      font-size: 9px;
      font-weight: 700;
      color: #a16207;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    
    .notes-text {
      font-size: 11px;
      color: #854d0e;
      line-height: 1.6;
    }
    
    .footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 20px;
      text-align: center;
    }
    
    .footer-legal {
      font-size: 9px;
      color: #94a3b8;
      line-height: 1.8;
      margin-bottom: 10px;
    }
    
    .footer-badges {
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
    }
    
    .footer-badge {
      background: #f1f5f9;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 9px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="accent-bar"></div>
    
    <div class="content">
      <div class="header">
        <div class="brand">
          <div class="brand-name">${data.atelier.nom}</div>
          <div class="brand-tagline">Excellence & Savoir-faire</div>
          <div class="brand-contact">
            ${data.atelier.adresse ? `${data.atelier.adresse}<br>` : ''}
            ${data.atelier.telephone ? `${data.atelier.telephone}` : ''}${data.atelier.email ? ` • ${data.atelier.email}` : ''}
          </div>
        </div>
        <div class="doc-badge">
          <div class="doc-type">${title}</div>
          <div class="doc-number">${data.numero}</div>
          <div class="doc-meta">${formatDate(data.date)}</div>
        </div>
      </div>

      <div class="client-section">
        <div class="section-badge">Client</div>
        <div class="client-name">${data.client.nom}</div>
        <div class="client-details">
          ${data.client.adresse ? `${data.client.adresse}<br>` : ''}
          ${data.client.telephone ? `Tél: ${data.client.telephone}` : ''}${data.client.email ? ` • ${data.client.email}` : ''}<br>
          ${data.client.type === 'professionnel' && data.client.siret ? `SIRET: ${data.client.siret}` : ''}
        </div>
      </div>

      <div class="items-section">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 45%">Description</th>
              <th style="width: 12%">Quantité</th>
              <th style="width: 15%">Surface</th>
              <th style="width: 10%">Couches</th>
              <th style="width: 18%">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>
                  <div class="item-main">${item.designation}</div>
                  ${item.description ? `<div class="item-sub">${item.description}</div>` : ''}
                </td>
                <td>${item.quantite}</td>
                <td>${item.surface_m2 ? `${item.surface_m2.toFixed(2)} m²` : '-'}</td>
                <td>${getCouchesDisplay(item.couches)}</td>
                <td>${formatMoney(item.total_ht)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-row divider">
            <span class="summary-label">Sous-total HT</span>
            <span class="summary-value">${formatMoney(data.totalHt)}</span>
          </div>
          ${data.remise && data.remise.valeur > 0 ? `
            <div class="summary-row">
              <span class="summary-label">Remise ${data.remise.type === 'pourcentage' ? `${data.remise.valeur}%` : ''}</span>
              <span class="summary-value" style="color: #ef4444">-${formatMoney(data.remise.type === 'pourcentage' ? data.totalHt * data.remise.valeur / 100 : data.remise.valeur)}</span>
            </div>
          ` : ''}
          <div class="summary-row">
            <span class="summary-label">TVA ${data.tvaRate}%</span>
            <span class="summary-value">${formatMoney(data.totalTva)}</span>
          </div>
          <div class="summary-row total">
            <span class="summary-label">Total TTC</span>
            <span class="summary-value">${formatMoney(data.totalTtc)}</span>
          </div>
        </div>
      </div>

      ${data.notes ? `
        <div class="notes-box">
          <div class="notes-label">Remarques</div>
          <div class="notes-text">${data.notes}</div>
        </div>
      ` : ''}

      ${isDevis ? `
        <div class="action-section">
          <div class="action-box ${data.signed ? 'signed' : ''}">
            <div class="action-icon">${data.signed ? '✓' : '✍️'}</div>
            <div class="action-title">Signature Client</div>
            ${data.signed ? `
              <div class="signed-status">Accepté le ${formatDate(data.signed.date)}</div>
            ` : `
              <div class="signature-line"></div>
              <div class="signature-date">Date: ___/___/______</div>
            `}
          </div>
          <div class="action-box">
            <div class="action-icon">📋</div>
            <div class="action-title">Mention "Lu et approuvé"</div>
            <div class="signature-line"></div>
          </div>
        </div>
      ` : ''}

      ${isDevis ? getRetractationHTML(data.client.type) : ''}

      <div class="footer">
        <div class="footer-legal">
          ${data.cgv || getDefaultCGV(data.type)}
        </div>
        <div class="footer-badges">
          ${data.atelier.siret ? `<span class="footer-badge">SIRET ${data.atelier.siret}</span>` : ''}
          ${data.atelier.tvaIntra ? `<span class="footer-badge">TVA ${data.atelier.tvaIntra}</span>` : ''}
          ${data.atelier.rcs ? `<span class="footer-badge">RCS ${data.atelier.rcs}</span>` : ''}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
