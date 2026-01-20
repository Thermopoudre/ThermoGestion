import { redirect } from 'next/navigation'

// Redirection de /connexion vers /auth/login pour compatibilité
export default function ConnexionPage() {
  redirect('/auth/login')
}
