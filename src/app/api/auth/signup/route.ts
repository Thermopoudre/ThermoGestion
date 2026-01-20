import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, atelierName } = body

    if (!email || !password || !atelierName) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom d\'atelier requis' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Créer l'utilisateur auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verification-email`,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'utilisateur' },
        { status: 500 }
      )
    }

      // 2. Créer l'atelier
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 30) // Essai gratuit 30 jours

      const { data: atelier, error: atelierError } = await supabase
        .from('ateliers')
        .insert({
          name: atelierName,
          email,
          plan: 'pro', // Mode Pro complet pour l'essai gratuit
          trial_ends_at: trialEndsAt.toISOString(),
          storage_quota_gb: 20,
          storage_used_gb: 0,
          settings: {},
        })
        .select()
        .single()

      if (atelierError) {
        // Si erreur création atelier, ne pas supprimer l'utilisateur auth car on n'a pas accès admin ici
        // Le nettoyage devra être fait manuellement si nécessaire
        console.error('Erreur création atelier:', atelierError)
        return NextResponse.json(
          { error: `Erreur lors de la création de l'atelier: ${atelierError.message}` },
          { status: 500 }
        )
      }

    // 3. Créer l'utilisateur dans la table users
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        atelier_id: atelier.id,
        email,
        role: 'owner', // Premier utilisateur = owner
        full_name: null,
      })

    if (userError) {
      // Si erreur création user, nettoyer l'atelier
      await supabase.from('ateliers').delete().eq('id', atelier.id)
      // Note: On ne peut pas supprimer l'utilisateur auth sans service role key
      // Il faudra le faire manuellement si nécessaire
      console.error('Erreur création user:', userError)
      return NextResponse.json(
        { error: `Erreur lors de la création de l'utilisateur: ${userError.message}` },
        { status: 500 }
      )
    }

    // 4. Journal d'audit
    await supabase.from('audit_logs').insert({
      atelier_id: atelier.id,
      user_id: authData.user.id,
      action: 'create',
      table_name: 'ateliers',
      record_id: atelier.id,
      new_data: { name: atelierName, email, plan: 'pro' },
    })

    return NextResponse.json({
      success: true,
      message: 'Compte créé avec succès. Vérifiez votre email pour confirmer.',
      user: authData.user,
      atelier,
    })
  } catch (error: any) {
    console.error('Erreur inscription:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
