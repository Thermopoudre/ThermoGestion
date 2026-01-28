import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Home, Package, FileText, Receipt, User, LogOut, Send } from 'lucide-react'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si pas connecté et pas sur une page auth, rediriger
  // Note: les pages auth ont leur propre layout

  // Récupérer infos client si connecté
  let clientInfo = null
  let atelierInfo = null
  
  if (user) {
    const { data: clientUser } = await supabase
      .from('client_users')
      .select(`
        client_id,
        atelier_id,
        clients (full_name, email),
        ateliers (name, phone)
      `)
      .eq('id', user.id)
      .single()
    
    if (clientUser) {
      clientInfo = clientUser.clients
      atelierInfo = clientUser.ateliers
    }
  }

  // Si on est sur une page auth, afficher sans la nav
  const isAuthPage = true // Le middleware gère ça

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/client/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🔥</span>
              </div>
              <span className="font-bold text-gray-900">
                Espace <span className="text-orange-500">Client</span>
              </span>
            </Link>

            {/* Navigation */}
            {user && clientInfo && (
              <nav className="hidden md:flex items-center gap-6">
                <Link 
                  href="/client/dashboard" 
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Tableau de bord
                </Link>
                <Link 
                  href="/client/projets" 
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Mes projets
                </Link>
                <Link 
                  href="/client/devis" 
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Devis
                </Link>
                <Link 
                  href="/client/factures" 
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  Factures
                </Link>
                <Link 
                  href="/client/demande-devis" 
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Demander un devis
                </Link>
              </nav>
            )}

            {/* User menu */}
            {user && clientInfo && (
              <div className="flex items-center gap-4">
                <Link 
                  href="/client/profil"
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-500"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{(clientInfo as any)?.full_name}</span>
                </Link>
                <form action="/auth/logout" method="POST">
                  <button 
                    type="submit"
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Déconnexion"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {user && clientInfo && (
          <div className="md:hidden border-t border-gray-100 px-4 py-2 flex gap-4 overflow-x-auto">
            <Link href="/client/dashboard" className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
              <Home className="w-4 h-4" /> Accueil
            </Link>
            <Link href="/client/projets" className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
              <Package className="w-4 h-4" /> Projets
            </Link>
            <Link href="/client/factures" className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
              <Receipt className="w-4 h-4" /> Factures
            </Link>
            <Link href="/client/demande-devis" className="flex items-center gap-1 text-sm text-orange-500 whitespace-nowrap">
              <Send className="w-4 h-4" /> Devis
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      {user && atelierInfo && (
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <p>
                Votre atelier : <strong className="text-gray-900">{(atelierInfo as any)?.name}</strong>
                {(atelierInfo as any)?.phone && (
                  <> • <a href={`tel:${(atelierInfo as any).phone}`} className="text-orange-500 hover:underline">{(atelierInfo as any).phone}</a></>
                )}
              </p>
              <p>Powered by ThermoGestion</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
