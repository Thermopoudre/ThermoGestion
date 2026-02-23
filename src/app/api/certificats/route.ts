import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateBody, PaginationSchema } from '@/lib/validations'

const CertificatCreateSchema = z.object({
  projet_id: z.string().uuid(),
  type: z.enum(['standard', 'qualicoat', 'qualimarine', 'gsb', 'custom']).default('standard'),
  epaisseur_mesuree: z.number().positive().optional(),
  epaisseur_min: z.number().positive().optional(),
  epaisseur_max: z.number().positive().optional(),
  adherence_ok: z.boolean().optional(),
  brillance_ok: z.boolean().optional(),
  durete_ok: z.boolean().optional(),
  resistance_corrosion_ok: z.boolean().optional(),
  temperature_cuisson: z.number().int().min(100).max(300).optional(),
  duree_cuisson: z.number().int().min(1).max(120).optional(),
  lot_poudre_id: z.string().uuid().optional().nullable(),
  mesures_detail: z.record(z.unknown()).optional(),
  remarques: z.string().max(2000).optional().nullable(),
  conforme: z.boolean().default(true),
})

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    const url = new URL(request.url)
    const projetId = url.searchParams.get('projet_id')
    const params = PaginationSchema.parse({ page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })

    let query = supabase
      .from('certificats_conformite')
      .select('*, projets(numero, name, clients(full_name))', { count: 'exact' })
      .eq('atelier_id', userData.atelier_id)
      .order('created_at', { ascending: false })

    if (projetId) query = query.eq('projet_id', projetId)

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
    console.error('Erreur GET certificats:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('atelier_id').eq('id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

    const body = await request.json()
    const validation = validateBody(CertificatCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.errors }, { status: 400 })
    }

    // Verify project ownership
    const { data: projet } = await supabase
      .from('projets').select('id, numero').eq('id', validation.data.projet_id).eq('atelier_id', userData.atelier_id).single()
    if (!projet) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

    // Generate certificate number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('certificats_conformite').select('*', { count: 'exact', head: true }).eq('atelier_id', userData.atelier_id)
    const numero = `CERT-${year}-${String((count || 0) + 1).padStart(4, '0')}`

    const { projet_id, type, remarques, conforme, mesures_detail, ...mesures } = validation.data

    const { data: certificat, error } = await supabase
      .from('certificats_conformite')
      .insert({
        atelier_id: userData.atelier_id, projet_id, numero, type,
        ...mesures, mesures_detail: mesures_detail || {},
        remarques, conforme, created_by: user.id,
      })
      .select().single()

    if (error) throw error
    return NextResponse.json({ success: true, data: certificat }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST certificat:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
