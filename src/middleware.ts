import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Liste des emails superadmin (depuis env, évaluée une seule fois)
function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS || ''
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

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

  const pathname = request.nextUrl.pathname

  // Routes protégées atelier (nécessitent authentification atelier)
  const isAtelierRoute = pathname.startsWith('/app')
  
  // Routes protégées client (nécessitent authentification client)
  const isClientRoute = pathname.startsWith('/client') && 
                        !pathname.startsWith('/client/auth')

  // Routes superadmin (/admin/*)
  const isAdminRoute = pathname.startsWith('/admin')

  // Si route atelier et pas connecté -> rediriger vers login atelier
  if (isAtelierRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Si route client et pas connecté -> rediriger vers login client
  if (isClientRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/client/auth/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // ─── Protection routes ADMIN (superadmin uniquement) ───
  if (isAdminRoute) {
    // Pas connecté -> 404 (ne pas révéler l'existence de la route)
    if (!user || !user.email) {
      const url = request.nextUrl.clone()
      url.pathname = '/not-found'
      return NextResponse.rewrite(url)
    }

    // Vérifier si l'email est dans la liste des superadmins
    const superAdmins = getSuperAdminEmails()
    if (!superAdmins.includes(user.email.toLowerCase())) {
      // Utilisateur connecté mais pas superadmin -> 404
      const url = request.nextUrl.clone()
      url.pathname = '/not-found'
      return NextResponse.rewrite(url)
    }
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
