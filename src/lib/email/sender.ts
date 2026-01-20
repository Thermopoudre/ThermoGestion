// Service principal d'envoi email
// Gère la configuration et l'envoi via différents providers

import { createServerClient } from '@/lib/supabase/server'
import { sendEmailWithResend } from './resend'
import { sendEmailWithSMTP } from './smtp'
import { addEmailToQueue, updateEmailQueueStatus } from './queue'
import type { EmailMessage, EmailConfig } from './types'

/**
 * Récupérer la configuration email d'un atelier
 */
export async function getAtelierEmailConfig(atelierId: string): Promise<EmailConfig | null> {
  const supabase = await createServerClient()

  const { data: atelier, error } = await supabase
    .from('ateliers')
    .select('settings, email, name')
    .eq('id', atelierId)
    .single()

  if (error || !atelier) {
    return null
  }

  const settings = (atelier.settings as any) || {}
  const emailConfig = settings.email_config

  if (!emailConfig) {
    // Configuration par défaut (Resend avec clé globale)
    return {
      provider: 'resend',
      from_email: atelier.email || 'noreply@thermogestion.fr',
      from_name: atelier.name || 'ThermoGestion',
    }
  }

  return {
    provider: emailConfig.provider || 'resend',
    from_email: emailConfig.from_email || atelier.email || 'noreply@thermogestion.fr',
    from_name: emailConfig.from_name || atelier.name || 'ThermoGestion',
    resend_api_key: emailConfig.resend_api_key,
    smtp_host: emailConfig.smtp_host,
    smtp_port: emailConfig.smtp_port,
    smtp_user: emailConfig.smtp_user,
    smtp_password: emailConfig.smtp_password,
    smtp_secure: emailConfig.smtp_secure,
  }
}

/**
 * Envoyer un email (directement ou via queue)
 */
export async function sendEmail(
  atelierId: string,
  message: EmailMessage,
  useQueue: boolean = true
): Promise<{ success: boolean; messageId?: string; queueId?: string; error?: string }> {
  try {
    const config = await getAtelierEmailConfig(atelierId)

    if (!config) {
      return { success: false, error: 'Configuration email non trouvée' }
    }

    // Si queue activée, ajouter à la queue
    if (useQueue) {
      const queueResult = await addEmailToQueue(atelierId, message)
      if (!queueResult.success) {
        return queueResult
      }
      return { success: true, queueId: queueResult.queueId }
    }

    // Sinon, envoi direct
    let result

    switch (config.provider) {
      case 'resend':
        if (!config.resend_api_key) {
          // Utiliser la clé globale depuis env vars
          const globalApiKey = process.env.RESEND_API_KEY
          if (!globalApiKey) {
            return { success: false, error: 'Clé API Resend non configurée' }
          }
          result = await sendEmailWithResend(globalApiKey, config.from_email, config.from_name, message)
        } else {
          result = await sendEmailWithResend(config.resend_api_key, config.from_email, config.from_name, message)
        }
        break

      case 'smtp':
        result = await sendEmailWithSMTP(config, message)
        break

      case 'gmail_oauth':
      case 'outlook_oauth':
        // OAuth sera implémenté plus tard
        return { success: false, error: 'OAuth Gmail/Outlook non encore implémenté' }

      default:
        return { success: false, error: `Provider ${config.provider} non supporté` }
    }

    return result
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de l\'envoi email' }
  }
}

/**
 * Traiter la queue d'emails (appelé par cron job ou API route)
 */
export async function processEmailQueue(atelierId?: string): Promise<number> {
  const supabase = await createServerClient()

  // Récupérer les emails en attente
  let query = supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  if (atelierId) {
    query = query.eq('atelier_id', atelierId)
  }

  const { data: emails, error } = await query

  if (error || !emails || emails.length === 0) {
    return 0
  }

  let processed = 0

  for (const email of emails) {
    // Marquer comme "sending"
    await updateEmailQueueStatus(email.id, 'sending')

    // Récupérer la config
    const config = await getAtelierEmailConfig(email.atelier_id)
    if (!config) {
      await updateEmailQueueStatus(email.id, 'failed', 'Configuration email non trouvée')
      continue
    }

    // Préparer le message
    const message: EmailMessage = {
      to: email.to_email,
      toName: email.to_name,
      subject: email.subject,
      html: email.html_content,
      text: email.text_content,
      attachments: email.attachments && typeof email.attachments === 'string' 
        ? JSON.parse(email.attachments) 
        : (email.attachments || []),
    }

    // Envoyer
    const result = await sendEmail(email.atelier_id, message, false)

    if (result.success) {
      await updateEmailQueueStatus(email.id, 'sent')
      processed++
    } else {
      await updateEmailQueueStatus(email.id, 'failed', result.error)
    }
  }

  return processed
}
