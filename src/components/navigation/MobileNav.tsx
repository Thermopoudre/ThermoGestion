'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface MobileNavProps {
  userEmail: string
}

interface NavSection {
  title: string
  links: { href: string; label: string }[]
}

const navSections: NavSection[] = [
  {
    title: 'Principal',
    links: [
      { href: '/app/dashboard', label: 'Dashboard' },
      { href: '/app/clients', label: 'Clients' },
      { href: '/app/projets', label: 'Projets' },
      { href: '/app/devis', label: 'Devis' },
      { href: '/app/factures', label: 'Factures' },
      { href: '/app/poudres', label: 'Poudres' },
      { href: '/app/planning', label: 'Planning' },
      { href: '/app/stats', label: 'Statistiques' },
    ],
  },
  {
    title: 'Production',
    links: [
      { href: '/app/kanban', label: 'Kanban' },
      { href: '/app/batching', label: 'Batching' },
      { href: '/app/atelier', label: 'Mode Atelier' },
      { href: '/app/series', label: 'Séries' },
      { href: '/app/retouches', label: 'Retouches' },
      { href: '/app/planification-cuisson', label: 'Cuisson Four' },
    ],
  },
  {
    title: 'Métier',
    links: [
      { href: '/app/jantes', label: 'Jantes' },
      { href: '/app/consommables', label: 'Consommables' },
      { href: '/app/maintenance', label: 'Maintenance' },
      { href: '/app/etiquettes', label: 'Étiquettes QR' },
      { href: '/app/stock-intelligent', label: 'Stock avancé' },
      { href: '/app/reapprovisionnement', label: 'Réappro' },
      { href: '/app/marketplace', label: 'Marketplace' },
    ],
  },
  {
    title: 'Outils',
    links: [
      { href: '/app/ral', label: 'Nuancier RAL' },
      { href: '/app/calculateur', label: 'Calculateur' },
      { href: '/app/photos', label: 'Photos' },
      { href: '/app/signature', label: 'Signatures' },
    ],
  },
  {
    title: 'Communication',
    links: [
      { href: '/app/chat', label: 'Messages' },
      { href: '/app/relances', label: 'Relances' },
      { href: '/app/fidelite', label: 'Fidélité' },
      { href: '/app/equipe', label: 'Équipe' },
      { href: '/app/activite', label: 'Activité' },
    ],
  },
  {
    title: 'Avancé',
    links: [
      { href: '/app/grille-tarifaire', label: 'Grille tarifaire' },
      { href: '/app/tarifs-clients', label: 'Tarifs clients' },
      { href: '/app/previsionnel', label: 'Prévisionnel' },
      { href: '/app/objectifs', label: 'Objectifs' },
      { href: '/app/ecran-atelier', label: 'Écran TV' },
      { href: '/app/ia', label: 'IA Prédictive' },
      { href: '/app/iot', label: 'IoT Machines' },
      { href: '/app/multi-sites', label: 'Multi-sites' },
      { href: '/app/feature-flags', label: 'Feature Flags' },
      { href: '/app/parametres', label: 'Paramètres' },
    ],
  },
]

export function MobileNav({ userEmail }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/app/dashboard') return pathname === href || pathname === '/app'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Bouton hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
        aria-label="Menu"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu mobile */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header du menu - Style thermolaquage */}
        <div className="p-4 border-b border-orange-200 dark:border-orange-900/50 bg-gradient-to-r from-orange-500 to-red-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-2xl">🔥</span>
              </div>
              <span className="text-white font-bold text-lg">
                Thermo<span className="text-orange-200">Gestion</span>
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-white/70 mt-2 truncate">{userEmail}</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto h-[calc(100%-180px)]">
          {navSections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{section.title}</p>
              <ul className="space-y-0.5">
                {section.links.map((link) => {
                  const active = isActive(link.href)
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={`block px-3 py-2 rounded-lg transition-colors ${
                          active
                            ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-bold border-l-4 border-orange-500'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400'
                        }`}
                      >
                        <span className="font-medium text-sm">{link.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer du menu */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
