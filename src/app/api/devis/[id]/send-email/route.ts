// API route pour envoyer un devis par email
// Génère le PDF, prépare l'email et l'envoie

import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/sender'
import { generateDevisEmailNewClient, generateDevisEmailExistingClient } from '@/lib/email/templates'
import type { EmailAttachment } from '@/lib/email/types'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'utilisateur et son atelier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Récupérer le devis avec client et atelier
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          type
        ),
        devis_templates (
          id,
          name,
          config
        )
      `)
      .eq('id', params.id)
      .eq('atelier_id', userData.atelier_id)
      .single()

    if (devisError || !devis) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
    }

    if (!devis.clients || !devis.clients.email) {
      return NextResponse.json({ error: 'Client ou email non trouvé' }, { status: 400 })
    }

    // Récupérer l'atelier
    const { data: atelier, error: atelierError } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()

    if (atelierError || !atelier) {
      return NextResponse.json({ error: 'Atelier non trouvé' }, { status: 404 })
    }

    // Récupérer le message personnalisé du body
    const body = await request.json().catch(() => ({}))
    const { messagePersonnalise } = body

    // Générer le PDF (récupérer depuis la route PDF existante)
    const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/app/devis/${params.id}/pdf`
    
    // Pour l'instant, on utilise l'URL du PDF
    // Plus tard, on pourra télécharger le PDF et l'attacher directement
    const attachments: EmailAttachment[] = [
      {
        filename: `Devis_${devis.numero}.pdf`,
        url: pdfUrl,
        contentType: 'application/pdf',
      },
    ]

    // Vérifier si c'est un nouveau client (pas de compte portail)
    // Pour MVP, on considère tous les clients comme "nouveaux" pour l'instant
    // Plus tard, on vérifiera si le client a un compte portail
    const isNewClient = true // TODO: Vérifier si client a un compte portail

    // Générer le contenu HTML de l'email
    const htmlContent = isNewClient
      ? generateDevisEmailNewClient(
          devis,
          devis.clients,
          atelier,
          messagePersonnalise
        )
      : generateDevisEmailExistingClient(
          devis,
          devis.clients,
          atelier,
          messagePersonnalise
        )

    // Générer le texte brut (simplifié)
    const textContent = `
Bonjour ${devis.clients.full_name},

Veuillez trouver ci-joint le devis #${devis.numero} pour un montant de ${Number(devis.total_ttc).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    })} TTC.

Ce devis est valable 30 jours.

${messagePersonnalise ? `\n${messagePersonnalise}\n` : ''}

Cordialement,
${atelier.name}
${atelier.address || ''}
${atelier.phone ? `Tél: ${atelier.phone}` : ''}
${atelier.email ? `Email: ${atelier.email}` : ''}
    `.trim()

    // Envoyer l'email
    const result = await sendEmail(
      userData.atelier_id,
      {
        to: devis.clients.email,
        toName: devis.clients.full_name,
        subject: `Devis #${devis.numero} - ${atelier.name}`,
        html: htmlContent,
        text: textContent,
        attachments,
      },
      true // Utiliser la queue
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Mettre à jour le statut du devis
    await supabase
      .from('devis')
      .update({ status: 'envoye' })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      queueId: result.queueId,
      message: 'Devis envoyé avec succès',
    })
  } catch (error: any) {
    console.error('Erreur envoi devis par email:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'envoi du devis' },
      { status: 500 }
    )
  }
}
