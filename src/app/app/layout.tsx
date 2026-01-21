import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PushNotificationButton } from '@/components/notifications/PushNotificationButton'
import { SearchButton } from '@/components/search/SearchButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { MobileNav } from '@/components/navigation/MobileNav'

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
            <div className="hidden lg:flex items-center gap-4">
              <a href="/app/dashboard" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Dashboard
              </a>
              <a href="/app/clients" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Clients
              </a>
              <a href="/app/projets" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Projets
              </a>
              <a href="/app/devis" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Devis
              </a>
              <a href="/app/poudres" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                🎨 Poudres
              </a>
              <a href="/app/series" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Séries
              </a>
              <a href="/app/factures" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                Factures
              </a>
              <a href="/app/planning" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                📅
              </a>
              <a href="/app/stats" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                📊
              </a>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              <SearchButton />
              <PushNotificationButton />
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden xl:inline truncate max-w-[150px]">{user.email}</span>
              <a
                href="/app/parametres"
                className="hidden md:block text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                title="Paramètres"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </a>
              <form action="/auth/logout" method="POST" className="hidden md:inline">
                <button
                  type="submit"
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <main className="dark:bg-gray-900 transition-colors">{children}</main>
    </div>
  )
}
