import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyTOTPCode } from '@/lib/security/totp'

/**
 * POST /api/auth/2fa/disable
 * 
 * Désactive la 2FA pour l'utilisateur connecté.
 * Nécessite un code TOTP valide pour confirmer.
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le secret 2FA
    const { data: userData } = await supabase
      .from('users')
      .select('two_factor_secret, two_factor_enabled')
      .eq('id', user.id)
      .single()

    if (!userData?.two_factor_enabled || !userData?.two_factor_secret) {
      return NextResponse.json({ error: '2FA non activée' }, { status: 400 })
    }

    // Vérifier le code
    const isValid = verifyTOTPCode(code, userData.two_factor_secret)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Code incorrect' },
        { status: 400 }
      )
    }

    // Désactiver la 2FA
    await supabase
      .from('users')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        backup_codes: null,
      })
      .eq('id', user.id)

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: '2fa_disabled',
      entity_type: 'user',
      entity_id: user.id,
      details: { method: 'totp' },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'Authentification à deux facteurs désactivée.',
    })
  } catch (error: any) {
    console.error('Erreur 2FA disable:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
