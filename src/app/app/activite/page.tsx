import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ActivityTimeline } from '@/components/activity/ActivityTimeline'

export default async function ActivityPage() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', user.id)
    .single()

  if (!userData?.atelier_id) redirect('/app/complete-profile')

  // Charger les 100 dernières activités
  const { data: activities } = await supabase
    .from('activity_log')
    .select(`
      id,
      action,
      entity_type,
      entity_id,
      entity_name,
      details,
      created_at,
      users(full_name, email)
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📜 Journal d'activité</h1>
          <p className="mt-1 text-gray-600">Historique des actions sur votre atelier</p>
        </div>
      </div>

      <ActivityTimeline activities={activities || []} />
    </div>
  )
}
