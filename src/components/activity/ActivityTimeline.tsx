'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Activity {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: any
  created_at: string
  users: {
    full_name: string | null
    email: string
  } | null
}

interface ActivityTimelineProps {
  activities: Activity[]
}

const actionLabels: Record<string, string> = {
  create: 'a créé',
  update: 'a modifié',
  delete: 'a supprimé',
  status_change: 'a changé le statut de',
  sign: 'a signé',
  send: 'a envoyé',
  mark_paid: 'a marqué comme payée',
  upload: 'a ajouté une photo à',
  login: 's\'est connecté',
  auto_create_projet: 'Projet créé automatiquement pour',
  auto_create_facture: 'Facture créée automatiquement pour',
}

const entityLabels: Record<string, string> = {
  client: 'un client',
  projet: 'un projet',
  devis: 'un devis',
  facture: 'une facture',
  poudre: 'une poudre',
  retouche: 'une retouche',
}

const entityIcons: Record<string, string> = {
  client: '👤',
  projet: '🔧',
  devis: '📝',
  facture: '📄',
  poudre: '🎨',
  retouche: '🔄',
  system: '⚙️',
}

const entityLinks: Record<string, string> = {
  client: '/app/clients',
  projet: '/app/projets',
  devis: '/app/devis',
  facture: '/app/factures',
  poudre: '/app/poudres',
  retouche: '/app/retouches',
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  // Grouper par jour
  const groupedActivities: Record<string, Activity[]> = {}
  
  for (const activity of activities) {
    const date = new Date(activity.created_at).toLocaleDateString('fr-FR')
    if (!groupedActivities[date]) {
      groupedActivities[date] = []
    }
    groupedActivities[date].push(activity)
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <span className="text-4xl mb-4 block">📭</span>
        <p className="text-gray-500">Aucune activité récente</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedActivities).map(([date, dayActivities]) => (
        <div key={date}>
          <div className="sticky top-0 bg-gray-50 py-2 z-10">
            <h2 className="text-sm font-medium text-gray-500">{date}</h2>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {dayActivities.map((activity) => {
              const icon = entityIcons[activity.entity_type] || '📌'
              const actionLabel = actionLabels[activity.action] || activity.action
              const entityLabel = entityLabels[activity.entity_type] || activity.entity_type
              const link = activity.entity_id 
                ? `${entityLinks[activity.entity_type]}/${activity.entity_id}`
                : null

              return (
                <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                      {icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">
                          {activity.users?.full_name || activity.users?.email || 'Système'}
                        </span>
                        {' '}{actionLabel}{' '}
                        {link ? (
                          <Link href={link} className="text-orange-500 hover:underline font-medium">
                            {activity.entity_name || entityLabel}
                          </Link>
                        ) : (
                          <span className="font-medium">{activity.entity_name || entityLabel}</span>
                        )}
                      </p>
                      
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          {activity.details.old_status && activity.details.new_status && (
                            <span>
                              Statut: {activity.details.old_status} → {activity.details.new_status}
                            </span>
                          )}
                          {activity.details.numero && (
                            <span className="ml-2">#{activity.details.numero}</span>
                          )}
                        </div>
                      )}
                      
                      <p className="mt-1 text-xs text-gray-400">
                        {formatDistanceToNow(new Date(activity.created_at), { 
                          addSuffix: true,
                          locale: fr 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
