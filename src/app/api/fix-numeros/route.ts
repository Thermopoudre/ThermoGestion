import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// API endpoint to fix NaN numeros in the database
export async function POST() {
  try {
    const supabase = await createServerClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer l'atelier de l'utilisateur
    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const atelierId = userData.atelier_id
    const results: string[] = []

    // Fix projets with NaN in numero
    const { data: projetsWithNaN } = await supabase
      .from('projets')
      .select('id, numero')
      .eq('atelier_id', atelierId)
      .like('numero', '%NaN%')

    if (projetsWithNaN && projetsWithNaN.length > 0) {
      // Get total count for proper numbering
      const { count: projetsCount } = await supabase
        .from('projets')
        .select('id', { count: 'exact', head: true })
        .eq('atelier_id', atelierId)

      const year = new Date().getFullYear()
      let fixedCount = 0

      for (const projet of projetsWithNaN) {
        const newNumero = `PROJ-${year}-${String((projetsCount || 0) - projetsWithNaN.length + fixedCount + 1).padStart(4, '0')}`
        
        const { error } = await supabase
          .from('projets')
          .update({ numero: newNumero })
          .eq('id', projet.id)

        if (!error) {
          results.push(`Projet ${projet.id}: ${projet.numero} -> ${newNumero}`)
          fixedCount++
        }
      }
    }

    // Fix devis with NaN in numero
    const { data: devisWithNaN } = await supabase
      .from('devis')
      .select('id, numero')
      .eq('atelier_id', atelierId)
      .like('numero', '%NaN%')

    if (devisWithNaN && devisWithNaN.length > 0) {
      const { count: devisCount } = await supabase
        .from('devis')
        .select('id', { count: 'exact', head: true })
        .eq('atelier_id', atelierId)

      const year = new Date().getFullYear()
      let fixedCount = 0

      for (const devis of devisWithNaN) {
        const newNumero = `DEV-${year}-${String((devisCount || 0) - devisWithNaN.length + fixedCount + 1).padStart(4, '0')}`
        
        const { error } = await supabase
          .from('devis')
          .update({ numero: newNumero })
          .eq('id', devis.id)

        if (!error) {
          results.push(`Devis ${devis.id}: ${devis.numero} -> ${newNumero}`)
          fixedCount++
        }
      }
    }

    // Fix factures with NaN in numero
    const { data: facturesWithNaN } = await supabase
      .from('factures')
      .select('id, numero')
      .eq('atelier_id', atelierId)
      .like('numero', '%NaN%')

    if (facturesWithNaN && facturesWithNaN.length > 0) {
      const { count: facturesCount } = await supabase
        .from('factures')
        .select('id', { count: 'exact', head: true })
        .eq('atelier_id', atelierId)

      const year = new Date().getFullYear()
      let fixedCount = 0

      for (const facture of facturesWithNaN) {
        const newNumero = `FACT-${year}-${String((facturesCount || 0) - facturesWithNaN.length + fixedCount + 1).padStart(4, '0')}`
        
        const { error } = await supabase
          .from('factures')
          .update({ numero: newNumero })
          .eq('id', facture.id)

        if (!error) {
          results.push(`Facture ${facture.id}: ${facture.numero} -> ${newNumero}`)
          fixedCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      fixed: results.length,
      details: results
    })
  } catch (error) {
    console.error('Erreur fix-numeros:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to fix numeros' })
}
