// Utilitaires pour gérer la queue d'envoi emails
// Alternative simple à Bull+Redis pour Vercel Serverless

import { createServerClient } from '@/lib/supabase/server'
import type { EmailMessage, EmailQueueItem } from './types'

/**
 * Ajouter un email à la queue
 */
export async function addEmailToQueue(
  atelierId: string,
  message: EmailMessage
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('email_queue')
      .insert({
        atelier_id: atelierId,
        to_email: message.to,
        to_name: message.toName,
        subject: message.subject,
        html_content: message.html,
        text_content: message.text,
        attachments: message.attachments ? JSON.stringify(message.attachments) : null,
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
      })
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, queueId: data.id }
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de l\'ajout à la queue' }
  }
}

/**
 * Récupérer les emails en attente
 */
export async function getPendingEmails(
  atelierId?: string,
  limit: number = 10
): Promise<EmailQueueItem[]> {
  const supabase = await createServerClient()

  let query = supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (atelierId) {
    query = query.eq('atelier_id', atelierId)
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return data.map((item) => ({
    id: item.id,
    atelier_id: item.atelier_id,
    to_email: item.to_email,
    to_name: item.to_name,
    subject: item.subject,
    html_content: item.html_content,
    text_content: item.text_content,
    attachments: item.attachments ? JSON.parse(item.attachments) : [],
    status: item.status,
    error_message: item.error_message,
    retry_count: item.retry_count,
    max_retries: item.max_retries,
    sent_at: item.sent_at,
    created_at: item.created_at,
  }))
}

/**
 * Mettre à jour le statut d'un email dans la queue
 */
export async function updateEmailQueueStatus(
  queueId: string,
  status: 'sending' | 'sent' | 'failed',
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    }

    if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage
      // Incrémenter retry_count
      const { data: current } = await supabase
        .from('email_queue')
        .select('retry_count')
        .eq('id', queueId)
        .single()

      if (current) {
        updateData.retry_count = (current.retry_count || 0) + 1
      }
    }

    const { error } = await supabase
      .from('email_queue')
      .update(updateData)
      .eq('id', queueId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de la mise à jour' }
  }
}
