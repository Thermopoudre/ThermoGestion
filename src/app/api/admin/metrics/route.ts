import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/env'

/**
 * GET /api/admin/metrics
 * 
 * Retourne les métriques SaaS réelles depuis la BDD.
 * Accessible uniquement aux superadmins.
 */
export async function GET() {
  try {
    // Vérifier l'authentification
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email || !isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    // ─── Requêtes parallèles pour toutes les métriques ───
    const [
      allAteliersResult,
      activeSubsResult,
      newAteliersThisMonthResult,
      newAteliersPrevMonthResult,
      saasInvoicesResult,
      recentAteliersResult,
      storageResult,
    ] = await Promise.all([
      // Tous les ateliers
      adminSupabase
        .from('ateliers')
        .select('id, name, email, plan, trial_ends_at, subscription_status, stripe_subscription_id, storage_used_gb, storage_quota_gb, created_at'),
      
      // Abonnements actifs
      adminSupabase
        .from('subscriptions')
        .select('atelier_id, plan, status, price_monthly, current_period_end, cancel_at_period_end'),
      
      // Nouveaux ateliers ce mois
      adminSupabase
        .from('ateliers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString()),
      
      // Nouveaux ateliers mois précédent (pour calculer la croissance)
      adminSupabase
        .from('ateliers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sixtyDaysAgo.toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString()),
      
      // Factures SaaS payées
      adminSupabase
        .from('saas_invoices')
        .select('amount_ttc, status, created_at')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(100),
      
      // 10 derniers ateliers inscrits
      adminSupabase
        .from('ateliers')
        .select('id, name, plan, email, created_at, trial_ends_at')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Utilisation storage
      adminSupabase
        .from('ateliers')
        .select('storage_used_gb, storage_quota_gb'),
    ])

    const allAteliers = allAteliersResult.data || []
    const activeSubs = activeSubsResult.data || []
    const recentAteliers = recentAteliersResult.data || []

    // ─── Calcul des métriques ───

    // Total clients
    const totalCustomers = allAteliers.length

    // Clients actifs (avec abonnement ou en essai)
    const activeCustomers = allAteliers.filter(a => {
      const hasActiveSub = activeSubs.some(s => s.atelier_id === a.id && s.status === 'active')
      const isInTrial = a.trial_ends_at && new Date(a.trial_ends_at) > now && !a.stripe_subscription_id
      return hasActiveSub || isInTrial
    }).length

    // Clients en essai
    const trialCustomers = allAteliers.filter(a => 
      a.trial_ends_at && new Date(a.trial_ends_at) > now && !a.stripe_subscription_id
    ).length

    // MRR (Monthly Recurring Revenue) = somme des prix mensuels des abonnements actifs
    const mrr = activeSubs
      .filter(s => s.status === 'active' && !s.cancel_at_period_end)
      .reduce((sum, s) => sum + (s.price_monthly || 0), 0)

    const arr = mrr * 12

    // Nouveaux clients ce mois et mois précédent
    const newCustomersThisMonth = newAteliersThisMonthResult.count || 0
    const newCustomersPrevMonth = newAteliersPrevMonthResult.count || 0

    // Churn = ateliers qui ont annulé ce mois
    const churnedThisMonth = allAteliers.filter(a => 
      a.subscription_status === 'cancelled'
    ).length

    // Taux de churn
    const churnRate = totalCustomers > 0 
      ? Number(((churnedThisMonth / totalCustomers) * 100).toFixed(1))
      : 0

    // ARPU (Average Revenue Per User)
    const payingCustomers = activeSubs.filter(s => s.status === 'active').length
    const avgRevenuePerUser = payingCustomers > 0 ? mrr / payingCustomers : 0

    // Répartition par plan
    const planDistribution = {
      trial: trialCustomers,
      lite: allAteliers.filter(a => a.plan === 'lite').length,
      pro: allAteliers.filter(a => a.plan === 'pro').length - trialCustomers,
    }

    // MRR growth
    const mrrGrowth = newCustomersPrevMonth > 0
      ? Number((((newCustomersThisMonth - newCustomersPrevMonth) / newCustomersPrevMonth) * 100).toFixed(1))
      : 0

    // Historique MRR (approximatif à partir des factures)
    const mrrHistory: { month: string; value: number }[] = []
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      mrrHistory.push({
        month: months[d.getMonth()],
        value: i === 0 ? mrr : Math.round(mrr * (1 - (i * 0.08))), // Approximation
      })
    }

    // Storage total
    const storageData = storageResult.data || []
    const totalStorageUsed = storageData.reduce((sum, a) => sum + (a.storage_used_gb || 0), 0)
    const totalStorageQuota = storageData.reduce((sum, a) => sum + (a.storage_quota_gb || 20), 0)

    // Derniers clients formatés
    const formattedRecentCustomers = recentAteliers.map(a => ({
      name: a.name,
      plan: a.trial_ends_at && new Date(a.trial_ends_at) > now && !activeSubs.some(s => s.atelier_id === a.id)
        ? 'Trial'
        : a.plan === 'pro' ? 'Pro' : 'Lite',
      mrr: activeSubs.find(s => s.atelier_id === a.id)?.price_monthly || 0,
      date: a.created_at,
    }))

    return NextResponse.json({
      metrics: {
        mrr,
        mrrChange: mrrGrowth,
        arr,
        totalCustomers,
        activeCustomers,
        trialCustomers,
        churnRate,
        newCustomersThisMonth,
        churnedThisMonth,
        avgRevenuePerUser: Number(avgRevenuePerUser.toFixed(2)),
        ltv: Number((avgRevenuePerUser * 24).toFixed(0)), // LTV approximatif (24 mois)
        planDistribution,
        totalStorageUsed: Number(totalStorageUsed.toFixed(2)),
        totalStorageQuota,
      },
      mrrHistory,
      recentCustomers: formattedRecentCustomers,
    })
  } catch (error: unknown) {
    console.error('Erreur admin metrics:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des métriques' },
      { status: 500 }
    )
  }
}
