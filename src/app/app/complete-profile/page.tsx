import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CompleteProfilePage() {
  const supabase = await createServerClient()
  
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  // Vérifier si l'utilisateur existe déjà avec un atelier
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select(`
      id,
      atelier_id,
      ateliers (id)
    `)
    .eq('id', authUser.id)
    .single()

  // Si l'utilisateur existe ET a un atelier valide, rediriger vers le dashboard
  if (existingUser && existingUser.atelier_id) {
    const atelier = Array.isArray(existingUser.ateliers) 
      ? existingUser.ateliers[0] 
      : existingUser.ateliers
    
    // Si l'atelier existe vraiment, rediriger vers le dashboard
    if (atelier && atelier.id) {
      redirect('/app/dashboard')
    }
  }

  // Vérifier l'état exact de l'utilisateur pour l'affichage
  const hasUserButNoAtelier = existingUser && !existingUser.atelier_id
  const hasNoUser = userError || !existingUser

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          {hasUserButNoAtelier ? 'Atelier manquant' : hasNoUser ? 'Profil non créé' : 'Profil incomplet'}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {hasUserButNoAtelier 
            ? 'Votre compte utilisateur existe mais aucun atelier n\'est associé. Veuillez contacter le support pour résoudre ce problème.'
            : hasNoUser
            ? 'Votre compte d\'authentification existe mais votre profil utilisateur n\'a pas été créé. Veuillez contacter le support.'
            : 'Votre compte a été créé mais le profil n\'est pas encore configuré. Veuillez contacter le support pour finaliser votre inscription.'}
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Email :</strong> {authUser.email}
          </p>
          {hasUserButNoAtelier && (
            <p className="text-sm text-blue-800 mt-2">
              <strong>ID Utilisateur :</strong> {authUser.id}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/logout"
            className="block w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-3 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all text-center"
          >
            Se déconnecter
          </Link>
          <a
            href="/app/complete-profile"
            className="block w-full bg-gray-100 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-200 transition-colors text-center"
          >
            Actualiser la page
          </a>
        </div>
      </div>
    </div>
  )
}
