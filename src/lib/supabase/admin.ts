import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Client admin avec service role (pour opérations privilégiées)
// ⚠️ À utiliser uniquement côté serveur, jamais côté client
export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
