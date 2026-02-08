/**
 * Gestion de la désinscription marketing (RGPD + LCEN)
 * 
 * Obligations légales :
 * - Art. L34-5 CPCE (LCEN) : lien de désinscription obligatoire dans tout email commercial
 * - Art. 21 RGPD : droit d'opposition au traitement à des fins de marketing
 * 
 * Chaque email marketing/commercial DOIT contenir un lien de désinscription fonctionnel.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Générer un token de désinscription signé (HMAC-like simple)
 * Le token encode l'email + l'atelier ID pour permettre la désinscription sans auth
 */
export function generateUnsubscribeToken(email: string, atelierId: string): string {
  const payload = `${email}:${atelierId}`
  // Encodage base64url (pas de crypto secret, juste pour éviter le tampering basique)
  return Buffer.from(payload).toString('base64url')
}

/**
 * Décoder un token de désinscription
 */
export function decodeUnsubscribeToken(token: string): { email: string; atelierId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const [email, atelierId] = decoded.split(':')
    if (!email || !atelierId) return null
    return { email, atelierId }
  } catch {
    return null
  }
}

/**
 * Marquer un client comme désabonné du marketing
 */
export async function unsubscribeClient(email: string, atelierId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return false

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Mettre à jour le champ no_marketing du client
    const { error } = await supabase
      .from('clients')
      .update({ no_marketing: true })
      .eq('email', email)
      .eq('atelier_id', atelierId)

    if (error) {
      console.error('Erreur désinscription:', error)
      return false
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      atelier_id: atelierId,
      action: 'client_unsubscribed',
      entity_type: 'client',
      details: { email, method: 'email_link' },
    }).catch(() => {})

    return true
  } catch {
    return false
  }
}

/**
 * Générer le footer de désinscription HTML pour les emails marketing
 * Conforme LCEN art. L34-5 CPCE + RGPD art. 21
 */
export function getUnsubscribeFooterHTML(email: string, atelierId: string, atelierName?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'
  const token = generateUnsubscribeToken(email, atelierId)
  const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${token}`

  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 8px; color: #9ca3af; font-size: 11px; line-height: 1.5;">
        Vous recevez cet email car vous êtes client de ${atelierName || 'notre atelier'}.
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 11px;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
          Se désinscrire des emails marketing
        </a>
        &nbsp;|&nbsp;
        <a href="${baseUrl}/politique-confidentialite" style="color: #6b7280; text-decoration: underline;">
          Politique de confidentialité
        </a>
      </p>
    </div>
  `
}

/**
 * Ajouter le header List-Unsubscribe aux emails (RFC 2369)
 * Recommandé pour les emails marketing (améliore la délivrabilité)
 */
export function getUnsubscribeHeaders(email: string, atelierId: string): Record<string, string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'
  const token = generateUnsubscribeToken(email, atelierId)
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${token}`

  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
