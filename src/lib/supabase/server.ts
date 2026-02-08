import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database.types'

// Client pour Server Components
export const createServerClient = async () => {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

/**
 * Résultat de la vérification d'autorisation
 */
export interface AuthorizedUser {
  authUser: { id: string; email: string }
  atelierId: string
  role: string
  userId: string
}

/**
 * Helper centralisé pour vérifier l'authentification ET l'appartenance à un atelier.
 * Redirige automatiquement si l'utilisateur n'est pas connecté ou n'a pas d'atelier.
 * 
 * Usage dans les Server Components:
 * ```
 * const { authUser, atelierId, role } = await getAuthorizedUser()
 * ```
 */
export async function getAuthorizedUser(options?: {
  requiredRoles?: string[]
}): Promise<AuthorizedUser> {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Vérifier que l'utilisateur existe dans la table users et récupérer son atelier
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, atelier_id, role, email')
    .eq('id', authUser.id)
    .single()

  if (userError || !userData?.atelier_id) {
    redirect('/app/complete-profile')
  }

  // Vérification des rôles si nécessaire
  if (options?.requiredRoles && options.requiredRoles.length > 0) {
    if (!options.requiredRoles.includes(userData.role)) {
      redirect('/app/dashboard?error=unauthorized')
    }
  }

  return {
    authUser: { id: authUser.id, email: authUser.email || '' },
    atelierId: userData.atelier_id,
    role: userData.role,
    userId: userData.id,
  }
}
