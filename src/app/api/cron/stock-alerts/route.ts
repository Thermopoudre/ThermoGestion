import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Cette API est appelée par un cron job pour vérifier les stocks bas
export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret pour sécuriser l'endpoint (optionnel mais recommandé)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // En dev, on autorise sans secret
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    const supabase = await createServerClient()

    // Récupérer tous les stocks en dessous du seuil qui n'ont pas eu d'alerte récente (24h)
    const { data: stocksBas, error: stockError } = await supabase
      .from('stock_poudres')
      .select(`
        id,
        atelier_id,
        poudre_id,
        stock_reel_kg,
        seuil_alerte_kg,
        derniere_alerte_at,
        alerte_active,
        poudres (
          id,
          marque,
          reference,
          ral
        )
      `)
      .eq('alerte_active', true)
      .not('stock_reel_kg', 'is', null)

    if (stockError) {
      console.error('Erreur récupération stocks:', stockError)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    let alertesCreees = 0
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    for (const stock of stocksBas || []) {
      // Vérifier si le stock est en dessous du seuil
      const stockReel = stock.stock_reel_kg || 0
      const seuil = stock.seuil_alerte_kg || 5

      if (stockReel >= seuil) continue

      // Vérifier si une alerte a été envoyée dans les 24 dernières heures
      if (stock.derniere_alerte_at) {
        const derniereAlerte = new Date(stock.derniere_alerte_at)
        if (derniereAlerte > twentyFourHoursAgo) continue
      }

      const poudre = stock.poudres as any
      if (!poudre) continue

      // Créer l'alerte
      const { error: alerteError } = await supabase
        .from('alertes')
        .insert({
          atelier_id: stock.atelier_id,
          type: 'stock_bas',
          titre: `Stock bas: ${poudre.marque} ${poudre.reference}`,
          message: `Le stock de ${poudre.marque} ${poudre.reference}${poudre.ral ? ` (RAL ${poudre.ral})` : ''} est à ${Number(stockReel).toFixed(2)} kg (seuil: ${seuil} kg)`,
          lien: `/app/poudres/${poudre.id}/stock`,
          data: {
            poudre_id: poudre.id,
            stock_actuel: stockReel,
            seuil: seuil,
          },
        })

      if (alerteError) {
        console.error('Erreur création alerte:', alerteError)
        continue
      }

      // Mettre à jour la date de dernière alerte
      await supabase
        .from('stock_poudres')
        .update({ derniere_alerte_at: now.toISOString() })
        .eq('id', stock.id)

      alertesCreees++
    }

    return NextResponse.json({
      success: true,
      message: `${alertesCreees} alerte(s) de stock bas créée(s)`,
      alertes_creees: alertesCreees,
    })
  } catch (error) {
    console.error('Erreur cron stock alerts:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
