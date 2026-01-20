// Utilitaires pour les templates de devis
// Gestion des variables dynamiques et génération HTML

export interface TemplateConfig {
  header: {
    show_logo: boolean
    show_atelier_info: boolean
    layout: 'left' | 'right' | 'center'
    logo_url?: string
  }
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  body: {
    show_client_info: boolean
    table_style: 'bordered' | 'striped' | 'minimal'
    column_widths: Record<string, string>
  }
  footer: {
    show_cgv: boolean
    cgv_text: string
    show_signature: boolean
    custom_text: string
  }
  layout: {
    page_size: 'A4' | 'Letter'
    margins: {
      top: number
      right: number
      bottom: number
      left: number
    }
    font_family: string
    font_size: number
  }
}

export interface DevisData {
  numero: string
  created_at: string
  total_ht: number
  total_ttc: number
  tva_rate: number
  signed_at?: string
  items: Array<{
    designation: string
    longueur: number
    largeur: number
    hauteur?: number
    quantite: number
    surface_m2: number
    couches: number
    total_ht: number
  }>
  clients?: {
    full_name: string
    email?: string
    phone?: string
    address?: string
    siret?: string
    type?: string
  }
  atelier?: {
    name: string
    address?: string
    phone?: string
    email?: string
    siret?: string
  }
}

// Variables dynamiques disponibles
const VARIABLES: Record<string, (data: DevisData) => string> = {
  '{nom_client}': (data) => data.clients?.full_name || '',
  '{email_client}': (data) => data.clients?.email || '',
  '{telephone_client}': (data) => data.clients?.phone || '',
  '{adresse_client}': (data) => data.clients?.address || '',
  '{siret_client}': (data) => data.clients?.siret || '',
  '{nom_atelier}': (data) => data.atelier?.name || '',
  '{adresse_atelier}': (data) => data.atelier?.address || '',
  '{telephone_atelier}': (data) => data.atelier?.phone || '',
  '{email_atelier}': (data) => data.atelier?.email || '',
  '{siret_atelier}': (data) => data.atelier?.siret || '',
  '{numero_devis}': (data) => data.numero,
  '{date_devis}': (data) => new Date(data.created_at).toLocaleDateString('fr-FR'),
  '{date_devis_long}': (data) => new Date(data.created_at).toLocaleDateString('fr-FR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
  '{montant_ht}': (data) => Number(data.total_ht).toFixed(2) + ' €',
  '{montant_ttc}': (data) => Number(data.total_ttc).toFixed(2) + ' €',
  '{tva}': (data) => data.tva_rate.toString(),
  '{montant_tva}': (data) => (Number(data.total_ttc) - Number(data.total_ht)).toFixed(2) + ' €',
  '{date_signature}': (data) => data.signed_at 
    ? new Date(data.signed_at).toLocaleDateString('fr-FR') 
    : '',
  '{heure_signature}': (data) => data.signed_at 
    ? new Date(data.signed_at).toLocaleTimeString('fr-FR') 
    : '',
}

// Remplacer les variables dans un texte
export function replaceVariables(text: string, data: DevisData): string {
  let result = text
  for (const [variable, getValue] of Object.entries(VARIABLES)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), getValue(data))
  }
  return result
}

// Générer le CSS du template
export function generateTemplateCSS(config: TemplateConfig): string {
  const { colors, layout } = config
  const margins = layout.margins

  return `
    @media print {
      body { margin: 0; }
      @page {
        size: ${layout.page_size};
        margin: 0;
      }
    }
    body {
      font-family: ${layout.font_family};
      font-size: ${layout.font_size}px;
      padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px;
      max-width: 800px;
      margin: 0 auto;
      color: #1f2937;
    }
    .header {
      display: flex;
      justify-content: ${config.header.layout === 'left' ? 'flex-start' : config.header.layout === 'right' ? 'flex-end' : 'space-between'};
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${colors.primary};
    }
    .atelier-info {
      flex: 1;
    }
    .devis-info {
      text-align: ${config.header.layout === 'right' ? 'left' : 'right'};
    }
    .devis-title {
      font-size: 32px;
      font-weight: bold;
      color: ${colors.primary};
      margin-bottom: 10px;
    }
    .client-info {
      background: ${colors.accent}15;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid ${colors.primary};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    ${config.body.table_style === 'bordered' ? `
      th, td {
        padding: 12px;
        text-align: left;
        border: 1px solid #e5e7eb;
      }
    ` : config.body.table_style === 'striped' ? `
      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      tbody tr:nth-child(even) {
        background: ${colors.accent}10;
      }
    ` : `
      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #f3f4f6;
      }
    `}
    th {
      background: ${colors.primary}15;
      font-weight: bold;
      color: ${colors.primary};
    }
    .total-row {
      font-weight: bold;
      background: ${colors.accent}20;
    }
    .total-ttc {
      font-size: 20px;
      color: ${colors.primary};
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: ${colors.secondary};
    }
  `
}

// Générer le HTML du template
export function generateTemplateHTML(config: TemplateConfig, data: DevisData): string {
  const { header, body, footer } = config
  const items = data.items || []
  const totalTva = Number(data.total_ttc) - Number(data.total_ht)
  
  // Header
  const headerHTML = `
    <div class="header">
      <div class="atelier-info">
        ${header.show_logo && data.atelier ? `<img src="${header.logo_url || ''}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;" />` : ''}
        ${header.show_atelier_info ? `
          <h1>${replaceVariables('{nom_atelier}', data)}</h1>
          ${data.atelier?.address ? `<p>${replaceVariables('{adresse_atelier}', data)}</p>` : ''}
          ${data.atelier?.phone ? `<p>Tel: ${replaceVariables('{telephone_atelier}', data)}</p>` : ''}
          ${data.atelier?.email ? `<p>Email: ${replaceVariables('{email_atelier}', data)}</p>` : ''}
          ${data.atelier?.siret ? `<p>SIRET: ${replaceVariables('{siret_atelier}', data)}</p>` : ''}
        ` : ''}
      </div>
      <div class="devis-info">
        <div class="devis-title">DEVIS</div>
        <p><strong>Numéro:</strong> ${replaceVariables('{numero_devis}', data)}</p>
        <p><strong>Date:</strong> ${replaceVariables('{date_devis}', data)}</p>
      </div>
    </div>
  `

  // Client info
  const clientInfoHTML = body.show_client_info ? `
    <div class="client-info">
      <h2>Facturer à:</h2>
      <p><strong>${replaceVariables('{nom_client}', data)}</strong></p>
      ${data.clients?.address ? `<p>${replaceVariables('{adresse_client}', data)}</p>` : ''}
      ${data.clients?.phone ? `<p>Tel: ${replaceVariables('{telephone_client}', data)}</p>` : ''}
      ${data.clients?.email ? `<p>Email: ${replaceVariables('{email_client}', data)}</p>` : ''}
      ${data.clients?.type === 'professionnel' && data.clients?.siret ? `<p>SIRET: ${replaceVariables('{siret_client}', data)}</p>` : ''}
    </div>
  ` : ''

  // Table items
  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th>Désignation</th>
          <th>Dimensions</th>
          <th>Qté</th>
          <th>Surface</th>
          <th>Couches</th>
          <th style="text-align: right;">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.designation || ''}</td>
            <td>${item.longueur} × ${item.largeur}${item.hauteur ? ` × ${item.hauteur}` : ''} mm</td>
            <td>${item.quantite || 1}</td>
            <td>${(item.surface_m2 || 0).toFixed(2)} m²</td>
            <td>${item.couches || 1}</td>
            <td style="text-align: right;">${(item.total_ht || 0).toFixed(2)} €</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5" style="text-align: right;"><strong>Total HT</strong></td>
          <td style="text-align: right;">${replaceVariables('{montant_ht}', data)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="5" style="text-align: right;"><strong>TVA (${replaceVariables('{tva}', data)}%)</strong></td>
          <td style="text-align: right;">${replaceVariables('{montant_tva}', data)}</td>
        </tr>
        <tr class="total-row total-ttc">
          <td colspan="5" style="text-align: right;"><strong>Total TTC</strong></td>
          <td style="text-align: right;">${replaceVariables('{montant_ttc}', data)}</td>
        </tr>
      </tfoot>
    </table>
  `

  // Footer
  const footerHTML = `
    <div class="footer">
      ${footer.show_cgv && footer.cgv_text ? `<p>${replaceVariables(footer.cgv_text, data)}</p>` : ''}
      ${footer.custom_text ? `<p>${replaceVariables(footer.custom_text, data)}</p>` : ''}
      ${footer.show_signature && data.signed_at ? `
        <p>✓ Signé électroniquement le ${replaceVariables('{date_signature}', data)} à ${replaceVariables('{heure_signature}', data)}</p>
      ` : ''}
    </div>
  `

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Devis ${data.numero}</title>
  <style>
    ${generateTemplateCSS(config)}
  </style>
</head>
<body>
  ${headerHTML}
  ${clientInfoHTML}
  ${tableHTML}
  ${footerHTML}
</body>
</html>
  `.trim()
}
