// Utilitaires pour envoi email via Resend
// Resend est un service email moderne, simple et adapté à Vercel Serverless

import { Resend } from 'resend'
import type { EmailMessage, EmailAttachment } from './types'

// Initialiser Resend avec la clé API (sera dans env vars)
let resendInstance: Resend | null = null

export function getResendClient(apiKey: string): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

export async function sendEmailWithResend(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  message: EmailMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resend = getResendClient(apiKey)

    // Convertir les attachments
    // Resend supporte les URLs directement pour les attachments
    const attachments = message.attachments?.map((att) => {
      if (att.url) {
        // Resend peut utiliser des URLs publiques
        return {
          filename: att.filename,
          url: att.url,
        }
      }
      if (att.content) {
        return {
          filename: att.filename,
          content: typeof att.content === 'string' ? Buffer.from(att.content) : att.content,
          contentType: att.contentType,
        }
      }
      return undefined
    }).filter(Boolean) as Array<{ filename: string; content?: Buffer; url?: string; contentType?: string }> | undefined

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: message.toName ? `${message.toName} <${message.to}>` : message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: attachments?.length ? attachments : undefined,
      reply_to: message.replyTo,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de l\'envoi email' }
  }
}
