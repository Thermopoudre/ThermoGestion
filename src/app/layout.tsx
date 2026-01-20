import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ThermoGestion - Gestion professionnelle pour ateliers de thermolaquage',
  description: 'Logiciel SaaS complet pour créer des devis, suivre vos projets, gérer votre stock et facturer vos clients.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
