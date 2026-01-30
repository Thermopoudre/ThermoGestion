'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/app/parametres', label: 'Atelier' },
  { href: '/app/equipe', label: 'Équipe' },
  { href: '/app/parametres/integrations', label: 'Intégrations' },
  { href: '/app/parametres/templates', label: 'Templates' },
  { href: '/app/parametres/abonnement', label: 'Abonnement' },
  { href: '/app/parametres/paiement', label: 'Paiement' },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              isActive
                ? 'text-orange-600 dark:text-orange-400 font-medium border-b-2 border-orange-500 -mb-[17px]'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
