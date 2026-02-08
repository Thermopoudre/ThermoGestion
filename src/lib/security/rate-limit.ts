/**
 * Rate Limiter compatible serverless (Vercel)
 * 
 * Utilise Supabase comme store persistant au lieu de Map en mémoire.
 * Fallback sur Map en mémoire si la table n'existe pas.
 * 
 * Usage :
 *   const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })
 *   const result = await limiter.check(identifier)
 *   if (!result.allowed) return Response 429
 */

import { createClient } from '@supabase/supabase-js'

interface RateLimitConfig {
  /** Nombre max de tentatives dans la fenêtre */
  maxAttempts: number
  /** Durée de la fenêtre en millisecondes */
  windowMs: number
  /** Identifiant du limiteur (pour distinguer les endpoints) */
  name: string
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

// Fallback en mémoire (fonctionnel mais reset à chaque cold start)
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function checkMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxAttempts - 1, resetAt: new Date(now + config.windowMs) }
  }

  entry.count++
  if (entry.count > config.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.resetAt) }
  }

  return { allowed: true, remaining: config.maxAttempts - entry.count, resetAt: new Date(entry.resetAt) }
}

/**
 * Rate limiter via Supabase (serverless-compatible)
 * Utilise un RPC Supabase pour l'atomicité
 */
async function checkSupabase(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return checkMemory(key, config)
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: `${config.name}:${key}`,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: Math.ceil(config.windowMs / 1000),
    })

    if (error) {
      // Fallback en mémoire si la fonction n'existe pas
      console.warn('Rate limit RPC error, falling back to memory:', error.message)
      return checkMemory(key, config)
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: new Date(data.reset_at),
    }
  } catch {
    return checkMemory(key, config)
  }
}

export function createRateLimiter(config: RateLimitConfig) {
  return {
    /**
     * Vérifier si une requête est autorisée
     * @param identifier - IP, user ID, ou autre identifiant unique
     */
    check: (identifier: string): Promise<RateLimitResult> => {
      return checkSupabase(identifier, config)
    },
  }
}

// Limiteurs pré-configurés
export const authLimiter = createRateLimiter({
  name: 'auth',
  maxAttempts: 5,
  windowMs: 15 * 60_000, // 5 tentatives / 15 min
})

export const paymentLimiter = createRateLimiter({
  name: 'payment',
  maxAttempts: 5,
  windowMs: 60_000, // 5 tentatives / minute
})

export const apiLimiter = createRateLimiter({
  name: 'api',
  maxAttempts: 60,
  windowMs: 60_000, // 60 req / minute
})

/**
 * Extraire l'IP d'une requête Next.js
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
