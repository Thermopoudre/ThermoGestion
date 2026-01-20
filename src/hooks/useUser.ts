'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type User = Database['public']['Tables']['users']['Row']
type Atelier = Database['public']['Tables']['ateliers']['Row']

interface UserWithAtelier extends User {
  ateliers: Atelier
}

export function useUser() {
  const [user, setUser] = useState<UserWithAtelier | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          setUser(null)
          setLoading(false)
          return
        }

        // Charger les données utilisateur avec l'atelier
        const { data, error } = await supabase
          .from('users')
          .select(`
            *,
            ateliers (*)
          `)
          .eq('id', authUser.id)
          .single()

        if (error) {
          console.error('Erreur chargement utilisateur:', error)
          setUser(null)
        } else {
          setUser(data as UserWithAtelier)
        }
      } catch (err) {
        console.error('Erreur useUser:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return { user, loading }
}
