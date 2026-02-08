import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateUnsubscribeToken } from '@/lib/email/unsubscribe'

// Cron job pour envoyer les demandes d'avis Google
// Doit être appelé quotidiennement

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Vérifier le secret cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    }

    // Récupérer les ateliers avec avis auto activés
    const { data: ateliers } = await supabase
      .from('ateliers')
      .select('id, name, email, phone, google_review_link, review_delay_days')
      .eq('auto_review_enabled', true)
      .not('google_review_link', 'is', null)

    if (!ateliers || ateliers.length === 0) {
      return NextResponse.json({ 
        message: 'Aucun atelier avec avis auto activé',
        results 
      })
    }

    for (const atelier of ateliers) {
      const delayDays = atelier.review_delay_days || 2
      
      // Calculer la date limite (projets livrés il y a X jours)
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - delayDays)
      const targetDateStr = targetDate.toISOString().split('T')[0]

      // Récupérer les projets livrés ce jour-là
      const { data: projets } = await supabase
        .from('projets')
        .select(`
          id,
          numero,
          name,
          description,
          date_livre,
          client_id,
          clients (
            id,
            full_name,
            email,
            no_marketing
          )
        `)
        .eq('atelier_id', atelier.id)
        .eq('status', 'livre')
        .gte('date_livre', `${targetDateStr}T00:00:00`)
        .lt('date_livre', `${targetDateStr}T23:59:59`)

      if (!projets || projets.length === 0) continue

      for (const projet of projets) {
        results.processed++
        
        const client = projet.clients as any

        // Skip si pas d'email ou marketing désactivé
        if (!client?.email || client.no_marketing) {
          results.skipped++
          continue
        }

        // Vérifier qu'on n'a pas déjà envoyé une demande d'avis pour ce projet
        const { data: existingRequest } = await supabase
          .from('review_requests')
          .select('id')
          .eq('projet_id', projet.id)
          .single()

        if (existingRequest) {
          results.skipped++
          continue
        }

        // Créer la demande d'avis
        const trackingToken = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')
        
        const { error: insertError } = await supabase
          .from('review_requests')
          .insert({
            atelier_id: atelier.id,
            projet_id: projet.id,
            client_id: client.id,
            email: client.email,
            tracking_token: trackingToken,
          })

        if (insertError) {
          results.errors.push(`Erreur insertion review_request: ${insertError.message}`)
          continue
        }

        // Préparer le lien de tracking
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'
        const trackingLink = `${baseUrl}/r/${trackingToken}?to=${encodeURIComponent(atelier.google_review_link)}`

        // Envoyer l'email
        try {
          const clientPrenom = (client.full_name || 'Client').split(' ')[0]
          
          // Ajouter à la file d'emails
          await supabase.from('email_queue').insert({
            atelier_id: atelier.id,
            to_email: client.email,
            to_name: client.full_name,
            subject: `${atelier.name} - Votre avis nous intéresse ⭐`,
            template: 'demande-avis',
            variables: {
              client_prenom: clientPrenom,
              projet_description: projet.description || projet.name || projet.numero,
              lien_avis: trackingLink,
              atelier_nom: atelier.name,
              atelier_phone: atelier.phone,
              lien_desinscription: `${baseUrl}/unsubscribe?token=${generateUnsubscribeToken(client.email, atelier.id)}`,
            },
            priority: 'low',
          })

          results.sent++
        } catch (emailError: any) {
          results.errors.push(`Erreur envoi email à ${client.email}: ${emailError.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Traitement terminé: ${results.sent} demandes envoyées`,
      results,
    })
  } catch (error: any) {
    console.error('Erreur cron Google reviews:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
