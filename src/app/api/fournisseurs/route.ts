import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { FournisseurCreateSchema, PaginationSchema, validateBody } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    const url = new URL(request.url)
    const params = PaginationSchema.parse({
      page: url.searchParams.get('page'),
      limit: url.searchParams.get('limit'),
      search: url.searchParams.get('search'),
    })

    let query = supabase
      .from('fournisseurs')
      .select('*', { count: 'exact' })
      .eq('atelier_id', userData.atelier_id)
      .order('nom', { ascending: true })

    if (params.search) {
      query = query.or(`nom.ilike.%${params.search}%,email.ilike.%${params.search}%`)
    }

    const from = (params.page - 1) * params.limit
    query = query.range(from, from + params.limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const total = count || 0
    return NextResponse.json({
      data: data || [],
      pagination: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit), hasNext: params.page * params.limit < total, hasPrev: params.page > 1 },
    })
  } catch (error) {
    console.error('Erreur GET fournisseurs:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('atelier_id, role').eq('id', user.id).single()
    if (!userData || !['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(FournisseurCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.errors }, { status: 400 })
    }

    const { data: fournisseur, error } = await supabase
      .from('fournisseurs')
      .insert({ atelier_id: userData.atelier_id, ...validation.data })
      .select().single()

    if (error) throw error
    return NextResponse.json({ success: true, data: fournisseur }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST fournisseur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
