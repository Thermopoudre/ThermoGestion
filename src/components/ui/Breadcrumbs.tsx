'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbsProps {
  customLabels?: Record<string, string>
  className?: string
}

// Mapping des segments de route vers des labels lisibles
const defaultLabels: Record<string, string> = {
  app: 'Accueil',
  dashboard: 'Dashboard',
  projets: 'Projets',
  devis: 'Devis',
  clients: 'Clients',
  factures: 'Factures',
  poudres: 'Poudres',
  series: 'Séries',
  planning: 'Planning',
  stats: 'Statistiques',
  parametres: 'Paramètres',
  equipe: 'Équipe',
  retouches: 'Retouches',
  activite: 'Activité',
  atelier: 'Atelier',
  new: 'Nouveau',
  edit: 'Modifier',
  import: 'Importer',
  templates: 'Modèles',
  integrations: 'Intégrations',
  convert: 'Convertir',
  send: 'Envoyer',
  sign: 'Signer',
  stock: 'Stock',
}

export default function Breadcrumbs({ customLabels = {}, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname()
  
  // Ignorer certaines pages
  if (pathname === '/app' || pathname === '/app/dashboard') {
    return null
  }

  // Construire les segments
  const segments = pathname.split('/').filter(Boolean)
  
  // Ne pas afficher si moins de 2 segments après /app
  if (segments.length < 3) return null

  // Construire les breadcrumbs
  const breadcrumbs = segments.slice(1).map((segment, index) => {
    const path = '/' + segments.slice(0, index + 2).join('/')
    
    // Déterminer le label
    let label = customLabels[segment] || defaultLabels[segment] || segment
    
    // Si c'est un UUID, on l'affiche en version courte ou on skip
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
    if (isUUID) {
      label = 'Détail'
    }

    return {
      label,
      path,
      isLast: index === segments.length - 2
    }
  })

  return (
    <nav className={`flex items-center gap-1 text-sm ${className}`} aria-label="Fil d'Ariane">
      {/* Home icon */}
      <Link
        href="/app/dashboard"
        className="p-1 text-gray-400 hover:text-orange-500 transition-colors"
        aria-label="Accueil"
      >
        <Home className="w-4 h-4" />
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-gray-300" />
          {crumb.isLast ? (
            <span className="text-gray-900 dark:text-white font-medium">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.path}
              className="text-gray-500 hover:text-orange-500 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
