/**
 * API Route: Génération Factur-X pour une facture
 * 
 * GET /api/factures/:id/facturx
 * 
 * Retourne le XML Factur-X conforme EN16931 + archive la facture
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { generateFacturXML, buildFacturXData, computeHash } from '@/lib/facturx/generate'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  try {
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer la facture avec les relations
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        clients (*),
        projets (*)
      `)
      .eq('id', params.id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    // Récupérer l'atelier
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Vérifier que la facture appartient à l'atelier
    if (facture.atelier_id !== userData.atelier_id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { data: atelier } = await supabase
      .from('ateliers')
      .select('*')
      .eq('id', userData.atelier_id)
      .single()

    // Générer le XML Factur-X
    const facturXData = buildFacturXData(facture, atelier, facture.clients)
    const xml = generateFacturXML(facturXData)

    // Calculer le hash pour archivage
    const hash = await computeHash(xml)

    // Archiver la facture (archivage légal 10 ans)
    const expireDate = new Date()
    expireDate.setFullYear(expireDate.getFullYear() + 10)

    await supabase.from('factures_archive').upsert({
      facture_id: facture.id,
      atelier_id: facture.atelier_id,
      numero: facture.numero,
      pdf_url: '', // sera mis à jour quand le PDF est généré
      xml_facturx: xml,
      hash_sha256: hash,
      montant_ttc: facture.total_ttc,
      date_emission: facture.created_at.split('T')[0],
      expire_at: expireDate.toISOString().split('T')[0],
      metadata: {
        client: facture.clients?.full_name,
        type: facture.type,
        generated_at: new Date().toISOString(),
      }
    }, { onConflict: 'facture_id' })

    // Retourner le XML avec le bon content-type
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="facturx_${facture.numero}.xml"`,
        'X-Facturx-Hash': hash,
      },
    })

  } catch (error: any) {
    console.error('Factur-X generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
