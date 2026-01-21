import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// API pour vérifier et ajouter les colonnes manquantes
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const results: any[] = []

  // 1. Vérifier et ajouter colonne facture_trigger sur clients
  try {
    const { error: err1 } = await supabase.rpc('execute_sql', { 
      sql: `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS facture_trigger TEXT DEFAULT 'pret' CHECK (facture_trigger IN ('pret', 'livre'))`
    })
    results.push({ step: 'clients.facture_trigger', success: !err1, error: err1?.message })
  } catch (e: any) {
    // Tenter une approche directe via une requête
    results.push({ step: 'clients.facture_trigger', success: false, error: e.message, note: 'RPC not available, manual migration needed' })
  }

  // 2. Vérifier structure de factures
  const { data: factureTest, error: factureError } = await supabase
    .from('factures')
    .select('id, auto_created, items, payment_status, notes')
    .limit(1)

  if (factureError) {
    results.push({ 
      step: 'factures_columns', 
      success: false, 
      error: factureError.message,
      note: 'Colonnes manquantes: auto_created, items, payment_status, notes. Exécuter migrations 007 et 010'
    })
  } else {
    results.push({ step: 'factures_columns', success: true })
  }

  // 3. Vérifier structure de projets
  const { data: projetTest, error: projetError } = await supabase
    .from('projets')
    .select('id, auto_created')
    .limit(1)

  if (projetError) {
    results.push({ 
      step: 'projets.auto_created', 
      success: false, 
      error: projetError.message 
    })
  } else {
    results.push({ step: 'projets.auto_created', success: true })
  }

  // 4. Vérifier table stock_mouvements
  const { data: stockTest, error: stockError } = await supabase
    .from('stock_mouvements')
    .select('id')
    .limit(1)

  if (stockError) {
    results.push({ 
      step: 'stock_mouvements', 
      success: false, 
      error: stockError.message,
      note: 'Table manquante. Exécuter migration 010' 
    })
  } else {
    results.push({ step: 'stock_mouvements', success: true })
  }

  // 5. Vérifier table push_subscriptions
  const { data: pushTest, error: pushError } = await supabase
    .from('push_subscriptions')
    .select('id')
    .limit(1)

  if (pushError) {
    results.push({ 
      step: 'push_subscriptions', 
      success: false, 
      error: pushError.message 
    })
  } else {
    results.push({ step: 'push_subscriptions', success: true })
  }

  const allSuccess = results.every(r => r.success)

  return NextResponse.json({ 
    success: allSuccess, 
    message: allSuccess ? 'Toutes les tables sont correctement configurées' : 'Des migrations sont nécessaires',
    results,
    instructions: !allSuccess ? [
      '1. Allez dans le Dashboard Supabase > SQL Editor',
      '2. Exécutez les migrations suivantes dans l\'ordre :',
      '   - supabase/migrations/007_facturation_améliorations.sql',
      '   - supabase/migrations/010_automatisations.sql',
      '3. Relancez cette vérification'
    ] : undefined
  })
}
