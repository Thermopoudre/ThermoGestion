import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    await admin.rpc('refresh_dashboard_metrics')

    return NextResponse.json({
      success: true,
      refreshed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erreur refresh metrics:', error)
    return NextResponse.json({ error: 'Erreur refresh' }, { status: 500 })
  }
}
