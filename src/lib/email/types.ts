// Types pour le système d'email

export type EmailProvider = 'resend' | 'smtp' | 'gmail_oauth' | 'outlook_oauth'

export interface EmailConfig {
  provider: EmailProvider
  from_email: string
  from_name: string
  // Resend
  resend_api_key?: string
  // SMTP
  smtp_host?: string
  smtp_port?: number
  smtp_user?: string
  smtp_password?: string
  smtp_secure?: boolean
  // OAuth (tokens stockés séparément dans email_oauth_tokens)
  gmail_oauth?: {
    client_id: string
    client_secret: string
  }
  outlook_oauth?: {
    client_id: string
    client_secret: string
  }
}

export interface EmailAttachment {
  filename: string
  content?: string | Buffer
  url?: string
  contentType?: string
}

export interface EmailMessage {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  replyTo?: string
}

export interface EmailQueueItem {
  id: string
  atelier_id: string
  to_email: string
  to_name?: string
  subject: string
  html_content: string
  text_content?: string
  attachments?: EmailAttachment[]
  status: 'pending' | 'sending' | 'sent' | 'failed'
  error_message?: string
  retry_count: number
  max_retries: number
  sent_at?: string
  created_at: string
}
