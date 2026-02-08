import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// API pour mise à jour du statut via scan QR
// Sécurisé par authentification utilisateur + vérification atelier_id

const VALID_STATUSES = [
  'en_attente',
  'en_preparation', 
  'en_traitement',
  'sechage',
  'controle_qualite',
  'pret',
  'livre'
]

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_preparation: 'En préparation',
  en_traitement: 'En traitement',
  sechage: 'Séchage',
  controle_qualite: 'Contrôle qualité',
  pret: 'Prêt à récupérer',
  livre: 'Livré',
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status: newStatus, notifyClient } = await request.json()

    if (!newStatus) {
      return NextResponse.json({ error: 'Statut requis' }, { status: 400 })
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'atelier_id de l'utilisateur
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      return NextResponse.json({ error: 'Utilisateur non rattaché à un atelier' }, { status: 403 })
    }

    // Récupérer le projet
    const { data: projet, error: projetError } = await supabase
      .from('projets')
      .select(`
        id,
        numero,
        status,
        atelier_id,
        client_id,
        public_token,
        clients (
          id,
          full_name,
          email
        ),
        ateliers (
          id,
          name,
          email
        )
      `)
      .eq('id', params.id)
      .single()

    if (projetError || !projet) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    }

    // Vérifier que le projet appartient à l'atelier de l'utilisateur (protection IDOR)
    if (projet.atelier_id !== userData.atelier_id) {
      return NextResponse.json({ error: 'Accès non autorisé à ce projet' }, { status: 403 })
    }

    const oldStatus = projet.status

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from('projets')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Erreur mise à jour statut:', updateError)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    // Créer une alerte pour l'atelier
    await supabase.from('alertes').insert({
      atelier_id: projet.atelier_id,
      type: 'projet_status',
      titre: `Projet ${projet.numero} - ${STATUS_LABELS[newStatus]}`,
      message: `Le statut du projet a été mis à jour via scan QR.`,
      lien: `/app/projets/${projet.id}`,
      data: { 
        projet_id: projet.id, 
        old_status: oldStatus,
        new_status: newStatus,
        via: 'qr_scan'
      },
    })

    // Notifier le client si demandé et si on a son email
    if (notifyClient && (projet.clients as any)?.email) {
      const client = projet.clients as any
      const atelier = projet.ateliers as any

      // Créer une alerte client (sera envoyée par email via le système existant)
      // Pour les statuts importants, envoyer un email
      if (['pret', 'livre'].includes(newStatus)) {
        try {
          // Envoyer l'email de notification
          const emailSubject = newStatus === 'pret' 
            ? `Votre projet est prêt ! - ${atelier?.name}`
            : `Projet livré - ${atelier?.name}`

          const emailBody = newStatus === 'pret'
            ? `Bonjour ${client.full_name},\n\nVotre projet ${projet.numero} est maintenant prêt à être récupéré.\n\nCordialement,\n${atelier?.name}`
            : `Bonjour ${client.full_name},\n\nVotre projet ${projet.numero} a été livré.\n\nMerci de votre confiance !\n${atelier?.name}`

          // On pourrait utiliser le système d'email existant ici
          // Pour l'instant, on crée juste l'alerte
          console.log(`Email à envoyer à ${client.email}: ${emailSubject}`)
        } catch (emailError) {
          console.error('Erreur envoi email notification:', emailError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Statut mis à jour',
      oldStatus,
      newStatus,
    })

  } catch (error: unknown) {
    console.error('Erreur scan mise à jour statut:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
