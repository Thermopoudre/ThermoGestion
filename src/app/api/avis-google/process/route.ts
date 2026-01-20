import { NextResponse } from 'next/server'
import { processAvisRequests } from '@/lib/google/avis'

// Route pour cron job (Vercel Cron Jobs)
// Appelée quotidiennement pour traiter les demandes d'avis
export async function GET(request: Request) {
  try {
    // Optionnel: vérifier clé secrète pour sécuriser l'endpoint
    // const authHeader = request.headers.get('Authorization')
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const processedCount = await processAvisRequests()

    return NextResponse.json({
      message: `Traitement des demandes d'avis terminé. ${processedCount} email(s) envoyé(s).`,
      processedCount,
    })
  } catch (error: any) {
    console.error('Erreur traitement avis Google:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors du traitement' },
      { status: 500 }
    )
  }
}
