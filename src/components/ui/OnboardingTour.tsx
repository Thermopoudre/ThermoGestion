'use client'

import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { X, ArrowRight, ArrowLeft, CheckCircle2, Lightbulb } from 'lucide-react'

interface TourStep {
  target: string // CSS selector
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: () => void
}

interface OnboardingContextType {
  startTour: (tourId: string, steps: TourStep[]) => void
  endTour: () => void
  isActive: boolean
  markComplete: (tourId: string) => void
  hasCompleted: (tourId: string) => boolean
}

const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [currentTourId, setCurrentTourId] = useState<string | null>(null)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set())

  // Load completed tours from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('thermogestion_completed_tours')
    if (stored) {
      setCompletedTours(new Set(JSON.parse(stored)))
    }
  }, [])

  // Update target position
  useEffect(() => {
    if (!isActive || steps.length === 0) return

    const updatePosition = () => {
      const step = steps[currentStep]
      const element = document.querySelector(step.target)
      if (element) {
        const rect = element.getBoundingClientRect()
        setTargetRect(rect)
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isActive, currentStep, steps])

  const startTour = (tourId: string, tourSteps: TourStep[]) => {
    if (completedTours.has(tourId)) return
    setCurrentTourId(tourId)
    setSteps(tourSteps)
    setCurrentStep(0)
    setIsActive(true)
  }

  const endTour = () => {
    setIsActive(false)
    setCurrentTourId(null)
    setSteps([])
    setCurrentStep(0)
    setTargetRect(null)
  }

  const markComplete = (tourId: string) => {
    const newCompleted = new Set(completedTours)
    newCompleted.add(tourId)
    setCompletedTours(newCompleted)
    localStorage.setItem('thermogestion_completed_tours', JSON.stringify([...newCompleted]))
    endTour()
  }

  const hasCompleted = (tourId: string) => completedTours.has(tourId)

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      const step = steps[currentStep]
      step.action?.()
      setCurrentStep(currentStep + 1)
    } else {
      if (currentTourId) markComplete(currentTourId)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const step = steps[currentStep]

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return {}

    const padding = 16
    const tooltipWidth = 320
    const tooltipHeight = 180
    const position = step?.position || 'bottom'

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipHeight - padding
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
      case 'bottom':
        top = targetRect.bottom + padding
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.left - tooltipWidth - padding
        break
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.right + padding
        break
    }

    // Clamp to viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding))

    return { top, left, width: tooltipWidth }
  }

  return (
    <OnboardingContext.Provider value={{ startTour, endTour, isActive, markComplete, hasCompleted }}>
      {children}

      {isActive && step && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Dark overlay with cutout */}
            <div 
              className="absolute inset-0 bg-black/60 transition-all duration-300"
              style={{
                clipPath: targetRect 
                  ? `polygon(
                      0% 0%, 
                      0% 100%, 
                      ${targetRect.left - 8}px 100%, 
                      ${targetRect.left - 8}px ${targetRect.top - 8}px, 
                      ${targetRect.right + 8}px ${targetRect.top - 8}px, 
                      ${targetRect.right + 8}px ${targetRect.bottom + 8}px, 
                      ${targetRect.left - 8}px ${targetRect.bottom + 8}px, 
                      ${targetRect.left - 8}px 100%, 
                      100% 100%, 
                      100% 0%
                    )`
                  : undefined
              }}
            />

            {/* Target highlight */}
            {targetRect && (
              <div
                className="absolute border-2 border-orange-500 rounded-lg ring-4 ring-orange-500/30 transition-all duration-300"
                style={{
                  top: targetRect.top - 8,
                  left: targetRect.left - 8,
                  width: targetRect.width + 16,
                  height: targetRect.height + 16,
                }}
              />
            )}
          </div>

          {/* Tooltip */}
          <div
            className="fixed z-[101] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-200"
            style={getTooltipStyle()}
          >
            {/* Close button */}
            <button
              onClick={endTour}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5" />
            </div>

            {/* Content */}
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">
              {step.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {step.content}
            </p>

            {/* Progress & Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep
                        ? 'bg-orange-500'
                        : index < currentStep
                        ? 'bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="px-4 py-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Terminer
                    </>
                  ) : (
                    <>
                      Suivant
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </OnboardingContext.Provider>
  )
}

// Pre-built tour for dashboard
export const dashboardTourSteps: TourStep[] = [
  {
    target: '[data-tour="kpi-cards"]',
    title: 'Vos indicateurs clés',
    content: 'Visualisez en un coup d\'œil vos projets actifs, chiffre d\'affaires et alertes importantes.',
    position: 'bottom',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Actions rapides',
    content: 'Créez rapidement un nouveau projet, devis ou client depuis ce menu.',
    position: 'left',
  },
  {
    target: '[data-tour="search"]',
    title: 'Recherche globale',
    content: 'Utilisez ⌘K pour rechercher instantanément clients, projets et devis.',
    position: 'bottom',
  },
  {
    target: '[data-tour="navigation"]',
    title: 'Navigation',
    content: 'Accédez à toutes les sections depuis le menu. Utilisez les raccourcis clavier pour aller plus vite !',
    position: 'right',
  },
]
