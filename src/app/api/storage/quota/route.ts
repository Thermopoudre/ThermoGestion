/**
 * API Route: Gestion quotas storage par atelier
 * 
 * GET: Récupérer usage + quota
 * POST: Vérifier si upload autorisé
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('storage_quota_gb, storage_used_bytes')
      .eq('id', userData.atelier_id)
      .single()

    if (!atelier) return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })

    const quotaBytes = (atelier.storage_quota_gb || 20) * 1024 * 1024 * 1024
    const usedBytes = atelier.storage_used_bytes || 0
    const usedPct = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0

    return NextResponse.json({
      quota_gb: atelier.storage_quota_gb || 20,
      used_bytes: usedBytes,
      used_gb: (usedBytes / (1024 * 1024 * 1024)).toFixed(2),
      used_pct: usedPct.toFixed(1),
      remaining_bytes: Math.max(0, quotaBytes - usedBytes),
      remaining_gb: (Math.max(0, quotaBytes - usedBytes) / (1024 * 1024 * 1024)).toFixed(2),
      alerts: {
        warning_80: usedPct >= 80,
        critical_90: usedPct >= 90,
        full: usedPct >= 100,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  try {
    const { file_size_bytes } = await request.json()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('storage_quota_gb, storage_used_bytes')
      .eq('id', userData.atelier_id)
      .single()

    if (!atelier) return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })

    const quotaBytes = (atelier.storage_quota_gb || 20) * 1024 * 1024 * 1024
    const usedBytes = atelier.storage_used_bytes || 0
    const newUsed = usedBytes + (file_size_bytes || 0)

    if (newUsed > quotaBytes) {
      return NextResponse.json({
        allowed: false,
        reason: 'Quota de stockage dépassé',
        used_pct: ((usedBytes / quotaBytes) * 100).toFixed(1),
      }, { status: 403 })
    }

    // Mettre à jour l'usage
    await supabase
      .from('ateliers')
      .update({ storage_used_bytes: newUsed })
      .eq('id', userData.atelier_id)

    return NextResponse.json({ allowed: true, new_used_bytes: newUsed })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
