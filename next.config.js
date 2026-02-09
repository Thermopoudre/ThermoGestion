const { withSentryConfig } = require('@sentry/nextjs')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // TODO: Résoudre les erreurs de types Supabase strictes (deep instantiation)
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  // ── Headers de sécurité (OWASP / conformité EU) ──────────────
  async headers() {
    return [
      {
        // Appliquer à toutes les routes
        source: '/:path*',
        headers: [
          // Empêcher le clickjacking (iframe)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêcher le MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Forcer HTTPS (HSTS) — 1 an, incluant sous-domaines
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Contrôle du Referrer envoyé
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactiver les fonctionnalités navigateur non utilisées
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
          // Protection XSS legacy (navigateurs anciens)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Empêcher la détection du serveur
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Content Security Policy — stricte mais compatible
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

// Wrapping conditionnel : Bundle Analyzer + Sentry
const withAnalysis = withBundleAnalyzer(nextConfig)

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(withAnalysis, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : withAnalysis
