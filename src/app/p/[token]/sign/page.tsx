import { createServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { PublicSignatureForm } from '@/components/public/PublicSignatureForm'

// Page publique pour signer un devis sans compte
// Accessible via /p/{token}/sign

export default async function PublicSignPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createServerClient()
  
  // Chercher le devis par token
  const { data: devis, error } = await supabase
    .from('devis')
    .select(`
      *,
      clients (
        id,
        full_name,
        email,
        phone,
        address
      ),
      ateliers (
        id,
        name,
        phone,
        email,
        address,
        siret
      )
    `)
    .eq('public_token', params.token)
    .single()

  if (error || !devis) {
    // Peut-être un token projet, rediriger vers la page projet
    const { data: projet } = await supabase
      .from('projets')
      .select('public_token')
      .eq('public_token', params.token)
      .single()
    
    if (projet) {
      redirect(`/p/${params.token}`)
    }
    
    notFound()
  }

  // Si déjà signé, rediriger vers la page de confirmation
  if (devis.signed_at) {
    redirect(`/p/${params.token}`)
  }

  return (
    <PublicSignatureForm 
      devis={devis}
      atelier={devis.ateliers}
      client={devis.clients}
      token={params.token}
    />
  )
}
