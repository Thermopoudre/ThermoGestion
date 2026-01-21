import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScanUpdateStatus } from '@/components/scan/ScanUpdateStatus'

// Page de scan pour mise à jour rapide du statut projet
// Accessible via QR code sans authentification complète

export default async function ScanPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()

  // Récupérer le projet
  const { data: projet, error } = await supabase
    .from('projets')
    .select(`
      id,
      numero,
      description,
      status,
      client_id,
      atelier_id,
      created_at,
      clients (
        id,
        full_name,
        email
      ),
      ateliers (
        id,
        name
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !projet) {
    notFound()
  }

  return (
    <ScanUpdateStatus 
      projet={projet}
      client={projet.clients}
      atelier={projet.ateliers}
    />
  )
}
