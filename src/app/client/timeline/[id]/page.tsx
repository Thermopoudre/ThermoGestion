'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { 
  Package, Clock, Flame, CheckCircle, Truck,
  Calendar, User, Phone, Mail, MessageSquare,
  ArrowLeft, Share2, Bell, BellOff
} from 'lucide-react'
import Link from 'next/link'

interface Projet {
  id: string
  numero: string
  description: string
  status: string
  date_reception: string
  date_livraison_prevue: string | null
  client: { 
    full_name: string
    email: string
    telephone: string
  } | null
  atelier: {
    nom: string
    telephone: string
    email: string
  } | null
  poudre: { nom: string; code_ral: string } | null
  pieces_count: number
  notes: string | null
}

const statusSteps = [
  { id: 'recu', label: 'Commande reçue', icon: Package, description: 'Votre commande a été enregistrée' },
  { id: 'en_preparation', label: 'En préparation', icon: Clock, description: 'Préparation des pièces en cours' },
  { id: 'en_cours', label: 'Thermolaquage', icon: Flame, description: 'Application de la poudre et cuisson' },
  { id: 'termine', label: 'Terminé', icon: CheckCircle, description: 'Prêt pour récupération/livraison' },
  { id: 'livre', label: 'Livré', icon: Truck, description: 'Projet livré' },
]

export default function TimelinePage() {
  const params = useParams()
  const router = useRouter()
  const [projet, setProjet] = useState<Projet | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadProjet()
  }, [params.id])

  async function loadProjet() {
    const supabase = createBrowserClient()

    // Vérification ownership : on récupère le client_id de l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/client/auth/login')
      return
    }

    const { data: clientUser } = await supabase
      .from('client_users')
      .select('client_id, atelier_id')
      .eq('id', user.id)
      .single()

    if (!clientUser) {
      router.push('/client/auth/login')
      return
    }

    // Ne charger que les projets appartenant à ce client
    const { data, error } = await supabase
      .from('projets')
      .select(`
        id, numero, description, status, date_reception, date_livraison_prevue, pieces_count, notes,
        client:clients(full_name, email, telephone),
        atelier:ateliers(nom, telephone, email),
        poudre:poudres(nom, code_ral)
      `)
      .eq('id', params.id)
      .eq('client_id', clientUser.client_id)
      .eq('atelier_id', clientUser.atelier_id)
      .single()

    if (error || !data) {
      router.push('/client/projets?error=not_found')
      return
    }

    setProjet(data as Projet)
    setLoading(false)
  }

  function shareProject() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: `Suivi projet ${projet?.numero}`,
        text: 'Suivez l\'avancement de votre projet de thermolaquage',
        url,
      })
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function getStatusIndex(status: string) {
    return statusSteps.findIndex(s => s.id === status)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!projet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Projet non trouvé</h1>
          <p className="text-gray-500 mb-4">Ce projet n'existe pas ou a été supprimé</p>
          <Link href="/client/dashboard" className="text-orange-500 hover:underline">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  const currentStatusIndex = getStatusIndex(projet.status)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/client/dashboard" 
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Retour</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`p-2 rounded-lg ${
                  notificationsEnabled 
                    ? 'bg-orange-100 text-orange-600' 
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </button>
              <button
                onClick={shareProject}
                className="p-2 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Project Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Numéro de commande</p>
              <h1 className="text-2xl font-black text-orange-500">{projet.numero}</h1>
            </div>
            {projet.poudre && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: `#${projet.poudre.code_ral || 'ccc'}` }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{projet.poudre.nom}</span>
              </div>
            )}
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {projet.description || 'Projet de thermolaquage'}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Reçu le {new Date(projet.date_reception).toLocaleDateString('fr-FR')}</span>
            </div>
            {projet.date_livraison_prevue && (
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>Livraison prévue : {new Date(projet.date_livraison_prevue).toLocaleDateString('fr-FR')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="font-bold text-gray-900 dark:text-white mb-6">Suivi de commande</h2>
          
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            <div 
              className="absolute left-6 top-0 w-0.5 bg-orange-500 transition-all duration-500"
              style={{ 
                height: `${Math.min(100, ((currentStatusIndex + 1) / statusSteps.length) * 100)}%` 
              }}
            />

            {/* Steps */}
            <div className="space-y-8">
              {statusSteps.map((step, index) => {
                const Icon = step.icon
                const isActive = index <= currentStatusIndex
                const isCurrent = index === currentStatusIndex
                
                return (
                  <div key={step.id} className="relative flex items-start gap-4">
                    {/* Icon */}
                    <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isActive 
                        ? isCurrent 
                          ? 'bg-orange-500 text-white ring-4 ring-orange-100 dark:ring-orange-900/50' 
                          : 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <h3 className={`font-bold ${
                        isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </h3>
                      <p className={`text-sm ${
                        isActive ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'
                      }`}>
                        {step.description}
                      </p>
                      {isCurrent && (
                        <span className="inline-block mt-2 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-full">
                          En cours
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Contact Card */}
        {projet.atelier && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">Contacter l'atelier</h2>
            
            <div className="space-y-3">
              <p className="font-medium text-gray-700 dark:text-gray-300">{projet.atelier.nom}</p>
              
              {projet.atelier.telephone && (
                <a 
                  href={`tel:${projet.atelier.telephone}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Phone className="w-5 h-5 text-orange-500" />
                  <span className="text-gray-700 dark:text-gray-300">{projet.atelier.telephone}</span>
                </a>
              )}
              
              {projet.atelier.email && (
                <a 
                  href={`mailto:${projet.atelier.email}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Mail className="w-5 h-5 text-orange-500" />
                  <span className="text-gray-700 dark:text-gray-300">{projet.atelier.email}</span>
                </a>
              )}
              
              <Link 
                href={`/client/messages?projet=${projet.id}`}
                className="flex items-center justify-center gap-2 w-full p-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Envoyer un message
              </Link>
            </div>
          </div>
        )}

        {/* Copy Feedback */}
        {copied && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">
            Lien copié !
          </div>
        )}
      </div>
    </div>
  )
}
