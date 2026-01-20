import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PushNotificationButton } from '@/components/notifications/PushNotificationButton'

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

  // Ne pas vérifier l'atelier ici pour éviter les boucles avec complete-profile
  // La vérification de l'atelier se fait dans chaque page individuellement
  // Note: complete-profile a son propre layout qui ne charge pas la navigation
  // Note: complete-profile a son propre layout qui n'affiche pas la navigation

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-sm">TG</span>
                </div>
                <a href="/app/dashboard" className="text-gray-900 font-bold text-lg">
                  Thermo<span className="text-blue-600">Gestion</span>
                </a>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <a
                  href="/app/dashboard"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Tableau de bord
                </a>
                <a
                  href="/app/clients"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Clients
                </a>
                <a
                  href="/app/projets"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Projets
                </a>
                <a
                  href="/app/devis"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Devis
                </a>
                <a
                  href="/app/devis/templates"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Templates
                </a>
                <a
                  href="/app/poudres"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Poudres
                </a>
                <a
                  href="/app/series"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Séries
                </a>
                <a
                  href="/app/factures"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Factures
                </a>
                <a
                  href="/app/retouches"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Retouches
                </a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <PushNotificationButton />
              <span className="text-sm text-gray-600 hidden md:inline">{user.email}</span>
              <form action="/auth/logout" method="POST" className="inline">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <main>{children}</main>
    </div>
  )
}
