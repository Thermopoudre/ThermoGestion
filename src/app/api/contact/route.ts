import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { ContactFormSchema, validateBody, escapeHtml } from '@/lib/validations'

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'contact@thermogestion.fr'

// Simple rate limiting (in-memory, per serverless instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5 // max 5 requests
const RATE_WINDOW = 60 * 60 * 1000 // per hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Trop de messages envoyés. Réessayez dans 1 heure.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Validation Zod
    const validation = validateBody(ContactFormSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.errors },
        { status: 400 }
      )
    }

    const { name, email, phone, company, subject, message } = validation.data

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('RESEND_API_KEY non configurée')
      return NextResponse.json(
        { error: 'Service email temporairement indisponible.' },
        { status: 503 }
      )
    }

    const resend = new Resend(apiKey)

    // HTML-escape all user inputs to prevent XSS
    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safePhone = phone ? escapeHtml(phone) : null
    const safeCompany = company ? escapeHtml(company) : null
    const safeSubject = subject ? escapeHtml(subject) : null
    const safeMessage = escapeHtml(message)

    // Send both emails in parallel
    await Promise.all([
      // 1. Notification to ThermoGestion team
      resend.emails.send({
        from: 'ThermoGestion <noreply@thermogestion.fr>',
        to: CONTACT_EMAIL,
        replyTo: email,
        subject: `[Contact] ${safeSubject || 'Nouvelle demande'} — ${safeName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 20px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Nouveau message de contact</h1>
            </div>
            <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280; width: 120px;">Nom</td><td style="padding: 8px 0; font-weight: bold;">${safeName}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
                ${safePhone ? `<tr><td style="padding: 8px 0; color: #6b7280;">Téléphone</td><td style="padding: 8px 0;">${safePhone}</td></tr>` : ''}
                ${safeCompany ? `<tr><td style="padding: 8px 0; color: #6b7280;">Entreprise</td><td style="padding: 8px 0;">${safeCompany}</td></tr>` : ''}
                ${safeSubject ? `<tr><td style="padding: 8px 0; color: #6b7280;">Sujet</td><td style="padding: 8px 0;">${safeSubject}</td></tr>` : ''}
              </table>
              <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #f97316;">
                <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
              </div>
            </div>
          </div>
        `,
      }),
      // 2. Acknowledgment to visitor
      resend.emails.send({
        from: 'ThermoGestion <noreply@thermogestion.fr>',
        to: email,
        subject: 'Nous avons bien reçu votre message — ThermoGestion',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">ThermoGestion</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Bonjour ${safeName},</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                Nous avons bien reçu votre message et nous vous en remercions. Notre équipe reviendra vers vous dans les <strong>24 heures ouvrées</strong>.
              </p>
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                ThermoGestion — Gestion professionnelle pour ateliers de thermolaquage
              </p>
            </div>
          </div>
        `,
      }),
    ])

    return NextResponse.json({ success: true, message: 'Message envoyé avec succès.' })
  } catch (error: unknown) {
    console.error('Erreur formulaire contact:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
