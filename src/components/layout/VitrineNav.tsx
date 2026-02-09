import Link from 'next/link'

export function VitrineNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-orange-500/30">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg sm:text-xl">🔥</span>
          </div>
          <span className="text-white font-bold text-lg sm:text-xl">Thermo<span className="text-orange-400">Gestion</span></span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1">
          <Link href="/" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium">Accueil</Link>
          <Link href="/fonctionnalites" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium">Fonctionnalites</Link>
          <Link href="/tarifs" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium">Tarifs</Link>
          <Link href="/temoignages" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium">Temoignages</Link>
          <Link href="/aide" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium">Aide</Link>
          <Link href="/contact" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium">Contact</Link>
        </nav>
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/auth/inscription" className="px-4 sm:px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg hover:from-orange-400 hover:to-red-500 transition-all text-sm sm:text-base">Essai gratuit</Link>
          <Link href="/auth/login" className="px-4 py-2 text-white hover:text-orange-400 transition-colors font-medium text-sm sm:text-base">Connexion</Link>
        </div>
      </div>
    </header>
  )
}

export function VitrineFooter() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 py-12 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black">🔥</span>
            </div>
            <span className="text-white font-bold">Thermo<span className="text-orange-400">Gestion</span></span>
          </div>
          <p className="text-sm text-gray-500">Logiciel de gestion pour ateliers de thermolaquage.</p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 text-sm">Navigation</h4>
          <div className="space-y-2">
            <Link href="/" className="block text-sm text-gray-400 hover:text-orange-400">Accueil</Link>
            <Link href="/fonctionnalites" className="block text-sm text-gray-400 hover:text-orange-400">Fonctionnalites</Link>
            <Link href="/tarifs" className="block text-sm text-gray-400 hover:text-orange-400">Tarifs</Link>
            <Link href="/blog" className="block text-sm text-gray-400 hover:text-orange-400">Blog</Link>
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 text-sm">Contact</h4>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">contact@thermogestion.fr</p>
            <Link href="/contact" className="block text-sm text-gray-400 hover:text-orange-400">Formulaire</Link>
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold mb-3 text-sm">Legal</h4>
          <div className="space-y-2">
            <Link href="/cgu" className="block text-sm text-gray-400 hover:text-orange-400">CGU</Link>
            <Link href="/cgv" className="block text-sm text-gray-400 hover:text-orange-400">CGV</Link>
            <Link href="/confidentialite" className="block text-sm text-gray-400 hover:text-orange-400">Confidentialite</Link>
            <Link href="/mentions-legales" className="block text-sm text-gray-400 hover:text-orange-400">Mentions legales</Link>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-800 text-center text-sm text-gray-600">
        &copy; {new Date().getFullYear()} ThermoGestion. Tous droits reserves.
      </div>
    </footer>
  )
}
