import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Éviter toute logique entre createServerClient et
  // supabase.auth.getUser(). Un simple appel getUser() est nécessaire
  // pour rafraîchir la session si elle est expirée.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes protégées atelier (nécessitent authentification atelier)
  const isAtelierRoute = request.nextUrl.pathname.startsWith('/app')
  
  // Routes protégées client (nécessitent authentification client)
  const isClientRoute = request.nextUrl.pathname.startsWith('/client') && 
                        !request.nextUrl.pathname.startsWith('/client/auth')

  // Si route atelier et pas connecté -> rediriger vers login atelier
  if (isAtelierRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Si route client et pas connecté -> rediriger vers login client
  if (isClientRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/client/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // NE PAS rediriger automatiquement de login vers dashboard
  // Cela évite les boucles de redirection si getUser() retourne des résultats 
  // différents entre le middleware et les server components
  // La page login gère elle-même la redirection si l'utilisateur est connecté

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
