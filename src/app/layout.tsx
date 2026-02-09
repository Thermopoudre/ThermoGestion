import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { CookieBanner } from '@/components/ui/CookieBanner'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'ThermoGestion - Gestion professionnelle pour ateliers de thermolaquage',
    template: '%s | ThermoGestion',
  },
  description: 'Logiciel SaaS complet pour créer des devis, suivre vos projets, gérer votre stock et facturer vos clients.',
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: 'ThermoGestion - Gestion professionnelle pour ateliers de thermolaquage',
    description: 'Logiciel SaaS complet pour créer des devis, suivre vos projets, gérer votre stock et facturer vos clients.',
    url: BASE_URL,
    siteName: 'ThermoGestion',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ThermoGestion',
    description: 'Gestion professionnelle pour ateliers de thermolaquage',
  },
  icons: {
    icon: [
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {/* Skip to content — Accessibilité RGAA */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-6 focus:py-3 focus:bg-orange-500 focus:text-white focus:rounded-lg focus:font-bold focus:shadow-xl focus:outline-none"
          >
            Aller au contenu principal
          </a>
          <main id="main-content">
            {children}
          </main>
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  )
}
