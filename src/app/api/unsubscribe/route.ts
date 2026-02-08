import { NextRequest, NextResponse } from 'next/server'
import { decodeUnsubscribeToken, unsubscribeClient } from '@/lib/email/unsubscribe'

/**
 * GET /api/unsubscribe?token=...
 * 
 * Endpoint One-Click Unsubscribe (RFC 8058)
 * Compatible avec le header List-Unsubscribe-Post
 * Désinscrit le client des emails marketing
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const decoded = decodeUnsubscribeToken(token)
  if (!decoded) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const success = await unsubscribeClient(decoded.email, decoded.atelierId)

  if (success) {
    return NextResponse.json({ message: 'Désinscription effectuée' })
  }

  return NextResponse.json({ error: 'Erreur lors de la désinscription' }, { status: 500 })
}

/**
 * POST /api/unsubscribe
 * 
 * Pour le One-Click Unsubscribe via List-Unsubscribe-Post header
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const decoded = decodeUnsubscribeToken(token)
  if (!decoded) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const success = await unsubscribeClient(decoded.email, decoded.atelierId)

  if (success) {
    return NextResponse.json({ message: 'Désinscription effectuée' })
  }

  return NextResponse.json({ error: 'Erreur lors de la désinscription' }, { status: 500 })
}
