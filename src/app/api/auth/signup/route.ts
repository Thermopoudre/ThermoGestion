import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { sanitizeHtml, validateInput } from '@/lib/utils'
import { authLimiter, getClientIP } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limiting (serverless-compatible via Supabase)
    const ip = getClientIP(request)
    const rateLimitResult = await authLimiter.check(ip)
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, password, atelierName } = body

    if (!email || !password || !atelierName) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom d\'atelier requis' },
        { status: 400 }
      )
    }

    // Validation et sanitization des entrées
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      )
    }

    const nameValidation = validateInput(atelierName, {
      required: true,
      minLength: 2,
      maxLength: 100,
    })
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: `Nom d'atelier invalide : ${nameValidation.error}` },
        { status: 400 }
      )
    }

    const sanitizedAtelierName = sanitizeHtml(atelierName.trim())

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
        name: sanitizedAtelierName,
        email: email.trim().toLowerCase(),
        plan: 'pro', // Mode Pro complet pour l'essai gratuit
        trial_ends_at: trialEndsAt.toISOString(),
        storage_quota_gb: 20,
        storage_used_gb: 0,
        settings: {},
      })
      .select()
      .single()

    if (atelierError) {
      // Rollback : supprimer l'utilisateur auth avec le service role
      console.error('Erreur création atelier:', atelierError)
      try {
        await supabase.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error('Erreur rollback auth user:', deleteError)
      }
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'atelier. Veuillez réessayer.' },
        { status: 500 }
      )
    }

    // 3. Créer l'utilisateur dans la table users
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        atelier_id: atelier.id,
        email: email.trim().toLowerCase(),
        role: 'owner', // Premier utilisateur = owner
        full_name: null,
      })

    if (userError) {
      // Rollback complet : supprimer atelier + auth user
      console.error('Erreur création user:', userError)
      try {
        await supabase.from('ateliers').delete().eq('id', atelier.id)
        await supabase.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error('Erreur rollback:', deleteError)
      }
      return NextResponse.json(
        { error: 'Erreur lors de la création du compte. Veuillez réessayer.' },
        { status: 500 }
      )
    }

    // 4. Journal d'audit
    try {
      await supabase.from('audit_logs').insert({
        atelier_id: atelier.id,
        user_id: authData.user.id,
        action: 'create',
        table_name: 'ateliers',
        record_id: atelier.id,
        new_data: { name: sanitizedAtelierName, email: email.trim().toLowerCase(), plan: 'pro' },
      })
    } catch (auditError) {
      // L'audit log ne doit pas bloquer l'inscription
      console.error('Erreur audit log (non bloquant):', auditError)
    }

    // 5. Email de bienvenue (non-bloquant)
    try {
      const { Resend } = await import('resend')
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const { readFileSync } = await import('fs')
        const { join } = await import('path')
        let template = ''
        try {
          template = readFileSync(join(process.cwd(), 'src/templates/email/bienvenue.html'), 'utf-8')
        } catch { /* template non trouvé */ }

        if (template) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'
          const html = template
            .replace(/\{\{ATELIER_NAME\}\}/g, sanitizedAtelierName)
            .replace(/\{\{APP_URL\}\}/g, appUrl)

          const resend = new Resend(resendKey)
          await resend.emails.send({
            from: 'ThermoGestion <noreply@thermogestion.fr>',
            to: email.trim().toLowerCase(),
            subject: 'Bienvenue sur ThermoGestion — Votre essai de 30 jours est activé !',
            html,
          })
        }
      }
    } catch (emailError) {
      console.error('Erreur email bienvenue (non bloquant):', emailError)
    }

    return NextResponse.json({
      success: true,
      message: 'Compte créé avec succès. Vérifiez votre email pour confirmer.',
      user: { id: authData.user.id, email: authData.user.email },
      atelier: { id: atelier.id, name: atelier.name },
    })
  } catch (error: unknown) {
    console.error('Erreur inscription:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
