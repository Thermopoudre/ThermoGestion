import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/cron/trial-check
 * 
 * Cron job exécuté quotidiennement pour :
 * 1. Détecter les essais gratuits expirés
 * 2. Downgrader les ateliers sans abonnement actif vers le plan Lite
 * 3. Envoyer des notifications de rappel avant expiration (J-7, J-3, J-1)
 * 
 * Configuré dans vercel.json pour s'exécuter à 7h chaque jour.
 */
export async function GET(request: Request) {
  try {
    // Vérifier le secret CRON
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()
    const results = {
      expired: 0,
      reminded_j7: 0,
      reminded_j3: 0,
      reminded_j1: 0,
      errors: [] as string[],
    }

    // ─── 1. Essais expirés : downgrader vers Lite ───
    const { data: expiredTrials, error: expiredError } = await supabase
      .from('ateliers')
      .select('id, name, email, plan, trial_ends_at')
      .not('trial_ends_at', 'is', null)
      .lt('trial_ends_at', now.toISOString())
      .is('stripe_subscription_id', null) // Pas d'abonnement Stripe actif

    if (expiredError) {
      results.errors.push(`Erreur récupération essais expirés: ${expiredError.message}`)
    } else if (expiredTrials && expiredTrials.length > 0) {
      for (const atelier of expiredTrials) {
        try {
          // Downgrader vers Lite
          await supabase
            .from('ateliers')
            .update({
              plan: 'lite',
              subscription_status: 'expired',
            })
            .eq('id', atelier.id)

          // Mettre à jour la subscription
          await supabase.from('subscriptions').upsert({
            atelier_id: atelier.id,
            plan: 'lite',
            status: 'expired',
            price_monthly: 0,
          }, { onConflict: 'atelier_id' })

          // Créer une alerte
          await supabase.from('alertes').insert({
            atelier_id: atelier.id,
            type: 'trial_expired',
            titre: 'Votre essai gratuit est terminé',
            message: 'Votre période d\'essai de 30 jours est terminée. Passez au Plan Lite ou Pro pour continuer à profiter de toutes les fonctionnalités.',
            lien: '/app/parametres/abonnement',
          })

          // Audit
          await supabase.from('audit_logs').insert({
            atelier_id: atelier.id,
            action: 'trial_expired',
            table_name: 'ateliers',
            record_id: atelier.id,
            new_data: { plan: 'lite', reason: 'trial_expired' },
          })

          results.expired++
        } catch (err) {
          results.errors.push(`Erreur downgrade atelier ${atelier.id}: ${err}`)
        }
      }
    }

    // ─── 2. Rappels avant expiration ───
    const reminderDays = [7, 3, 1]
    
    for (const days of reminderDays) {
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + days)
      const startOfDay = new Date(targetDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(targetDate)
      endOfDay.setHours(23, 59, 59, 999)

      const { data: ateliersToRemind } = await supabase
        .from('ateliers')
        .select('id, name, email, trial_ends_at')
        .gte('trial_ends_at', startOfDay.toISOString())
        .lte('trial_ends_at', endOfDay.toISOString())
        .is('stripe_subscription_id', null)

      if (ateliersToRemind && ateliersToRemind.length > 0) {
        for (const atelier of ateliersToRemind) {
          try {
            // Créer une alerte
            await supabase.from('alertes').insert({
              atelier_id: atelier.id,
              type: 'trial_reminder',
              titre: `Votre essai gratuit expire dans ${days} jour${days > 1 ? 's' : ''}`,
              message: days === 1
                ? 'Dernier jour ! Souscrivez maintenant pour ne pas perdre l\'accès aux fonctionnalités Pro.'
                : `Il vous reste ${days} jours d'essai. Choisissez votre plan pour continuer sans interruption.`,
              lien: '/app/parametres/abonnement',
            })

            // Ajouter à la queue email
            if (atelier.email) {
              await supabase.from('email_queue').insert({
                atelier_id: atelier.id,
                to: atelier.email,
                subject: `ThermoGestion - Votre essai expire dans ${days} jour${days > 1 ? 's' : ''}`,
                template: 'trial_reminder',
                data: {
                  atelier_name: atelier.name,
                  days_remaining: days,
                  trial_end: atelier.trial_ends_at,
                  upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://thermogestion.vercel.app'}/app/parametres/abonnement`,
                },
                status: 'pending',
              })
            }

            if (days === 7) results.reminded_j7++
            else if (days === 3) results.reminded_j3++
            else if (days === 1) results.reminded_j1++
          } catch (err) {
            results.errors.push(`Erreur rappel J-${days} atelier ${atelier.id}: ${err}`)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error: unknown) {
    console.error('Erreur cron trial-check:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification des essais' },
      { status: 500 }
    )
  }
}
