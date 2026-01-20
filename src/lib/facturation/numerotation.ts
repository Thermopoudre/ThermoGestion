// Utilitaires pour la numérotation automatique des factures

import { createServerClient } from '@/lib/supabase/server'

/**
 * Générer un numéro de facture automatique
 * Utilise la fonction SQL generate_facture_numero()
 */
export async function generateFactureNumero(atelierId: string): Promise<string> {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('generate_facture_numero', {
    p_atelier_id: atelierId,
  })

  if (error) {
    console.error('Erreur génération numéro facture:', error)
    // Fallback : générer un numéro simple
    const year = new Date().getFullYear()
    const timestamp = Date.now().toString().slice(-6)
    return `FACT-${year}-${timestamp}`
  }

  return data || `FACT-${new Date().getFullYear()}-${Date.now()}`
}

/**
 * Récupérer le format de numérotation d'un atelier
 */
export async function getFactureNumeroFormat(atelierId: string): Promise<string> {
  const supabase = await createServerClient()

  const { data: atelier, error } = await supabase
    .from('ateliers')
    .select('facture_numero_format')
    .eq('id', atelierId)
    .single()

  if (error || !atelier) {
    return 'FACT-YYYY-NNNN' // Format par défaut
  }

  return atelier.facture_numero_format || 'FACT-YYYY-NNNN'
}

/**
 * Mettre à jour le format de numérotation d'un atelier
 */
export async function updateFactureNumeroFormat(
  atelierId: string,
  format: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('ateliers')
    .update({ facture_numero_format: format })
    .eq('id', atelierId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
