import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Route de redirection pour tracker les clics sur les avis Google
export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const destination = searchParams.get('to')

    if (!destination) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Enregistrer le clic (fire and forget)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    supabase
      .from('review_requests')
      .update({ clicked_at: new Date().toISOString() })
      .eq('tracking_token', params.token)
      .then(() => {})
      .catch((err) => console.error('Erreur tracking clic avis:', err))

    // Rediriger vers Google
    return NextResponse.redirect(destination)
  } catch (error) {
    console.error('Erreur redirection avis:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
