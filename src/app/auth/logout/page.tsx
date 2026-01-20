'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    const handleLogout = async () => {
      await supabase.auth.signOut()
      router.push('/auth/login')
      router.refresh()
    }
    handleLogout()
  }, [supabase, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Déconnexion en cours...</p>
      </div>
    </div>
  )
}
