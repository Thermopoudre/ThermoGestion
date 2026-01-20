import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateFEC } from '@/lib/facturation/exports'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    // Récupérer les factures
    let query = supabase
      .from('factures')
      .select(`
        *,
        clients (
          id,
          full_name,
          email,
          siret
        )
      `)
      .eq('atelier_id', userData.atelier_id)

    if (startDate) {
      query = query.gte('created_at', startDate)
    } else {
      // Par défaut, année complète
      query = query.gte('created_at', `${year}-01-01`)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    } else {
      query = query.lte('created_at', `${year}-12-31`)
    }

    const { data: factures, error: facturesError } = await query.order('created_at', {
      ascending: true,
    })

    if (facturesError) {
      return NextResponse.json({ error: facturesError.message }, { status: 500 })
    }

    // Récupérer les paiements
    const facturesIds = (factures || []).map((f) => f.id)
    let paiementsQuery = supabase.from('paiements').select('*').eq('atelier_id', userData.atelier_id)

    if (facturesIds.length > 0) {
      paiementsQuery = paiementsQuery.in('facture_id', facturesIds)
    }

    const { data: paiements, error: paiementsError } = await paiementsQuery

    if (paiementsError) {
      return NextResponse.json({ error: paiementsError.message }, { status: 500 })
    }

    const fec = generateFEC(factures || [], paiements || [])

    return new NextResponse(fec, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="FEC_${year}.xml"`,
      },
    })
  } catch (error: any) {
    console.error('Erreur export FEC:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'export FEC' },
      { status: 500 }
    )
  }
}
