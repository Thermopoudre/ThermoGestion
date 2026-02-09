import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'
const REMINDER_DAYS = [7, 3, 1] // J-7, J-3, J-1

export async function GET(request: Request) {
  try {
    // Vérifier le cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const supabase = createAdminClient()
    let sent = 0

    // Charger le template
    let template = ''
    try {
      template = readFileSync(
        join(process.cwd(), 'src/templates/email/rappel-fin-essai.html'),
        'utf-8'
      )
    } catch {
      console.error('Template rappel-fin-essai.html non trouvé')
      return NextResponse.json({ error: 'Template non trouvé' }, { status: 500 })
    }

    for (const daysLeft of REMINDER_DAYS) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + daysLeft)
      const dateStr = targetDate.toISOString().split('T')[0]

      // Ateliers dont l'essai se termine dans `daysLeft` jours
      const { data: ateliers } = await supabase
        .from('ateliers')
        .select('id, name, email, trial_ends_at')
        .gte('trial_ends_at', `${dateStr}T00:00:00`)
        .lt('trial_ends_at', `${dateStr}T23:59:59`)
        .is('stripe_subscription_id', null) // Pas encore abonné

      if (!ateliers || ateliers.length === 0) continue

      for (const atelier of ateliers) {
        // Stats de l'atelier
        const [devisCount, projetsCount, clientsCount] = await Promise.all([
          supabase.from('devis').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
          supabase.from('projets').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('atelier_id', atelier.id),
        ])

        const trialEndDate = new Date(atelier.trial_ends_at).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        })

        let html = template
          .replace(/\{\{ATELIER_NAME\}\}/g, atelier.name)
          .replace(/\{\{DAYS_LEFT\}\}/g, String(daysLeft))
          .replace(/\{\{TRIAL_END_DATE\}\}/g, trialEndDate)
          .replace(/\{\{APP_URL\}\}/g, APP_URL)
          .replace(/\{\{EMAIL\}\}/g, atelier.email || '')
          .replace(/\{\{NB_DEVIS\}\}/g, String(devisCount.count || 0))
          .replace(/\{\{NB_PROJETS\}\}/g, String(projetsCount.count || 0))
          .replace(/\{\{NB_CLIENTS\}\}/g, String(clientsCount.count || 0))

        // Gestion simple des blocs conditionnels
        const hasStats = (devisCount.count || 0) + (projetsCount.count || 0) + (clientsCount.count || 0) > 0
        if (hasStats) {
          html = html.replace(/\{\{#if STATS_BLOCK\}\}/g, '').replace(/\{\{\/if\}\}/g, '')
        } else {
          html = html.replace(/\{\{#if STATS_BLOCK\}\}[\s\S]*?\{\{\/if\}\}/g, '')
        }

        // Queue l'email
        await supabase.from('email_queue').insert({
          atelier_id: atelier.id,
          to_email: atelier.email,
          to_name: atelier.name,
          subject: daysLeft === 1
            ? `Dernier jour d'essai — ThermoGestion`
            : `Plus que ${daysLeft} jours d'essai gratuit — ThermoGestion`,
          html_content: html,
          status: 'pending',
        })

        sent++
      }
    }

    return NextResponse.json({ success: true, sent })
  } catch (error: any) {
    console.error('Erreur cron trial-reminder:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
