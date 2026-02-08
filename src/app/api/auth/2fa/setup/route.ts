import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateTOTPSecret, generateTOTPUri } from '@/lib/security/totp'

/**
 * POST /api/auth/2fa/setup
 * 
 * Initie la configuration 2FA pour l'utilisateur connecté.
 * Retourne le secret + l'URI pour le QR Code.
 * Le secret n'est PAS encore enregistré en base (il le sera après vérification).
 */
export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que la 2FA n'est pas déjà activée
    const { data: userData } = await supabase
      .from('users')
      .select('two_factor_enabled')
      .eq('id', user.id)
      .single()

    if (userData?.two_factor_enabled) {
      return NextResponse.json(
        { error: '2FA déjà activée. Désactivez-la d\'abord pour la reconfigurer.' },
        { status: 400 }
      )
    }

    // Générer un nouveau secret
    const secret = generateTOTPSecret()
    const otpauthUri = generateTOTPUri(secret, user.email || user.id)

    // Stocker le secret temporairement (pas encore validé)
    // On le stocke dans two_factor_secret mais two_factor_enabled reste false
    await supabase
      .from('users')
      .update({ two_factor_secret: secret })
      .eq('id', user.id)

    // Ne retourner que l'URI otpauth (pour le QR Code), pas le secret brut
    // Le secret est déjà stocké en base pour vérification ultérieure
    return NextResponse.json({
      otpauthUri,
      message: 'Scannez le QR Code avec votre application d\'authentification, puis entrez le code pour confirmer.',
    })
  } catch (error: any) {
    console.error('Erreur 2FA setup:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
