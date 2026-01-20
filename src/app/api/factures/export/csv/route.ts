import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { exportFacturesCSV } from '@/lib/facturation/exports'

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
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: factures, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const csv = exportFacturesCSV(factures || [])

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="factures_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Erreur export CSV factures:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'export' },
      { status: 500 }
    )
  }
}
