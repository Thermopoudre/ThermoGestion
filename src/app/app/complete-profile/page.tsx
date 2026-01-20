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

  // Vérifier si l'utilisateur existe déjà
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .single()

  if (existingUser) {
    redirect('/app/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 mb-4">
          Profil incomplet
        </h1>
        
        <p className="text-gray-600 mb-6">
          Votre compte a été créé mais le profil n'est pas encore configuré.
          Veuillez contacter le support pour finaliser votre inscription.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Email :</strong> {authUser.email}
          </p>
        </div>

        <Link
          href="/auth/logout"
          className="block w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold py-3 rounded-lg hover:from-blue-500 hover:to-cyan-400 transition-all text-center"
        >
          Se déconnecter
        </Link>
      </div>
    </div>
  )
}
