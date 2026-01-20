// API route pour envoyer un email
// Utilise la queue ou envoi direct selon la configuration

import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/sender'
import type { EmailMessage } from '@/lib/email/types'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'atelier de l'utilisateur
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const body = await request.json()
    const { to, toName, subject, html, text, attachments, useQueue = true } = body

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Paramètres manquants: to, subject, html requis' },
        { status: 400 }
      )
    }

    const message: EmailMessage = {
      to,
      toName,
      subject,
      html,
      text,
      attachments,
    }

    const result = await sendEmail(userData.atelier_id, message, useQueue)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      queueId: result.queueId,
    })
  } catch (error: any) {
    console.error('Erreur envoi email:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'envoi email' },
      { status: 500 }
    )
  }
}
