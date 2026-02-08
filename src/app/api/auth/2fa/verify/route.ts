import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyTOTPCode, generateBackupCodes } from '@/lib/security/totp'

/**
 * POST /api/auth/2fa/verify
 * 
 * Vérifie un code TOTP pour :
 * 1. Confirmer l'activation de la 2FA (setup)
 * 2. Valider la connexion après login (challenge)
 */
export async function POST(request: NextRequest) {
  try {
    const { code, action } = await request.json()

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json(
        { error: 'Code invalide. Entrez les 6 chiffres affichés par votre application.' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le secret 2FA
    const { data: userData } = await supabase
      .from('users')
      .select('two_factor_secret, two_factor_enabled, backup_codes')
      .eq('id', user.id)
      .single()

    if (!userData?.two_factor_secret) {
      return NextResponse.json(
        { error: '2FA non configurée. Lancez d\'abord la configuration.' },
        { status: 400 }
      )
    }

    // Vérifier le code TOTP
    const isValid = verifyTOTPCode(code, userData.two_factor_secret)

    if (!isValid) {
      // Vérifier les codes de secours
      if (userData.backup_codes && Array.isArray(userData.backup_codes)) {
        const backupIndex = userData.backup_codes.indexOf(code)
        if (backupIndex !== -1) {
          // Code de secours valide — le marquer comme utilisé
          const updatedCodes = [...userData.backup_codes]
          updatedCodes.splice(backupIndex, 1)
          await supabase
            .from('users')
            .update({ backup_codes: updatedCodes })
            .eq('id', user.id)

          return NextResponse.json({
            verified: true,
            isBackupCode: true,
            remainingBackupCodes: updatedCodes.length,
          })
        }
      }

      return NextResponse.json(
        { error: 'Code incorrect. Vérifiez votre application d\'authentification.' },
        { status: 400 }
      )
    }

    // Si c'est la confirmation d'activation (setup)
    if (action === 'setup' && !userData.two_factor_enabled) {
      const backupCodes = generateBackupCodes()

      await supabase
        .from('users')
        .update({
          two_factor_enabled: true,
          backup_codes: backupCodes,
        })
        .eq('id', user.id)

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: '2fa_enabled',
        entity_type: 'user',
        entity_id: user.id,
        details: { method: 'totp' },
      }).catch(() => {})

      return NextResponse.json({
        verified: true,
        activated: true,
        backupCodes,
        message: 'Authentification à deux facteurs activée avec succès. Conservez vos codes de secours en lieu sûr.',
      })
    }

    // Connexion normale avec 2FA
    return NextResponse.json({ verified: true })
  } catch (error: any) {
    console.error('Erreur 2FA verify:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
