'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type AuditLog = Database['public']['Tables']['audit_logs']['Row']

export function RecentActivity({ atelierId }: { atelierId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    const loadLogs = async () => {
      try {
        if (!atelierId) {
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('atelier_id', atelierId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) {
          console.error('Erreur chargement logs:', error)
          setLogs([]) // Afficher une liste vide en cas d'erreur
        } else {
          setLogs(data || [])
        }
      } catch (err) {
        console.error('Erreur RecentActivity:', err)
        setLogs([]) // Afficher une liste vide en cas d'erreur
      } finally {
        setLoading(false)
      }
    }

    loadLogs()
  }, [atelierId, supabase])

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Activité récente</h2>
        <p className="text-gray-600">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Activité récente</h2>
      {logs.length === 0 ? (
        <p className="text-gray-600">Aucune activité récente</p>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 pb-4 border-b border-gray-200 last:border-0">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {log.action} sur {log.table_name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(log.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
