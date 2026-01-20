// API route pour traiter la queue d'emails
// Peut être appelée par un cron job (Vercel Cron) ou manuellement

import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { processEmailQueue } from '@/lib/email/sender'

export async function POST(request: Request) {
  try {
    // Vérifier la clé secrète pour sécuriser l'endpoint (optionnel)
    const authHeader = request.headers.get('authorization')
    const secretKey = process.env.EMAIL_QUEUE_SECRET_KEY

    if (secretKey && authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { atelierId } = body

    const processed = await processEmailQueue(atelierId)

    return NextResponse.json({
      success: true,
      processed,
      message: `${processed} email(s) traité(s)`,
    })
  } catch (error: any) {
    console.error('Erreur traitement queue email:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors du traitement de la queue' },
      { status: 500 }
    )
  }
}
