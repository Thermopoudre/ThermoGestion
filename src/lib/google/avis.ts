// Utilitaires pour gestion avis Google My Business

import { createServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/sender'
import type { Database } from '@/types/database.types'

type Projet = Database['public']['Tables']['projets']['Row']
type Client = Database['public']['Tables']['clients']['Row']
type Atelier = Database['public']['Tables']['ateliers']['Row']

/**
 * Créer une demande d'avis pour un projet
 */
export async function createAvisRequest(
  atelierId: string,
  projetId: string,
  clientId: string
): Promise<{ success: boolean; avisId?: string; error?: string }> {
  const supabase = await createServerClient()

  // Vérifier si demande existe déjà
  const { data: existing } = await supabase
    .from('avis_google')
    .select('id')
    .eq('projet_id', projetId)
    .single()

  if (existing) {
    return { success: false, error: 'Demande d\'avis déjà existante' }
  }

  // Créer la demande
  const { data: avis, error } = await supabase
    .from('avis_google')
    .insert({
      atelier_id: atelierId,
      projet_id: projetId,
      client_id: clientId,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, avisId: avis.id }
}

/**
 * Envoyer l'email de demande d'avis (J+X)
 */
export async function sendAvisEmail(
  atelierId: string,
  projetId: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  // Récupérer projet, client, atelier
  const { data: projet } = await supabase
    .from('projets')
    .select('*')
    .eq('id', projetId)
    .single()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  const { data: atelier } = await supabase
    .from('ateliers')
    .select('*')
    .eq('id', atelierId)
    .single()

  if (!projet || !client || !atelier) {
    return { success: false, error: 'Données non trouvées' }
  }

  if (!client.email) {
    return { success: false, error: 'Email client non disponible' }
  }

  // Vérifier si avis activé pour cet atelier
  if (!atelier.avis_google_enabled) {
    return { success: false, error: 'Avis Google désactivé pour cet atelier' }
  }

  // Générer le lien Google My Business
  const googleMapsUrl = atelier.avis_google_location_id
    ? `https://search.google.com/local/writereview?placeid=${atelier.avis_google_location_id}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(atelier.address || atelier.name)}`

  // Template email demande avis
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Votre avis nous intéresse</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9fafb; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 20px; font-size: 0.8em; color: #777; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>ThermoGestion</h2>
      <h1>Votre avis nous intéresse !</h1>
    </div>
    <div class="content">
      <p>Bonjour ${client.full_name},</p>
      <p>Nous espérons que vous êtes satisfait(e) de votre projet <strong>${projet.name}</strong> (${projet.numero}).</p>
      <p>Votre avis est très important pour nous ! Il nous aide à améliorer nos services et permet à d'autres clients de nous découvrir.</p>
      <p style="text-align: center;">
        <a href="${googleMapsUrl}" class="button">Laisser un avis sur Google</a>
      </p>
      <p>Merci de prendre quelques instants pour partager votre expérience.</p>
      <p>Cordialement,</p>
      <p>L'équipe de ${atelier.name}</p>
    </div>
    <div class="footer">
      <p>${atelier.name} - ${atelier.address || ''}</p>
    </div>
  </div>
</body>
</html>
  `

  // Envoyer l'email
  const emailResult = await sendEmail(atelierId, {
    to: client.email,
    toName: client.full_name,
    subject: `Votre avis nous intéresse - ${atelier.name}`,
    html: emailHtml,
  })

  if (!emailResult.success) {
    return { success: false, error: emailResult.error || 'Erreur envoi email' }
  }

  // Mettre à jour la demande d'avis
  await supabase
    .from('avis_google')
    .update({
      email_sent_at: new Date().toISOString(),
      status: 'email_sent',
    })
    .eq('projet_id', projetId)
    .eq('atelier_id', atelierId)

  return { success: true }
}

/**
 * Traiter les projets prêts pour demande avis (cron job)
 */
export async function processAvisRequests(atelierId?: string): Promise<number> {
  const supabase = await createServerClient()

  let query = supabase.rpc('get_projets_ready_for_avis', {
    p_atelier_id: atelierId || '',
    p_delay_days: 3, // J+3 par défaut
  })

  if (atelierId) {
    // Récupérer config atelier
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('avis_google_enabled, avis_google_delay_days')
      .eq('id', atelierId)
      .single()

    if (!atelier || !atelier.avis_google_enabled) {
      return 0
    }

    query = supabase.rpc('get_projets_ready_for_avis', {
      p_atelier_id: atelierId,
      p_delay_days: atelier.avis_google_delay_days || 3,
    })
  } else {
    // Traiter tous les ateliers
    const { data: ateliers } = await supabase
      .from('ateliers')
      .select('id, avis_google_enabled, avis_google_delay_days')
      .eq('avis_google_enabled', true)

    if (!ateliers || ateliers.length === 0) {
      return 0
    }

    let totalProcessed = 0
    for (const atelier of ateliers) {
      const { data: projets } = await supabase.rpc('get_projets_ready_for_avis', {
        p_atelier_id: atelier.id,
        p_delay_days: atelier.avis_google_delay_days || 3,
      })

      for (const projet of projets || []) {
        await createAvisRequest(atelier.id, projet.projet_id, projet.client_id)
        await sendAvisEmail(atelier.id, projet.projet_id, projet.client_id)
        totalProcessed++
      }
    }

    return totalProcessed
  }

  const { data: projets, error } = await query

  if (error || !projets || projets.length === 0) {
    return 0
  }

  let processed = 0
  for (const projet of projets) {
    await createAvisRequest(atelierId!, projet.projet_id, projet.client_id)
    await sendAvisEmail(atelierId!, projet.projet_id, projet.client_id)
    processed++
  }

  return processed
}
