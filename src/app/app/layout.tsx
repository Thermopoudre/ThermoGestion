import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SearchButton } from '@/components/search/SearchButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { MobileNav } from '@/components/navigation/MobileNav'
import { NavLink } from '@/components/navigation/NavLink'
import { UserMenu } from '@/components/navigation/UserMenu'

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
            <div className="hidden lg:flex items-center gap-5 ml-8">
              <NavLink href="/app/dashboard">Dashboard</NavLink>
              <NavLink href="/app/clients">Clients</NavLink>
              <NavLink href="/app/projets">Projets</NavLink>
              <NavLink href="/app/devis">Devis</NavLink>
              <NavLink href="/app/poudres">Poudres</NavLink>
              <NavLink href="/app/series">Séries</NavLink>
              <NavLink href="/app/factures">Factures</NavLink>
              <NavLink href="/app/planning">Planning</NavLink>
              <NavLink href="/app/stats">Stats</NavLink>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-3">
              <SearchButton />
              <ThemeToggle />
              <UserMenu userEmail={user.email || ''} />
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <main className="dark:bg-gray-900 transition-colors">{children}</main>
    </div>
  )
}
