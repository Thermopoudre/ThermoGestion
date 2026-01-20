// Gestion des templates emails
// Remplace les variables dans les templates HTML

import { readFileSync } from 'fs'
import { join } from 'path'
import type { Database } from '@/types/database.types'

type Atelier = Database['public']['Tables']['ateliers']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Devis = Database['public']['Tables']['devis']['Row']

interface TemplateVariables {
  client_name?: string
  devis_numero?: string
  montant_ttc?: string
  montant_ht?: string
  lien_creation_compte?: string
  lien_espace_client?: string
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
 * Générer le template email pour un devis (nouveau client)
 */
export function generateDevisEmailNewClient(
  devis: Devis,
  client: Client,
  atelier: Atelier,
  messagePersonnalise?: string,
  lienCreationCompte?: string
): string {
  const template = loadEmailTemplate('devis-nouveau-client')
  
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
    lien_creation_compte: lienCreationCompte || `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.thermogestion.fr'}/client/inscription?token=${devis.id}`,
    message_personnalise: messagePersonnalise
      ? `<p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6; font-style: italic; border-left: 3px solid #2563eb; padding-left: 15px;">${messagePersonnalise.replace(/\n/g, '<br>')}</p>`
      : '',
    atelier_name: atelier.name,
    atelier_address: atelier.address || '',
    atelier_phone: atelier.phone || '',
    atelier_email: atelier.email || '',
  }

  return renderEmailTemplate(template, variables)
}

/**
 * Générer le template email pour un devis (client existant)
 */
export function generateDevisEmailExistingClient(
  devis: Devis,
  client: Client,
  atelier: Atelier,
  messagePersonnalise?: string,
  lienEspaceClient?: string
): string {
  const template = loadEmailTemplate('devis-client-existant')
  
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
    lien_espace_client: lienEspaceClient || `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.thermogestion.fr'}/client/devis/${devis.id}`,
    message_personnalise: messagePersonnalise
      ? `<p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6; font-style: italic; border-left: 3px solid #2563eb; padding-left: 15px;">${messagePersonnalise.replace(/\n/g, '<br>')}</p>`
      : '',
    atelier_name: atelier.name,
    atelier_address: atelier.address || '',
    atelier_phone: atelier.phone || '',
    atelier_email: atelier.email || '',
  }

  return renderEmailTemplate(template, variables)
}
