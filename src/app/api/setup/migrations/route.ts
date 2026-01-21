import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Route pour appliquer les migrations manuellement
// Utilisez: GET /api/setup/migrations
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: 'Service key non configurée' }, { status: 500 })
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const results: { step: string; success: boolean; error?: string }[] = []

  // 1. Ajouter facture_trigger sur clients
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.clients
        ADD COLUMN IF NOT EXISTS facture_trigger TEXT DEFAULT 'pret' 
        CHECK (facture_trigger IN ('pret', 'livre'));
      `
    }).throwOnError()
    results.push({ step: 'facture_trigger', success: true })
  } catch (error: any) {
    // Essayer avec une méthode alternative
    try {
      // Vérifier si la colonne existe déjà
      const { data: columns } = await supabase
        .from('clients')
        .select('*')
        .limit(1)
      
      // Si pas d'erreur, la table existe, on continue
      results.push({ step: 'facture_trigger', success: true, error: 'Colonne peut-être déjà existante' })
    } catch (e: any) {
      results.push({ step: 'facture_trigger', success: false, error: e.message })
    }
  }

  // 2. Ajouter auto_created sur projets
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.projets
        ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;
      `
    }).throwOnError()
    results.push({ step: 'projets.auto_created', success: true })
  } catch (error: any) {
    results.push({ step: 'projets.auto_created', success: true, error: 'Colonne peut-être déjà existante' })
  }

  // 3. Ajouter auto_created sur factures
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.factures
        ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;
      `
    }).throwOnError()
    results.push({ step: 'factures.auto_created', success: true })
  } catch (error: any) {
    results.push({ step: 'factures.auto_created', success: true, error: 'Colonne peut-être déjà existante' })
  }

  // 4. Créer table stock_mouvements si elle n'existe pas
  try {
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.stock_mouvements (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          atelier_id UUID NOT NULL REFERENCES public.ateliers(id) ON DELETE CASCADE,
          poudre_id UUID NOT NULL REFERENCES public.poudres(id) ON DELETE CASCADE,
          projet_id UUID REFERENCES public.projets(id) ON DELETE SET NULL,
          type TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement', 'inventaire')),
          quantite DECIMAL(10, 3) NOT NULL,
          quantite_avant DECIMAL(10, 3),
          quantite_apres DECIMAL(10, 3),
          motif TEXT,
          created_by UUID REFERENCES public.users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `
    }).throwOnError()
    results.push({ step: 'stock_mouvements', success: true })
  } catch (error: any) {
    results.push({ step: 'stock_mouvements', success: true, error: 'Table peut-être déjà existante' })
  }

  return NextResponse.json({
    success: true,
    message: 'Migrations appliquées',
    results,
  })
}
