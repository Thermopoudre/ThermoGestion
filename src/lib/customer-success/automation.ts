/**
 * Customer Success Automation
 * 
 * Automatisations pour:
 * - Onboarding : emails de bienvenue, tutoriels, suivi
 * - Engagement : alertes inactivité, suggestions fonctionnalités
 * - Rétention : détection churn, offres spéciales
 * - Upsell : recommandations plan Pro
 */

import { createServerClient } from '@/lib/supabase/server'

// ==========================================
// Types
// ==========================================

interface CSEvent {
  type: CSEventType
  userId: string
  atelierId: string
  metadata?: Record<string, any>
}

type CSEventType = 
  | 'user_signup'
  | 'onboarding_step_completed'
  | 'first_project_created'
  | 'first_invoice_sent'
  | 'subscription_started'
  | 'inactive_7_days'
  | 'inactive_14_days'
  | 'inactive_30_days'
  | 'trial_expiring_3_days'
  | 'trial_expiring_1_day'
  | 'subscription_cancelled'
  | 'high_usage'
  | 'feature_limit_reached'

// ==========================================
// Triggers automatiques
// ==========================================

const CS_AUTOMATIONS: Record<CSEventType, {
  action: string
  emailTemplate?: string
  delay?: number // minutes
}> = {
  user_signup: {
    action: 'send_welcome_email',
    emailTemplate: 'welcome',
    delay: 0,
  },
  onboarding_step_completed: {
    action: 'check_next_step',
    delay: 0,
  },
  first_project_created: {
    action: 'send_congrats_email',
    emailTemplate: 'first_project',
    delay: 5,
  },
  first_invoice_sent: {
    action: 'send_milestone_email',
    emailTemplate: 'first_invoice',
    delay: 10,
  },
  subscription_started: {
    action: 'send_pro_welcome',
    emailTemplate: 'pro_welcome',
    delay: 0,
  },
  inactive_7_days: {
    action: 'send_reengagement_email',
    emailTemplate: 'inactive_7d',
    delay: 0,
  },
  inactive_14_days: {
    action: 'send_reengagement_email',
    emailTemplate: 'inactive_14d',
    delay: 0,
  },
  inactive_30_days: {
    action: 'send_final_warning_email',
    emailTemplate: 'inactive_30d',
    delay: 0,
  },
  trial_expiring_3_days: {
    action: 'send_trial_reminder',
    emailTemplate: 'trial_3d',
    delay: 0,
  },
  trial_expiring_1_day: {
    action: 'send_trial_urgent',
    emailTemplate: 'trial_1d',
    delay: 0,
  },
  subscription_cancelled: {
    action: 'send_exit_survey',
    emailTemplate: 'cancellation',
    delay: 60, // 1 heure après
  },
  high_usage: {
    action: 'suggest_upgrade',
    emailTemplate: 'upsell_pro',
    delay: 1440, // 24h après
  },
  feature_limit_reached: {
    action: 'suggest_upgrade',
    emailTemplate: 'feature_limit',
    delay: 0,
  },
}

// ==========================================
// Fonctions principales
// ==========================================

/**
 * Déclencher une automation CS
 */
export async function triggerCSEvent(event: CSEvent): Promise<void> {
  const automation = CS_AUTOMATIONS[event.type]
  if (!automation) return

  console.log(`[CS] Event: ${event.type} for user ${event.userId}`)

  // En production, on mettrait ceci dans une file d'attente (queue)
  // Pour le MVP, on exécute directement
  try {
    if (automation.emailTemplate) {
      await queueCSEmail(event.userId, automation.emailTemplate, automation.delay || 0, event.metadata)
    }
  } catch (error) {
    console.error(`[CS] Error processing event ${event.type}:`, error)
  }
}

/**
 * Mettre un email CS en file d'attente
 */
async function queueCSEmail(
  userId: string, 
  template: string, 
  delayMinutes: number,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = await createServerClient()
  
  const { data: user } = await supabase
    .from('users')
    .select('email, full_name, atelier_id')
    .eq('id', userId)
    .single()
  
  if (!user?.email) return

  const scheduledAt = new Date()
  scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes)

  // Vérifier qu'on n'a pas déjà envoyé ce template récemment
  const { data: recentEmails } = await supabase
    .from('email_queue')
    .select('id')
    .eq('recipient', user.email)
    .eq('template', `cs_${template}`)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
  
  if (recentEmails && recentEmails.length > 0) {
    console.log(`[CS] Email ${template} already sent to ${user.email} in last 24h, skipping`)
    return
  }

  // Ajouter à la file d'attente email
  await supabase.from('email_queue').insert({
    recipient: user.email,
    subject: getCSEmailSubject(template),
    template: `cs_${template}`,
    variables: {
      user_name: user.full_name || 'Utilisateur',
      ...metadata,
    },
    scheduled_at: scheduledAt.toISOString(),
    status: 'pending',
  })
}

// ==========================================
// Templates email CS
// ==========================================

function getCSEmailSubject(template: string): string {
  const subjects: Record<string, string> = {
    welcome: 'Bienvenue sur ThermoGestion !',
    first_project: 'Bravo pour votre premier projet !',
    first_invoice: 'Votre première facture est envoyée !',
    pro_welcome: 'Bienvenue dans le plan Pro !',
    inactive_7d: 'Votre atelier vous attend sur ThermoGestion',
    inactive_14d: 'Des nouveautés vous attendent sur ThermoGestion',
    inactive_30d: 'Nous avons remarqué votre absence...',
    trial_3d: 'Votre essai gratuit se termine dans 3 jours',
    trial_1d: 'Dernier jour de votre essai gratuit !',
    cancellation: 'Nous sommes tristes de vous voir partir',
    upsell_pro: 'Passez au plan Pro pour aller plus loin',
    feature_limit: 'Vous avez atteint la limite de votre plan',
  }
  return subjects[template] || 'ThermoGestion - Notification'
}

// ==========================================
// Détection d'inactivité (cron job)
// ==========================================

/**
 * Vérifier les utilisateurs inactifs et déclencher les automations
 * Appelé par un cron job quotidien
 */
export async function checkInactiveUsers(): Promise<{
  inactive7: number
  inactive14: number
  inactive30: number
}> {
  const supabase = await createServerClient()
  
  const now = new Date()
  const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
  const d14 = new Date(now); d14.setDate(d14.getDate() - 14)
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30)

  const stats = { inactive7: 0, inactive14: 0, inactive30: 0 }

  // Utilisateurs inactifs depuis 7 jours (mais pas 14)
  const { data: users7 } = await supabase
    .from('users')
    .select('id, atelier_id')
    .lt('last_seen_at', d7.toISOString())
    .gte('last_seen_at', d14.toISOString())
  
  for (const user of users7 || []) {
    await triggerCSEvent({ type: 'inactive_7_days', userId: user.id, atelierId: user.atelier_id })
    stats.inactive7++
  }

  // Inactifs depuis 14 jours (mais pas 30)
  const { data: users14 } = await supabase
    .from('users')
    .select('id, atelier_id')
    .lt('last_seen_at', d14.toISOString())
    .gte('last_seen_at', d30.toISOString())
  
  for (const user of users14 || []) {
    await triggerCSEvent({ type: 'inactive_14_days', userId: user.id, atelierId: user.atelier_id })
    stats.inactive14++
  }

  // Inactifs depuis 30 jours
  const { data: users30 } = await supabase
    .from('users')
    .select('id, atelier_id')
    .lt('last_seen_at', d30.toISOString())
  
  for (const user of users30 || []) {
    await triggerCSEvent({ type: 'inactive_30_days', userId: user.id, atelierId: user.atelier_id })
    stats.inactive30++
  }

  return stats
}

// ==========================================
// Health Score utilisateur
// ==========================================

/**
 * Calcule un score de santé client (0-100)
 * Basé sur l'activité, l'engagement et l'utilisation
 */
export async function calculateHealthScore(atelierId: string): Promise<{
  score: number
  factors: Record<string, number>
  risk: 'low' | 'medium' | 'high'
}> {
  const supabase = await createServerClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Facteurs de scoring
  const factors: Record<string, number> = {}

  // 1. Connexions récentes (0-20 pts)
  const { count: logins } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('atelier_id', atelierId)
    .gte('last_seen_at', thirtyDaysAgo.toISOString())
  factors.connexions = Math.min((logins || 0) * 5, 20)

  // 2. Projets créés (0-25 pts)
  const { count: projets } = await supabase
    .from('projets')
    .select('*', { count: 'exact', head: true })
    .eq('atelier_id', atelierId)
    .gte('created_at', thirtyDaysAgo.toISOString())
  factors.projets = Math.min((projets || 0) * 5, 25)

  // 3. Devis envoyés (0-20 pts)
  const { count: devis } = await supabase
    .from('devis')
    .select('*', { count: 'exact', head: true })
    .eq('atelier_id', atelierId)
    .gte('created_at', thirtyDaysAgo.toISOString())
  factors.devis = Math.min((devis || 0) * 5, 20)

  // 4. Factures payées (0-20 pts)
  const { count: factures } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true })
    .eq('atelier_id', atelierId)
    .eq('status', 'payee')
    .gte('created_at', thirtyDaysAgo.toISOString())
  factors.factures = Math.min((factures || 0) * 5, 20)

  // 5. Fonctionnalités utilisées (0-15 pts)
  // On estime par le nombre de tables avec des données récentes
  let featureCount = 0
  const tables = ['consommables', 'maintenance_equipements', 'objectifs_journaliers', 'pesees_stock']
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('atelier_id', atelierId)
      .limit(1)
    if (count && count > 0) featureCount++
  }
  factors.features = Math.min(featureCount * 4, 15)

  const score = Object.values(factors).reduce((a, b) => a + b, 0)
  const risk = score >= 60 ? 'low' : score >= 30 ? 'medium' : 'high'

  return { score, factors, risk }
}
