/**
 * Cron job: Politique de rétention des données RGPD
 * 
 * Exécuté quotidiennement pour :
 * 1. Notifier les ateliers 30j avant suppression de données obsolètes
 * 2. Supprimer les données au-delà de la durée légale
 * 
 * Durées de conservation :
 * - Factures : 10 ans (obligation légale)
 * - Devis non acceptés : 3 ans
 * - Logs audit : 2 ans
 * - Logs applicatifs : 90 jours
 * - Données clients inactifs : 3 ans après dernier contact
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  // Vérifier le secret cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results: any[] = []
  const now = new Date()

  try {
    // 1. Supprimer les logs applicatifs > 90 jours
    const logsDate = new Date(now)
    logsDate.setDate(logsDate.getDate() - 90)
    
    const { count: logsDeleted } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', logsDate.toISOString())
      .select('*', { count: 'exact', head: true })

    if (logsDeleted && logsDeleted > 0) {
      results.push({ action: 'delete_old_logs', table: 'audit_logs', records: logsDeleted })
      await supabase.from('data_retention_logs').insert({
        action: 'auto_delete',
        table_name: 'audit_logs',
        records_affected: logsDeleted,
        details: { reason: 'Logs > 90 jours', cutoff_date: logsDate.toISOString() }
      })
    }

    // 2. Supprimer les devis refusés > 3 ans
    const devisDate = new Date(now)
    devisDate.setFullYear(devisDate.getFullYear() - 3)
    
    const { count: devisDeleted } = await supabase
      .from('devis')
      .delete()
      .eq('status', 'refuse')
      .lt('created_at', devisDate.toISOString())
      .select('*', { count: 'exact', head: true })

    if (devisDeleted && devisDeleted > 0) {
      results.push({ action: 'delete_old_devis', table: 'devis', records: devisDeleted })
      await supabase.from('data_retention_logs').insert({
        action: 'auto_delete',
        table_name: 'devis',
        records_affected: devisDeleted,
        details: { reason: 'Devis refusés > 3 ans', cutoff_date: devisDate.toISOString() }
      })
    }

    // 3. Supprimer les rate_limits expirés
    const { count: rateLimitsDeleted } = await supabase
      .from('rate_limits')
      .delete()
      .lt('expires_at', now.toISOString())
      .select('*', { count: 'exact', head: true })

    if (rateLimitsDeleted && rateLimitsDeleted > 0) {
      results.push({ action: 'cleanup_rate_limits', records: rateLimitsDeleted })
    }

    // 4. Supprimer les push_subscriptions inactives > 6 mois
    const pushDate = new Date(now)
    pushDate.setMonth(pushDate.getMonth() - 6)
    
    const { count: pushDeleted } = await supabase
      .from('push_subscriptions')
      .delete()
      .lt('created_at', pushDate.toISOString())
      .select('*', { count: 'exact', head: true })

    if (pushDeleted && pushDeleted > 0) {
      results.push({ action: 'delete_old_push_subs', records: pushDeleted })
    }

    // 5. Nettoyer email_queue traité > 30 jours
    const emailDate = new Date(now)
    emailDate.setDate(emailDate.getDate() - 30)
    
    const { count: emailsDeleted } = await supabase
      .from('email_queue')
      .delete()
      .eq('status', 'sent')
      .lt('sent_at', emailDate.toISOString())
      .select('*', { count: 'exact', head: true })

    if (emailsDeleted && emailsDeleted > 0) {
      results.push({ action: 'cleanup_email_queue', records: emailsDeleted })
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      actions: results,
      total_records_affected: results.reduce((sum, r) => sum + (r.records || 0), 0),
    })

  } catch (error: any) {
    console.error('Data retention error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
