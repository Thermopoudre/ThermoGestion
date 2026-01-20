// Middleware pour protéger les routes portail client
// Vérifie que l'utilisateur est un client (pas un utilisateur atelier)

import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si pas connecté, rediriger vers login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/client/auth/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Vérifier que c'est un compte client
  const { data: clientUser, error } = await supabase
    .from('client_users')
    .select('id')
    .eq('id', user.id)
    .single()

  // Si ce n'est pas un compte client, rediriger vers login avec erreur
  if (error || !clientUser) {
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/client/auth/login'
    url.searchParams.set('error', 'not_client')
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/client/projets/:path*',
    '/client/devis/:path*',
    '/client/factures/:path*',
  ],
}
