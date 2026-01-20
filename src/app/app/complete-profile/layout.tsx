// Layout spécifique pour complete-profile qui n'affiche pas la navigation
// pour éviter les boucles de redirection
// Ce layout remplace le layout parent /app/layout.tsx

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function CompleteProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Layout minimal sans navigation pour éviter les boucles
  return (
    <div className="min-h-screen bg-gray-50">
      <main>{children}</main>
    </div>
  )
}
