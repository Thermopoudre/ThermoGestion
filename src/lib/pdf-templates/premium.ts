// Template Premium - Design haut de gamme élégant
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
  primary: '#1f2937',
  accent: '#d4af37',
}

export function generatePremiumTemplate(data: TemplateData, customColors?: CustomColors): string {
  const isDevis = data.type === 'devis'
  const title = isDevis ? 'Devis' : 'Facture'
  
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
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page { size: A4; margin: 0; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    
    body {
      font-family: 'Source Sans 3', sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #1f2937;
      background: white;
    }
    
    .page {
      min-height: 297mm;
      position: relative;
      background: white;
    }
    
    /* Bordure décorative */
    .border-frame {
      position: absolute;
      top: 15px;
      left: 15px;
      right: 15px;
      bottom: 15px;
      border: 1px solid #d4af37;
      pointer-events: none;
    }
    
    .corner {
      position: absolute;
      width: 30px;
      height: 30px;
      border-color: #d4af37;
      border-style: solid;
    }
    
    .corner-tl { top: -1px; left: -1px; border-width: 3px 0 0 3px; }
    .corner-tr { top: -1px; right: -1px; border-width: 3px 3px 0 0; }
    .corner-bl { bottom: -1px; left: -1px; border-width: 0 0 3px 3px; }
    .corner-br { bottom: -1px; right: -1px; border-width: 0 3px 3px 0; }
    
    .content {
      padding: 50px;
      position: relative;
    }
    
    /* Header élégant */
    .header {
      text-align: center;
      margin-bottom: 45px;
      padding-bottom: 30px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .brand-name {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      font-weight: 600;
      color: #1f2937;
      letter-spacing: 4px;
      margin-bottom: 8px;
    }
    
    .brand-tagline {
      font-size: 11px;
      color: #d4af37;
      text-transform: uppercase;
      letter-spacing: 4px;
      font-weight: 500;
    }
    
    .brand-contact {
      margin-top: 15px;
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 1px;
    }
    
    .brand-contact span {
      margin: 0 10px;
    }
    
    /* Titre du document */
    .doc-title-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }
    
    .doc-title {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 500;
      color: #1f2937;
      position: relative;
    }
    
    .doc-title::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 0;
      width: 60px;
      height: 2px;
      background: #d4af37;
    }
    
    .doc-meta {
      text-align: right;
    }
    
    .doc-number {
      font-size: 13px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .doc-date {
      font-size: 11px;
      color: #9ca3af;
    }
    
    /* Info client premium */
    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    
    .party-card {
      padding: 25px;
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      border-radius: 4px;
      position: relative;
    }
    
    .party-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #d4af37 0%, #c9a227 100%);
      border-radius: 4px 0 0 4px;
    }
    
    .party-label {
      font-size: 9px;
      font-weight: 600;
      color: #d4af37;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
    }
    
    .party-name {
      font-family: 'Playfair Display', serif;
      font-size: 18px;
      font-weight: 500;
      color: #1f2937;
      margin-bottom: 10px;
    }
    
    .party-details {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.8;
    }
    
    /* Tableau élégant */
    .items-section {
      margin-bottom: 35px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .items-table thead {
      border-bottom: 2px solid #1f2937;
    }
    
    .items-table th {
      padding: 15px 12px;
      text-align: left;
      font-size: 9px;
      font-weight: 600;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    
    .items-table th:last-child {
      text-align: right;
    }
    
    .items-table td {
      padding: 18px 12px;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: top;
    }
    
    .items-table tr:last-child td {
      border-bottom: none;
    }
    
    .items-table td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1f2937;
    }
    
    .item-title {
      font-weight: 500;
      color: #1f2937;
      margin-bottom: 3px;
    }
    
    .item-subtitle {
      font-size: 10px;
      color: #9ca3af;
      font-style: italic;
    }
    
    /* Totaux premium */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    
    .totals-container {
      width: 320px;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      font-size: 12px;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .totals-row:last-child {
      border-bottom: none;
    }
    
    .totals-label {
      color: #6b7280;
      font-weight: 400;
    }
    
    .totals-value {
      color: #1f2937;
      font-weight: 500;
    }
    
    .totals-row.grand {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 2px solid #1f2937;
      border-bottom: none;
    }
    
    .totals-row.grand .totals-label {
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      font-weight: 500;
      color: #1f2937;
    }
    
    .totals-row.grand .totals-value {
      font-family: 'Playfair Display', serif;
      font-size: 22px;
      font-weight: 600;
      color: #d4af37;
    }
    
    /* Notes élégantes */
    .notes-section {
      background: #fefbf3;
      border: 1px solid #f5e6c8;
      padding: 20px;
      margin-bottom: 35px;
    }
    
    .notes-label {
      font-size: 9px;
      font-weight: 600;
      color: #b8860b;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }
    
    .notes-text {
      font-size: 11px;
      color: #8b6914;
      line-height: 1.7;
      font-style: italic;
    }
    
    /* Zone signature premium */
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    
    .signature-card {
      text-align: center;
      padding: 25px;
      border: 1px solid #e5e7eb;
    }
    
    .signature-card.signed {
      background: #f8fdf8;
      border-color: #86efac;
    }
    
    .signature-title {
      font-size: 9px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }
    
    .signature-area {
      height: 60px;
      border-bottom: 1px solid #d1d5db;
      margin-bottom: 12px;
    }
    
    .signature-hint {
      font-size: 10px;
      color: #9ca3af;
      font-style: italic;
    }
    
    .signed-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #16a34a;
      font-weight: 600;
      font-size: 12px;
    }
    
    .signed-check {
      width: 24px;
      height: 24px;
      background: #22c55e;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Footer premium */
    .footer {
      text-align: center;
      padding-top: 25px;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-legal {
      font-size: 9px;
      color: #9ca3af;
      line-height: 1.8;
      margin-bottom: 15px;
      font-style: italic;
    }
    
    .footer-info {
      display: flex;
      justify-content: center;
      gap: 25px;
      font-size: 9px;
      color: #6b7280;
    }
    
    .footer-divider {
      color: #d4af37;
    }
    
    /* Filigrane décoratif */
    .watermark {
      position: absolute;
      bottom: 100px;
      right: 50px;
      font-family: 'Playfair Display', serif;
      font-size: 120px;
      color: rgba(212, 175, 55, 0.05);
      font-weight: 700;
      pointer-events: none;
      transform: rotate(-15deg);
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="border-frame">
      <div class="corner corner-tl"></div>
      <div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div>
      <div class="corner corner-br"></div>
    </div>
    
    <div class="watermark">${isDevis ? 'D' : 'F'}</div>
    
    <div class="content">
      <div class="header">
        <div class="brand-name">${data.atelier.nom.toUpperCase()}</div>
        <div class="brand-tagline">Excellence & Savoir-faire</div>
        <div class="brand-contact">
          ${data.atelier.telephone ? `<span>${data.atelier.telephone}</span>` : ''}
          ${data.atelier.email ? `<span>•</span><span>${data.atelier.email}</span>` : ''}
          ${data.atelier.adresse ? `<span>•</span><span>${data.atelier.adresse}</span>` : ''}
        </div>
      </div>

      <div class="doc-title-section">
        <div class="doc-title">${title}</div>
        <div class="doc-meta">
          <div class="doc-number">Réf. ${data.numero}</div>
          <div class="doc-date">${formatDate(data.date)}</div>
        </div>
      </div>

      <div class="parties-grid">
        <div class="party-card">
          <div class="party-label">Émetteur</div>
          <div class="party-name">${data.atelier.nom}</div>
          <div class="party-details">
            ${data.atelier.adresse ? `${data.atelier.adresse}<br>` : ''}
            ${data.atelier.siret ? `SIRET: ${data.atelier.siret}` : ''}
          </div>
        </div>
        <div class="party-card">
          <div class="party-label">Destinataire</div>
          <div class="party-name">${data.client.nom}</div>
          <div class="party-details">
            ${data.client.adresse ? `${data.client.adresse}<br>` : ''}
            ${data.client.telephone ? `${data.client.telephone}<br>` : ''}
            ${data.client.type === 'professionnel' && data.client.siret ? `SIRET: ${data.client.siret}` : ''}
          </div>
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
                  <div class="item-title">${item.designation}</div>
                  ${item.description ? `<div class="item-subtitle">${item.description}</div>` : ''}
                </td>
                <td>${item.quantite}</td>
                <td>${item.surface_m2 ? `${item.surface_m2.toFixed(2)} m²` : '—'}</td>
                <td>${getCouchesDisplay(item.couches)}</td>
                <td>${formatMoney(item.total_ht)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="totals-section">
        <div class="totals-container">
          <div class="totals-row">
            <span class="totals-label">Sous-total HT</span>
            <span class="totals-value">${formatMoney(data.totalHt)}</span>
          </div>
          ${data.remise && data.remise.valeur > 0 ? `
            <div class="totals-row">
              <span class="totals-label">Remise ${data.remise.type === 'pourcentage' ? `(${data.remise.valeur}%)` : ''}</span>
              <span class="totals-value" style="color: #dc2626">-${formatMoney(data.remise.type === 'pourcentage' ? data.totalHt * data.remise.valeur / 100 : data.remise.valeur)}</span>
            </div>
          ` : ''}
          <div class="totals-row">
            <span class="totals-label">TVA (${data.tvaRate}%)</span>
            <span class="totals-value">${formatMoney(data.totalTva)}</span>
          </div>
          <div class="totals-row grand">
            <span class="totals-label">Total TTC</span>
            <span class="totals-value">${formatMoney(data.totalTtc)}</span>
          </div>
        </div>
      </div>

      ${data.notes ? `
        <div class="notes-section">
          <div class="notes-label">Observations</div>
          <div class="notes-text">${data.notes}</div>
        </div>
      ` : ''}

      ${isDevis ? `
        <div class="signature-grid">
          <div class="signature-card ${data.signed ? 'signed' : ''}">
            <div class="signature-title">Signature du client</div>
            ${data.signed ? `
              <div class="signed-badge">
                <span class="signed-check">✓</span>
                Accepté le ${formatDate(data.signed.date)}
              </div>
            ` : `
              <div class="signature-area"></div>
              <div class="signature-hint">Précédé de la mention "Bon pour accord"</div>
            `}
          </div>
          <div class="signature-card">
            <div class="signature-title">Date</div>
            <div class="signature-area"></div>
            <div class="signature-hint">_____ / _____ / _________</div>
          </div>
        </div>
      ` : ''}

      ${isDevis ? getRetractationHTML(data.client.type) : ''}

      <div class="footer">
        <div class="footer-legal">
          ${data.cgv || getDefaultCGV(data.type)}
        </div>
        <div class="footer-info">
          ${data.atelier.siret ? `<span>SIRET ${data.atelier.siret}</span>` : ''}
          ${data.atelier.siret && data.atelier.tvaIntra ? `<span class="footer-divider">✦</span>` : ''}
          ${data.atelier.tvaIntra ? `<span>TVA ${data.atelier.tvaIntra}</span>` : ''}
          ${data.atelier.tvaIntra && data.atelier.rcs ? `<span class="footer-divider">✦</span>` : ''}
          ${data.atelier.rcs ? `<span>RCS ${data.atelier.rcs}</span>` : ''}
          ${!isDevis && data.atelier.iban ? `<br/><span style="margin-top:4px;display:inline-block">IBAN: ${data.atelier.iban}</span>` : ''}
          ${!isDevis && data.atelier.bic ? `<span class="footer-divider">✦</span><span>BIC: ${data.atelier.bic}</span>` : ''}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
