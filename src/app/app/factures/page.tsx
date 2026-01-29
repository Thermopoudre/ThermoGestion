'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FacturesList } from '@/components/factures/FacturesList'

export default function FacturesPage() {
  const [factures, setFactures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    async function loadFactures() {
      try {
        // Get user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/auth/login')
          return
        }

        // Get user's atelier
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('atelier_id')
          .eq('id', user.id)
          .single()

        if (userError || !userData?.atelier_id) {
          setError('Profil incomplet')
          setLoading(false)
          return
        }

        // Get factures with joins
        const { data: facturesData, error: facturesError } = await supabase
          .from('factures')
          .select(`
            *,
            clients (
              id,
              full_name,
              email
            ),
            projets (
              id,
              name,
              numero
            )
          `)
          .eq('atelier_id', userData.atelier_id)
          .order('created_at', { ascending: false })

        setDebugInfo({
          userId: user.id,
          atelierId: userData.atelier_id,
          facturesCount: facturesData?.length || 0,
          facturesError: facturesError?.message || null
        })

        if (facturesError) {
          console.error('Erreur factures:', facturesError)
          setError(facturesError.message)
        } else {
          setFactures(facturesData || [])
        }
      } catch (err: any) {
        console.error('Erreur:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadFactures()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Debug info - à supprimer en production */}
        {debugInfo && (
          <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded text-sm text-blue-800 dark:text-blue-200">
            <p><strong>Debug:</strong> Atelier ID: {debugInfo.atelierId}</p>
            <p>Factures trouvées: {debugInfo.facturesCount}</p>
            {debugInfo.facturesError && <p className="text-red-600">Erreur: {debugInfo.facturesError}</p>}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 rounded-lg text-red-700 dark:text-red-200">
            <p>Erreur: {error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">Factures</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Gérez vos factures et paiements</p>
          </div>
          <a
            href="/app/factures/new"
            className="w-full sm:w-auto text-center bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            + Nouvelle facture
          </a>
        </div>

        <FacturesList factures={factures} />
      </div>
    </div>
  )
}
