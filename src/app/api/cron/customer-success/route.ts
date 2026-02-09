import { NextResponse } from 'next/server'
import { checkInactiveUsers } from '@/lib/customer-success/automation'

/**
 * Cron job Customer Success
 * Exécuté quotidiennement à 9h00
 * - Détecte les utilisateurs inactifs
 * - Envoie des emails de réengagement
 * - Envoie des rappels trial
 */
export async function GET() {
  try {
    const stats = await checkInactiveUsers()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
    console.error('[CRON] Customer success error:', error)
    return NextResponse.json(
      { error: 'Erreur cron customer success' },
      { status: 500 }
    )
  }
}
