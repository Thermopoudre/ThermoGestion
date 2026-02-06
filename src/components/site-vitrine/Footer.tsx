'use client'

import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer id="contact" className="bg-gray-950 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <Image
                  src="/logo.svg"
                  alt="ThermoGestion"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <span className="text-white font-bold text-xl">
                Thermo<span className="text-orange-400">Gestion</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              Logiciel SaaS professionnel pour ateliers de thermolaquage. Simplifiez votre gestion, optimisez votre production, facturez vos clients.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-orange-600 rounded-lg flex items-center justify-center transition-colors text-white"
                aria-label="Facebook"
              >
                f
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-orange-600 rounded-lg flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                in
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-orange-600 rounded-lg flex items-center justify-center transition-colors"
                aria-label="YouTube"
              >
                ▶
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/fonctionnalites" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link href="/tarifs" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/temoignages" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Témoignages
                </Link>
              </li>
              <li>
                <Link href="/aide" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Aide
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>📧 contact@thermogestion.fr</li>
              <li>📞 06 74 92 19 75</li>
              <li>📍 120 PLACE DES PALMIERS, 83150 BANDOL, France</li>
            </ul>
            <h4 className="text-white font-bold mb-4 mt-6">Légal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/cgu" className="text-gray-400 hover:text-orange-400 transition-colors">
                  CGU
                </Link>
              </li>
              <li>
                <Link href="/cgv" className="text-gray-400 hover:text-orange-400 transition-colors">
                  CGV
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-gray-400 hover:text-orange-400 transition-colors">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">© 2026 ThermoGestion. Tous droits réservés.</p>
          <div className="flex gap-4 text-sm">
            <Link href="/cgu" className="text-gray-500 hover:text-gray-400 transition-colors">
              CGU
            </Link>
            <Link href="/cgv" className="text-gray-500 hover:text-gray-400 transition-colors">
              CGV
            </Link>
            <Link href="/confidentialite" className="text-gray-500 hover:text-gray-400 transition-colors">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
