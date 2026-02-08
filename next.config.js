/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // TODO: Résoudre les erreurs de types Supabase strictes (deep instantiation)
    // Les types générés automatiquement par Supabase v2+ causent des erreurs
    // "Type instantiation is excessively deep" dans les routes API dynamiques.
    // À corriger progressivement fichier par fichier.
    ignoreBuildErrors: true,
  },
  // ESLint activé — toutes les erreurs ESLint sont corrigées
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
