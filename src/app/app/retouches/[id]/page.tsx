import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RetoucheDetail } from '@/components/retouches/RetoucheDetail'

export default async function RetoucheDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/complete-profile')
  }

  // Récupérer la retouche
  const { data: retouche, error: retoucheError } = await supabase
    .from('retouches')
    .select(`
      *,
      projets (
        id,
        name,
        numero,
        status
      ),
      defaut_types (
        id,
        name,
        category
      ),
      created_by_user:users!retouches_created_by_fkey (
        id,
        full_name,
        email
      ),
      resolved_by_user:users!retouches_resolved_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq('id', params.id)
    .eq('atelier_id', userData.atelier_id)
    .single()

  if (retoucheError || !retouche) {
    redirect('/app/retouches?error=not_found')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <RetoucheDetail retouche={retouche} atelierId={userData.atelier_id} userId={user.id} />
    </div>
  )
}
