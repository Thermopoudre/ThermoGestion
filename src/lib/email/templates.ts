// Gestion des templates emails
// Remplace les variables dans les templates HTML

import { readFileSync } from 'fs'
import { join } from 'path'
import type { Database } from '@/types/database.types'
import { getUnsubscribeFooterHTML } from './unsubscribe'

type Atelier = Database['public']['Tables']['ateliers']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Devis = Database['public']['Tables']['devis']['Row'] & { public_token?: string }

interface TemplateVariables {
  client_name?: string
  devis_numero?: string
  montant_ttc?: string
  montant_ht?: string
  lien_devis_public?: string
  lien_creation_compte?: string
  lien_espace_client?: string
  lien_signature?: string
  message_personnalise?: string
  atelier_name?: string
  atelier_address?: string
  atelier_phone?: string
  atelier_email?: string
  [key: string]: string | undefined
}

/**
 * Charger un template email
 */
export function loadEmailTemplate(templateName: string): string {
  try {
    const templatePath = join(process.cwd(), 'src', 'templates', 'email', `${templateName}.html`)
    return readFileSync(templatePath, 'utf-8')
  } catch (error) {
    console.error(`Erreur chargement template ${templateName}:`, error)
    return ''
  }
}

/**
 * Remplacer les variables dans un template
 */
export function renderEmailTemplate(template: string, variables: TemplateVariables): string {
  let rendered = template

  // Remplacer les variables simples {{variable}}
  Object.keys(variables).forEach((key) => {
    const value = variables[key] || ''
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, value)
  })

  // Gérer les conditionnelles {{#if variable}}...{{/if}}
  // Simple implementation (pour MVP)
  const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
  rendered = rendered.replace(ifRegex, (match, varName, content) => {
    if (variables[varName]) {
      return content
    }
    return ''
  })

  return rendered
}

/**
 * Obtenir l'URL de base de l'application
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'
}

/**
 * Générer le template email pour un devis (nouveau client)
 * Inclut le lien public pour voir/signer le devis ET le lien de création de compte
 */
export function generateDevisEmailNewClient(
  devis: Devis,
  client: Client,
  atelier: Atelier,
  messagePersonnalise?: string
): string {
  const template = loadEmailTemplate('devis-nouveau-client')
  const baseUrl = getBaseUrl()
  
  // Lien public vers le devis (utilise le token public)
  const publicToken = devis.public_token || devis.id
  const lienDevisPublic = `${baseUrl}/p/${publicToken}`
  
  // Lien de création de compte avec email pré-rempli
  const lienCreationCompte = `${baseUrl}/client/auth/inscription?email=${encodeURIComponent(client.email || '')}&from=devis&ref=${devis.id}`
  
  const variables: TemplateVariables = {
    client_name: client.full_name,
    devis_numero: devis.numero,
    montant_ttc: Number(devis.total_ttc).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }),
    montant_ht: Number(devis.total_ht).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }),
    lien_devis_public: lienDevisPublic,
    lien_creation_compte: lienCreationCompte,
    lien_signature: `${lienDevisPublic}/sign`,
    message_personnalise: messagePersonnalise
      ? `<div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">${messagePersonnalise.replace(/\n/g, '<br>')}</p>
        </div>`
      : '',
    atelier_name: atelier.name,
    atelier_address: atelier.address || '',
    atelier_phone: atelier.phone || '',
    atelier_email: atelier.email || '',
  }

  return renderEmailTemplate(template, variables)
}

/**
 * Générer le template email pour un devis (client existant avec compte)
 */
export function generateDevisEmailExistingClient(
  devis: Devis,
  client: Client,
  atelier: Atelier,
  messagePersonnalise?: string
): string {
  const template = loadEmailTemplate('devis-client-existant')
  const baseUrl = getBaseUrl()
  
  // Client avec compte -> lien vers son espace client
  const lienEspaceClient = `${baseUrl}/client/projets`
  
  // Mais aussi le lien public direct vers ce devis
  const publicToken = devis.public_token || devis.id
  const lienDevisPublic = `${baseUrl}/p/${publicToken}`
  
  const variables: TemplateVariables = {
    client_name: client.full_name,
    devis_numero: devis.numero,
    montant_ttc: Number(devis.total_ttc).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }),
    montant_ht: Number(devis.total_ht).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }),
    lien_espace_client: lienEspaceClient,
    lien_devis_public: lienDevisPublic,
    lien_signature: `${lienDevisPublic}/sign`,
    message_personnalise: messagePersonnalise
      ? `<div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">${messagePersonnalise.replace(/\n/g, '<br>')}</p>
        </div>`
      : '',
    atelier_name: atelier.name,
    atelier_address: atelier.address || '',
    atelier_phone: atelier.phone || '',
    atelier_email: atelier.email || '',
  }

  return renderEmailTemplate(template, variables)
}

/**
 * Générer un email de notification de projet mis à jour
 */
export function generateProjetUpdateEmail(
  projet: any,
  client: Client,
  atelier: Atelier,
  nouveauStatut: string
): string {
  const baseUrl = getBaseUrl()
  const publicToken = projet.public_token || projet.id
  const lienProjet = `${baseUrl}/p/${publicToken}`
  
  const statusLabels: Record<string, string> = {
    en_attente: 'En attente',
    en_preparation: 'En préparation',
    en_traitement: 'En cours de thermolaquage',
    sechage: 'En séchage',
    controle_qualite: 'Contrôle qualité',
    pret: '✅ Prêt à récupérer !',
    livre: 'Livré',
  }

  const statusLabel = statusLabels[nouveauStatut] || nouveauStatut

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Mise à jour de votre projet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">${atelier.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px;">Bonjour ${client.full_name},</h2>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Bonne nouvelle ! Votre projet a été mis à jour :
              </p>
              
              <div style="background: linear-gradient(135deg, #fef3e9 0%, #fff7ed 100%); border: 2px solid #fed7aa; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
                <p style="margin: 0 0 5px; color: #9a3412; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Nouveau statut</p>
                <p style="margin: 0; color: #c2410c; font-size: 24px; font-weight: bold;">${statusLabel}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${lienProjet}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
                  Suivre mon projet →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1f2937; padding: 25px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                ${atelier.name} ${atelier.phone ? `• ${atelier.phone}` : ''} ${atelier.email ? `• ${atelier.email}` : ''}
              </p>
              ${client.email ? getUnsubscribeFooterHTML(client.email, (atelier as any).id || '', atelier.name) : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
