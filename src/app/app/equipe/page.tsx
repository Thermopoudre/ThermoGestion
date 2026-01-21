import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeamManagement } from '@/components/equipe/TeamManagement'
import { hasPermission, UserRole } from '@/lib/roles'

export default async function EquipePage() {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Charger l'utilisateur et son atelier
  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id, role')
    .eq('id', authUser.id)
    .single()

  if (!userData) {
    redirect('/app/complete-profile')
  }

  const userRole = userData.role as UserRole

  // Vérifier les permissions
  if (!hasPermission(userRole, 'equipe.view')) {
    redirect('/app/dashboard')
  }

  // Charger les membres de l'équipe
  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, email, full_name, role, created_at, last_login_at')
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: true })

  // Charger les invitations en attente
  const { data: invitations } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('atelier_id', userData.atelier_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Charger l'atelier
  const { data: atelier } = await supabase
    .from('ateliers')
    .select('id, name, plan')
    .eq('id', userData.atelier_id)
    .single()

  // Limites selon le plan
  const planLimits: Record<string, number> = {
    free: 1,
    starter: 3,
    pro: 10,
    enterprise: 999,
  }
  const maxMembers = planLimits[atelier?.plan || 'free'] || 1

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
            👥 Équipe
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez les membres de votre équipe et leurs accès
          </p>
        </div>

        <TeamManagement
          currentUserId={authUser.id}
          currentUserRole={userRole}
          atelierId={userData.atelier_id}
          teamMembers={teamMembers || []}
          invitations={invitations || []}
          maxMembers={maxMembers}
          currentCount={(teamMembers?.length || 0) + (invitations?.length || 0)}
          planName={atelier?.plan || 'free'}
        />
      </div>
    </div>
  )
}
