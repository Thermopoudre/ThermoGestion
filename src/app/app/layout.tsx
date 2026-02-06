import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SearchButton } from '@/components/search/SearchButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { MobileNav } from '@/components/navigation/MobileNav'
import { NavLink } from '@/components/navigation/NavLink'
import { UserMenu } from '@/components/navigation/UserMenu'
import { NotificationBell } from '@/components/ui/NotificationBell'
import AppShell from '@/components/layout/AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Navigation - Charte thermolaquage orange/rouge */}
      <nav className="bg-white dark:bg-gray-800 border-b border-orange-200 dark:border-orange-900/50 sticky top-0 z-30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo et menu hamburger mobile */}
            <div className="flex items-center gap-4">
              <MobileNav userEmail={user.email || ''} />
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <span className="text-xl">🔥</span>
                </div>
                <a href="/app/dashboard" className="text-gray-900 dark:text-white font-bold text-lg">
                  Thermo<span className="text-orange-500 dark:text-orange-400">Gestion</span>
                </a>
              </div>
            </div>

            {/* Navigation desktop */}
            <div className="hidden lg:flex items-center gap-4 ml-8">
              <NavLink href="/app/dashboard">Dashboard</NavLink>
              <NavLink href="/app/clients">Clients</NavLink>
              <NavLink href="/app/projets">Projets</NavLink>
              <NavLink href="/app/devis">Devis</NavLink>
              <NavLink href="/app/factures">Factures</NavLink>
              <NavLink href="/app/poudres">Poudres</NavLink>
              <NavLink href="/app/planning">Planning</NavLink>
              <NavLink href="/app/stats">Stats</NavLink>
              
              {/* Menu Plus pour les fonctionnalités avancées */}
              <div className="relative group">
                <button className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors flex items-center gap-1 py-2">
                  Plus
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute top-full -left-4 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="py-2">
                    <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Production</p>
                    <NavLink href="/app/kanban" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Kanban</NavLink>
                    <NavLink href="/app/batching" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Batching</NavLink>
                    <NavLink href="/app/atelier" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Mode Atelier</NavLink>
                    <NavLink href="/app/series" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Séries</NavLink>
                    <NavLink href="/app/retouches" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Retouches</NavLink>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 py-2">
                    <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Outils</p>
                    <NavLink href="/app/ral" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Nuancier RAL</NavLink>
                    <NavLink href="/app/calculateur" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Calculateur</NavLink>
                    <NavLink href="/app/photos" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Photos</NavLink>
                    <NavLink href="/app/signature" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Signatures</NavLink>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 py-2">
                    <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Communication</p>
                    <NavLink href="/app/chat" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Messages</NavLink>
                    <NavLink href="/app/fidelite" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Fidélité</NavLink>
                    <NavLink href="/app/equipe" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Équipe</NavLink>
                    <NavLink href="/app/activite" className="block px-4 py-2 hover:bg-orange-50 dark:hover:bg-orange-900/20">Activité</NavLink>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions avec raccourci clavier visible */}
            <div className="flex items-center gap-2 md:gap-3">
              <SearchButton />
              <div className="hidden md:flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <kbd className="font-sans">⌘</kbd>
                <kbd className="font-sans">K</kbd>
              </div>
              <ThemeToggle />
              <UserMenu userEmail={user.email || ''} />
              <NotificationBell />
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu avec AppShell (breadcrumbs, FAB, toasts) */}
      <main className="dark:bg-gray-900 transition-colors">
        <AppShell>{children}</AppShell>
      </main>
    </div>
  )
}
