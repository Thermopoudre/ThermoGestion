// Template Bon de Livraison - Format A4
import type { CustomColors } from './generator'

export interface BonLivraisonData {
  numero: string
  date_livraison: string
  
  // Client
  client: {
    nom: string
    adresse?: string
    telephone?: string
    email?: string
  }
  
  // Atelier
  atelier: {
    nom: string
    adresse?: string
    telephone?: string
    email?: string
    siret?: string
  }
  
  // Projet référence
  projet: {
    numero: string
    name: string
  }
  
  // Livraison
  adresse_livraison?: string
  transporteur?: string
  
  // Items
  items: Array<{
    designation: string
    description?: string
    quantite: number
  }>
  
  // Observations
  observations?: string
  etat_pieces?: 'conforme' | 'reserve' | 'non_conforme'
  reserves?: string
  
  // Signature
  signed?: {
    nom_signataire?: string
    date?: string
  }
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Couleurs par défaut
const DEFAULT_COLORS = {
  primary: '#1e40af', // Bleu pour BL (différent des factures)
  accent: '#3b82f6',
}

export function generateBonLivraisonTemplate(data: BonLivraisonData, customColors?: CustomColors): string {
  const colors = {
    primary: customColors?.primary || DEFAULT_COLORS.primary,
    accent: customColors?.accent || DEFAULT_COLORS.accent,
  }

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de Livraison ${data.numero}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 15mm;
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
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${colors.primary};
    }
    
    .company-name {
      font-size: 18pt;
      font-weight: 700;
      color: ${colors.primary};
      margin-bottom: 5px;
    }
    
    .company-details {
      color: #6b7280;
      font-size: 9pt;
      line-height: 1.6;
    }
    
    .document-type {
      font-size: 22pt;
      font-weight: 700;
      color: ${colors.primary};
      text-align: right;
      margin-bottom: 8px;
    }
    
    .document-number {
      font-size: 11pt;
      color: ${colors.accent};
      font-weight: 600;
      text-align: right;
      margin-bottom: 3px;
    }
    
    .document-date {
      color: #6b7280;
      font-size: 10pt;
      text-align: right;
    }
    
    .parties-section {
      display: flex;
      gap: 30px;
      margin-bottom: 25px;
    }
    
    .party-box {
      flex: 1;
      background: #f8fafc;
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
      font-size: 12pt;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .party-details {
      color: #6b7280;
      font-size: 9pt;
      line-height: 1.6;
    }
    
    .info-box {
      background: linear-gradient(135deg, ${colors.primary}10 0%, ${colors.accent}10 100%);
      border: 1px solid ${colors.primary}30;
      border-radius: 8px;
      padding: 12px 15px;
      margin-bottom: 20px;
      display: flex;
      gap: 30px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 8pt;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    
    .info-value {
      font-size: 10pt;
      font-weight: 600;
      color: #1f2937;
    }
    
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 25px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .items-table th {
      background: ${colors.primary};
      color: white;
      padding: 12px 15px;
      text-align: left;
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .items-table th:first-child {
      width: 60%;
    }
    
    .items-table th:last-child {
      text-align: center;
      width: 20%;
    }
    
    .items-table td {
      padding: 12px 15px;
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
      text-align: center;
      font-weight: 600;
      color: ${colors.primary};
    }
    
    .item-designation {
      font-weight: 500;
      color: #1f2937;
    }
    
    .item-description {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 2px;
    }
    
    .observations-box {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 25px;
    }
    
    .observations-title {
      font-weight: 600;
      color: #92400e;
      font-size: 9pt;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .observations-content {
      color: #78350f;
      font-size: 10pt;
    }
    
    .signature-section {
      display: flex;
      gap: 30px;
      margin-top: 30px;
      margin-bottom: 20px;
    }
    
    .signature-box {
      flex: 1;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      min-height: 120px;
    }
    
    .signature-box.signed {
      border-style: solid;
      border-color: #22c55e;
      background: #f0fdf4;
    }
    
    .signature-label {
      font-size: 9pt;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    
    .signature-area {
      height: 50px;
      border-bottom: 1px solid #d1d5db;
      margin-bottom: 10px;
    }
    
    .signature-info {
      font-size: 9pt;
      color: #9ca3af;
    }
    
    .etat-section {
      margin-bottom: 20px;
    }
    
    .etat-title {
      font-weight: 600;
      font-size: 10pt;
      color: #1f2937;
      margin-bottom: 10px;
    }
    
    .etat-options {
      display: flex;
      gap: 20px;
    }
    
    .etat-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .etat-checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
    }
    
    .etat-checkbox.checked {
      background: ${colors.primary};
      border-color: ${colors.primary};
    }
    
    .footer {
      margin-top: auto;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .footer-text {
      font-size: 8pt;
      color: #9ca3af;
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
        ${data.atelier.email ? `${data.atelier.email}` : ''}
      </div>
    </div>
    <div class="document-info">
      <div class="document-type">BON DE LIVRAISON</div>
      <div class="document-number">N° ${data.numero}</div>
      <div class="document-date">${formatDate(data.date_livraison)}</div>
    </div>
  </div>

  <div class="parties-section">
    <div class="party-box">
      <div class="party-label">Destinataire</div>
      <div class="party-name">${data.client.nom}</div>
      <div class="party-details">
        ${data.adresse_livraison || data.client.adresse ? `${data.adresse_livraison || data.client.adresse}<br>` : ''}
        ${data.client.telephone ? `Tél: ${data.client.telephone}` : ''}
      </div>
    </div>
    <div class="party-box">
      <div class="party-label">Référence Projet</div>
      <div class="party-name">${data.projet.numero}</div>
      <div class="party-details">${data.projet.name}</div>
    </div>
  </div>

  <div class="info-box">
    <div class="info-item">
      <span class="info-label">Date de livraison</span>
      <span class="info-value">${formatDate(data.date_livraison)}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Mode de livraison</span>
      <span class="info-value">${data.transporteur || 'Retrait sur place'}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Nombre de pièces</span>
      <span class="info-value">${data.items.reduce((sum, item) => sum + (item.quantite || 1), 0)}</span>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Désignation</th>
        <th>Description</th>
        <th>Quantité</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(item => `
        <tr>
          <td>
            <div class="item-designation">${item.designation}</div>
          </td>
          <td>
            <div class="item-description">${item.description || '-'}</div>
          </td>
          <td>${item.quantite}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${data.observations ? `
    <div class="observations-box">
      <div class="observations-title">Observations</div>
      <div class="observations-content">${data.observations}</div>
    </div>
  ` : ''}

  <div class="etat-section">
    <div class="etat-title">État des pièces à réception :</div>
    <div class="etat-options">
      <div class="etat-option">
        <div class="etat-checkbox ${data.etat_pieces === 'conforme' ? 'checked' : ''}"></div>
        <span>Conforme</span>
      </div>
      <div class="etat-option">
        <div class="etat-checkbox ${data.etat_pieces === 'reserve' ? 'checked' : ''}"></div>
        <span>Avec réserves</span>
      </div>
      <div class="etat-option">
        <div class="etat-checkbox ${data.etat_pieces === 'non_conforme' ? 'checked' : ''}"></div>
        <span>Non conforme</span>
      </div>
    </div>
    ${data.reserves ? `<div style="margin-top: 10px; font-size: 9pt; color: #dc2626;"><strong>Réserves :</strong> ${data.reserves}</div>` : ''}
  </div>

  <div class="signature-section">
    <div class="signature-box ${data.signed ? 'signed' : ''}">
      <div class="signature-label">Signature Livreur</div>
      <div class="signature-area"></div>
      <div class="signature-info">Nom : ___________________</div>
    </div>
    <div class="signature-box ${data.signed ? 'signed' : ''}">
      <div class="signature-label">Signature Client</div>
      ${data.signed ? `
        <div style="color: #166534; font-weight: 600; margin-top: 20px;">
          ✓ Signé le ${data.signed.date ? formatDate(data.signed.date) : ''}
          ${data.signed.nom_signataire ? `<br>par ${data.signed.nom_signataire}` : ''}
        </div>
      ` : `
        <div class="signature-area"></div>
        <div class="signature-info">Nom : ___________________</div>
      `}
    </div>
  </div>

  <div class="footer">
    <div class="footer-text">
      Document à conserver - Bon de livraison ${data.numero}
      ${data.atelier.siret ? ` | SIRET: ${data.atelier.siret}` : ''}
    </div>
  </div>
</body>
</html>
  `.trim()
}
