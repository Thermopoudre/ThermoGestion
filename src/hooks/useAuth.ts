'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase/client'
import type { User as AppUser } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    // Récupérer l'utilisateur actuel
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!error && user) {
        setUser(user)
        // TODO: Récupérer les données utilisateur depuis la table users
        // loadUserData(user.id)
      }
      setLoading(false)
    })

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // TODO: Charger les données utilisateur
        // loadUserData(session.user.id)
      } else {
        setAppUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAppUser(null)
  }

  return {
    user,
    appUser,
    loading,
    signOut,
  }
}
