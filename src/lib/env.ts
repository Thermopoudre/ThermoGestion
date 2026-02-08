import { z } from 'zod'

/**
 * Schéma de validation des variables d'environnement.
 * Vérifie que toutes les variables nécessaires sont présentes et correctement formatées.
 */
const envSchema = z.object({
  // ─── Supabase (obligatoire) ───
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL doit être une URL valide'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY est requis'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY est requis'),

  // ─── Application ───
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL doit être une URL valide')
    .default('http://localhost:3000'),

  // ─── Stripe (obligatoire en production) ───
  STRIPE_SECRET_KEY: z
    .string()
    .optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .optional(),
  STRIPE_PRICE_LITE: z
    .string()
    .optional(),
  STRIPE_PRICE_PRO: z
    .string()
    .optional(),

  // ─── Email (Resend) ───
  RESEND_API_KEY: z
    .string()
    .optional(),
  EMAIL_FROM: z
    .string()
    .email()
    .optional()
    .default('noreply@thermogestion.fr'),

  // ─── Cron Jobs ───
  CRON_SECRET: z
    .string()
    .optional(),

  // ─── Superadmin ───
  SUPERADMIN_EMAILS: z
    .string()
    .optional()
    .describe('Emails séparés par des virgules des superadmins'),

  // ─── Node environment ───
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Variables d'environnement validées et typées.
 * En production, lance une erreur si les variables obligatoires sont manquantes.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const errorMessages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n')

    // En production, on logue l'erreur clairement
    console.error(
      `\n❌ Variables d'environnement invalides:\n${errorMessages}\n`
    )

    // En production, ne pas crasher le build (certaines var sont optionnelles)
    // mais avertir clairement
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️  Certaines variables d\'environnement sont manquantes. Certaines fonctionnalités pourraient ne pas fonctionner.'
      )
    }
  }

  // Retourner les valeurs parsées (avec defaults appliqués) même en cas d'erreur partielle
  return (result.success ? result.data : envSchema.parse({
    ...process.env,
  })) as Env
}

// Singleton - validé une seule fois au démarrage
let _env: Env | null = null

export function getEnv(): Env {
  if (!_env) {
    try {
      _env = validateEnv()
    } catch {
      // Fallback pour le build time où certaines variables ne sont pas dispo
      _env = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        STRIPE_PRICE_LITE: process.env.STRIPE_PRICE_LITE,
        STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@thermogestion.fr',
        CRON_SECRET: process.env.CRON_SECRET,
        SUPERADMIN_EMAILS: process.env.SUPERADMIN_EMAILS,
        NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      }
    }
  }
  return _env
}

/**
 * Vérifie si un email est celui d'un superadmin.
 */
export function isSuperAdmin(email: string): boolean {
  const env = getEnv()
  if (!env.SUPERADMIN_EMAILS) return false
  const adminEmails = env.SUPERADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase())
  return adminEmails.includes(email.toLowerCase())
}

/**
 * Vérifie si Stripe est configuré.
 */
export function isStripeConfigured(): boolean {
  const env = getEnv()
  return !!(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
}

/**
 * Vérifie si le service d'email est configuré.
 */
export function isEmailConfigured(): boolean {
  const env = getEnv()
  return !!env.RESEND_API_KEY
}
