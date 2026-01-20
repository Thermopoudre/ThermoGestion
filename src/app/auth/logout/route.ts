import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  
  // Utiliser l'URL de la requête pour construire l'URL de redirection
  const url = new URL('/auth/login', request.url)
  return NextResponse.redirect(url)
}

// Permettre aussi la déconnexion via GET pour les liens
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  
  // Utiliser l'URL de la requête pour construire l'URL de redirection
  const url = new URL('/auth/login', request.url)
  return NextResponse.redirect(url)
}
