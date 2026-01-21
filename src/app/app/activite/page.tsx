import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ActivitePage() {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('atelier_id')
    .eq('id', authUser.id)
    .single()

  if (!userData) {
    redirect('/app/complete-profile')
  }

  // Récupérer les 100 dernières activités
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      users (full_name, email)
    `)
    .eq('atelier_id', userData.atelier_id)
    .order('created_at', { ascending: false })
    .limit(100)

  const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
    INSERT: { label: 'Création', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400', icon: '➕' },
    UPDATE: { label: 'Modification', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400', icon: '✏️' },
    DELETE: { label: 'Suppression', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', icon: '🗑️' },
  }

  const tableLabels: Record<string, { label: string; icon: string; link: string }> = {
    devis: { label: 'Devis', icon: '📝', link: '/app/devis' },
    projets: { label: 'Projet', icon: '🔧', link: '/app/projets' },
    factures: { label: 'Facture', icon: '📄', link: '/app/factures' },
    clients: { label: 'Client', icon: '👤', link: '/app/clients' },
    poudres: { label: 'Poudre', icon: '🎨', link: '/app/poudres' },
  }

  const getRecordTitle = (log: any) => {
    if (log.new_data) {
      return log.new_data.numero || log.new_data.name || log.new_data.full_name || log.new_data.reference || log.record_id.slice(0, 8)
    }
    if (log.old_data) {
      return log.old_data.numero || log.old_data.name || log.old_data.full_name || log.old_data.reference || log.record_id.slice(0, 8)
    }
    return log.record_id.slice(0, 8)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
            📋 Journal d'activité
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Historique des modifications sur vos données
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {!logs || logs.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-6xl mb-4 block">📋</span>
              <p className="text-gray-500 dark:text-gray-400">Aucune activité enregistrée</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.map((log: any) => {
                const action = actionLabels[log.action] || actionLabels.UPDATE
                const table = tableLabels[log.table_name] || { label: log.table_name, icon: '📦', link: '#' }
                const userName = log.users?.full_name || log.users?.email || 'Système'
                const recordTitle = getRecordTitle(log)

                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">{action.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${action.color}`}>
                            {action.label}
                          </span>
                          <span className="text-sm text-gray-900 dark:text-white font-medium">
                            {table.icon} {table.label}
                          </span>
                          <Link 
                            href={`${table.link}/${log.record_id}`}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {recordTitle}
                          </Link>
                        </div>
                        
                        {log.changed_fields && log.changed_fields.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Champs modifiés: {log.changed_fields.filter((f: string) => !['updated_at', 'created_at'].includes(f)).join(', ')}
                          </p>
                        )}
                        
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          par {userName} • {formatDate(log.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
