// Utilitaires pour envoi email via SMTP classique
// Utilise nodemailer pour compatibilité SMTP standard

import * as nodemailer from 'nodemailer'
import type { EmailMessage, EmailConfig } from './types'

export async function sendEmailWithSMTP(
  config: EmailConfig,
  message: EmailMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!config.smtp_host || !config.smtp_user || !config.smtp_password) {
      return { success: false, error: 'Configuration SMTP incomplète' }
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_secure || false, // true pour 465, false pour autres ports
      auth: {
        user: config.smtp_user,
        pass: config.smtp_password,
      },
    })

    // Convertir les attachments
    const attachments = message.attachments?.map((att) => {
      if (att.url) {
        return {
          filename: att.filename,
          path: att.url, // nodemailer peut utiliser une URL
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
    }).filter(Boolean)

    const info = await transporter.sendMail({
      from: `${config.from_name} <${config.from_email}>`,
      to: message.toName ? `${message.toName} <${message.to}>` : message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: attachments?.length ? attachments : undefined,
      replyTo: message.replyTo,
    })

    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de l\'envoi email SMTP' }
  }
}
