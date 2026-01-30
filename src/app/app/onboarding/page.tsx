'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase/client'

const steps = [
  {
    id: 1,
    title: 'Bienvenue sur ThermoGestion !',
    description: 'Votre outil de gestion complet pour atelier de thermolaquage. Suivez ce guide pour configurer votre compte.',
    icon: '👋',
    action: null,
    completed: true,
  },
  {
    id: 2,
    title: 'Configurez votre atelier',
    description: 'Renseignez les informations légales de votre entreprise (SIRET, adresse, etc.) pour vos devis et factures.',
    icon: '🏭',
    action: '/app/parametres',
    actionLabel: 'Configurer l\'atelier',
    checkKey: 'atelier_configured',
  },
  {
    id: 3,
    title: 'Ajoutez vos poudres',
    description: 'Créez votre catalogue de poudres avec prix, couleurs RAL et couverture au m².',
    icon: '🎨',
    action: '/app/poudres/new',
    actionLabel: 'Ajouter une poudre',
    checkKey: 'has_poudres',
  },
  {
    id: 4,
    title: 'Créez votre premier client',
    description: 'Ajoutez les coordonnées de vos clients pour pouvoir leur envoyer des devis.',
    icon: '👥',
    action: '/app/clients/new',
    actionLabel: 'Ajouter un client',
    checkKey: 'has_clients',
  },
  {
    id: 5,
    title: 'Créez votre premier devis',
    description: 'Générez un devis professionnel en quelques clics avec calcul automatique.',
    icon: '📝',
    action: '/app/devis/new',
    actionLabel: 'Créer un devis',
    checkKey: 'has_devis',
  },
  {
    id: 6,
    title: 'Personnalisez vos documents',
    description: 'Choisissez un template et personnalisez les couleurs de vos devis et factures PDF.',
    icon: '🎯',
    action: '/app/parametres/templates',
    actionLabel: 'Personnaliser',
    checkKey: 'templates_configured',
  },
  {
    id: 7,
    title: 'Invitez votre équipe',
    description: 'Ajoutez des collaborateurs avec différents niveaux d\'accès (admin, opérateur, commercial).',
    icon: '👨‍👩‍👧‍👦',
    action: '/app/equipe',
    actionLabel: 'Gérer l\'équipe',
    checkKey: 'has_team',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([1])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    checkProgress()
  }, [])

  async function checkProgress() {
    const supabase = createBrowserClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('atelier_id')
      .eq('id', user.id)
      .single()

    if (!userData?.atelier_id) {
      setLoading(false)
      return
    }

    // Check each step
    const completed: number[] = [1] // Step 1 is always completed

    // Check atelier config
    const { data: atelier } = await supabase
      .from('ateliers')
      .select('siret, address, city')
      .eq('id', userData.atelier_id)
      .single()
    
    if (atelier?.siret && atelier?.address) {
      completed.push(2)
    }

    // Check poudres
    const { count: poudresCount } = await supabase
      .from('poudres')
      .select('*', { count: 'exact', head: true })
      .eq('atelier_id', userData.atelier_id)
    
    if (poudresCount && poudresCount > 0) {
      completed.push(3)
    }

    // Check clients
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('atelier_id', userData.atelier_id)
    
    if (clientsCount && clientsCount > 0) {
      completed.push(4)
    }

    // Check devis
    const { count: devisCount } = await supabase
      .from('devis')
      .select('*', { count: 'exact', head: true })
      .eq('atelier_id', userData.atelier_id)
    
    if (devisCount && devisCount > 0) {
      completed.push(5)
    }

    // Check templates (if settings exist)
    if (atelier) {
      completed.push(6) // Consider configured if atelier exists
    }

    // Check team
    const { count: teamCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('atelier_id', userData.atelier_id)
    
    if (teamCount && teamCount > 1) {
      completed.push(7)
    }

    setCompletedSteps(completed)
    setProgress(Math.round((completed.length / steps.length) * 100))
    
    // Set current step to first incomplete
    const firstIncomplete = steps.find(s => !completed.includes(s.id))
    if (firstIncomplete) {
      setCurrentStep(firstIncomplete.id)
    } else {
      setCurrentStep(steps.length)
    }
    
    setLoading(false)
  }

  async function markOnboardingComplete() {
    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)
    }
    
    router.push('/app/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  const currentStepData = steps.find(s => s.id === currentStep)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto p-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🔥</div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">
            Guide de démarrage
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configurez ThermoGestion en quelques minutes
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progression</span>
            <span>{progress}% complété</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = step.id === currentStep
            
            return (
              <div
                key={step.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 transition-all cursor-pointer ${
                  isCurrent 
                    ? 'border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900' 
                    : isCompleted 
                    ? 'border-green-500' 
                    : 'border-transparent hover:border-gray-300'
                }`}
                onClick={() => setCurrentStep(step.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    isCompleted 
                      ? 'bg-green-100 dark:bg-green-900' 
                      : isCurrent
                      ? 'bg-orange-100 dark:bg-orange-900'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {isCompleted ? '✓' : step.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold text-lg ${
                        isCompleted 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {step.title}
                      </h3>
                      {isCompleted && (
                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">
                          Complété
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {step.description}
                    </p>
                    
                    {/* Action button */}
                    {step.action && isCurrent && !isCompleted && (
                      <Link
                        href={step.action}
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg hover:from-orange-400 hover:to-red-400 transition-all"
                      >
                        {step.actionLabel}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Link
            href="/app/dashboard"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Passer pour l'instant
          </Link>
          
          {progress === 100 ? (
            <button
              onClick={markOnboardingComplete}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-400 hover:to-emerald-500 transition-all"
            >
              🎉 Commencer à utiliser ThermoGestion
            </button>
          ) : (
            <button
              onClick={() => {
                const nextStep = steps.find(s => s.id > currentStep && !completedSteps.includes(s.id))
                if (nextStep) setCurrentStep(nextStep.id)
              }}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              Étape suivante
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="mt-12 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
            💡 Astuce
          </h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Vous pouvez revenir à ce guide à tout moment depuis le menu Aide. 
            N'hésitez pas à explorer l'application, toutes vos données sont sauvegardées automatiquement !
          </p>
        </div>
      </div>
    </div>
  )
}
