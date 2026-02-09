import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'contact@thermogestion.fr'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, company, subject, message } = body

    // Validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Nom, email et message sont requis.' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('RESEND_API_KEY non configurée')
      return NextResponse.json(
        { error: 'Service email temporairement indisponible.' },
        { status: 503 }
      )
    }

    const resend = new Resend(apiKey)

    // 1. Envoyer la notification à l'équipe ThermoGestion
    await resend.emails.send({
      from: 'ThermoGestion <noreply@thermogestion.fr>',
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[Contact] ${subject || 'Nouvelle demande'} — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Nouveau message de contact</h1>
          </div>
          <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">Nom</td><td style="padding: 8px 0; font-weight: bold;">${name}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
              ${phone ? `<tr><td style="padding: 8px 0; color: #6b7280;">Téléphone</td><td style="padding: 8px 0;">${phone}</td></tr>` : ''}
              ${company ? `<tr><td style="padding: 8px 0; color: #6b7280;">Entreprise</td><td style="padding: 8px 0;">${company}</td></tr>` : ''}
              ${subject ? `<tr><td style="padding: 8px 0; color: #6b7280;">Sujet</td><td style="padding: 8px 0;">${subject}</td></tr>` : ''}
            </table>
            <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #f97316;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        </div>
      `,
    })

    // 2. Envoyer un accusé de réception au visiteur
    await resend.emails.send({
      from: 'ThermoGestion <noreply@thermogestion.fr>',
      to: email,
      subject: 'Nous avons bien reçu votre message — ThermoGestion',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">ThermoGestion</h1>
          </div>
          <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${name},</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Nous avons bien reçu votre message et nous vous en remercions. Notre équipe reviendra vers vous dans les <strong>24 heures ouvrées</strong>.
            </p>
            <p style="color: #4b5563; line-height: 1.6;">
              En attendant, n'hésitez pas à découvrir nos fonctionnalités ou à démarrer un essai gratuit de 30 jours.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://thermogestion.vercel.app/auth/inscription" 
                 style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #f97316, #dc2626); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Essai gratuit 30 jours
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              ThermoGestion — Gestion professionnelle pour ateliers de thermolaquage
            </p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true, message: 'Message envoyé avec succès.' })
  } catch (error: any) {
    console.error('Erreur formulaire contact:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
