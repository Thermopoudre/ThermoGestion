/**
 * API Route: Réception devis public automatique
 * Crée un prospect CRM + notifie l'atelier
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function escapeHtml(str: string | undefined | null): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nom, email, telephone, entreprise, type_piece, quantite, surface_m2, finition, couleur_ral, urgence, estimation, message, surface_estimee } = body

    if (!nom || !email || !type_piece) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Enregistrer la demande de devis
    const { error } = await supabase.from('client_messages').insert({
      type: 'devis_public',
      sender_name: nom,
      sender_email: email,
      subject: `Demande devis: ${type_piece} x${quantite}`,
      message: JSON.stringify({
        type_piece,
        quantite,
        surface_m2: surface_m2 || surface_estimee,
        finition,
        couleur_ral,
        urgence,
        estimation,
        entreprise,
        telephone,
        message,
      }, null, 2),
      status: 'unread',
    })

    if (error) throw error

    // Envoyer notification par email si Resend configuré
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'ThermoGestion <noreply@thermogestion.fr>',
            to: [process.env.ADMIN_EMAIL || 'admin@thermogestion.fr'],
            subject: `[Devis public] ${nom} - ${type_piece} x${quantite}`,
            html: `
              <h2>Nouvelle demande de devis public</h2>
              <p><strong>Nom:</strong> ${escapeHtml(nom)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              ${telephone ? `<p><strong>Téléphone:</strong> ${escapeHtml(telephone)}</p>` : ''}
              ${entreprise ? `<p><strong>Entreprise:</strong> ${escapeHtml(entreprise)}</p>` : ''}
              <hr>
              <p><strong>Type de pièce:</strong> ${escapeHtml(type_piece)}</p>
              <p><strong>Quantité:</strong> ${escapeHtml(String(quantite))}</p>
              <p><strong>Surface estimée:</strong> ${escapeHtml(String(surface_m2 || surface_estimee))} m²</p>
              <p><strong>Finition:</strong> ${escapeHtml(finition)}</p>
              ${couleur_ral ? `<p><strong>RAL:</strong> ${escapeHtml(couleur_ral)}</p>` : ''}
              ${urgence ? `<p style="color:red;"><strong>URGENCE</strong></p>` : ''}
              <p><strong>Estimation auto:</strong> ${escapeHtml(String(estimation))} € HT</p>
              ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
            `,
          }),
        })
      } catch (emailError) {
        console.error('Email notification error:', emailError)
      }
    }

    return NextResponse.json({ success: true, estimation })

  } catch (error: any) {
    console.error('Devis public error:', error)
    return NextResponse.json({ error: 'Erreur lors de la soumission du devis' }, { status: 500 })
  }
}
