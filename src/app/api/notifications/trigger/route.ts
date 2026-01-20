import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  notifyNewProjet,
  notifyDevisSigned,
  notifyRetoucheDeclared,
  notifyFacturePaid,
  notifyProjetStatusChange,
} from '@/lib/notifications/triggers'

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { type, atelier_id, ...data } = body

    // Vérifier que l'utilisateur appartient à l'atelier
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.atelier_id !== atelier_id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    switch (type) {
      case 'new_projet': {
        const { data: projet } = await supabase
          .from('projets')
          .select('*')
          .eq('id', data.projet_id)
          .single()
        if (projet) {
          await notifyNewProjet(atelier_id, projet)
        }
        break
      }

      case 'devis_signed': {
        const { data: devis } = await supabase
          .from('devis')
          .select('*')
          .eq('id', data.devis_id)
          .single()
        if (devis) {
          await notifyDevisSigned(atelier_id, devis)
        }
        break
      }

      case 'retouche_declared': {
        const { data: retouche } = await supabase
          .from('retouches')
          .select('*')
          .eq('id', data.retouche_id)
          .single()
        if (retouche) {
          await notifyRetoucheDeclared(atelier_id, retouche, data.projet_name)
        }
        break
      }

      case 'facture_paid': {
        const { data: facture } = await supabase
          .from('factures')
          .select('*')
          .eq('id', data.facture_id)
          .single()
        if (facture) {
          await notifyFacturePaid(atelier_id, facture)
        }
        break
      }

      case 'projet_status_change': {
        const { data: projet } = await supabase
          .from('projets')
          .select('*')
          .eq('id', data.projet_id)
          .single()
        if (projet) {
          await notifyProjetStatusChange(
            atelier_id,
            projet,
            data.old_status,
            data.new_status
          )
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Type de notification inconnu' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erreur déclenchement notification:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors du déclenchement' },
      { status: 500 }
    )
  }
}
