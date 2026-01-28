'use client'

import { CheckCircle2, Circle, Clock, Package, Flame, ClipboardCheck, Gift, Truck } from 'lucide-react'

interface ProjetTimelineProps {
  currentStatus: string
  className?: string
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const statusSteps = [
  { 
    key: 'devis', 
    label: 'Devis accepté', 
    icon: Package,
    color: 'gray'
  },
  { 
    key: 'en_cours', 
    label: 'En production', 
    icon: Clock,
    color: 'blue'
  },
  { 
    key: 'en_cuisson', 
    label: 'Cuisson', 
    icon: Flame,
    color: 'orange'
  },
  { 
    key: 'qc', 
    label: 'Contrôle qualité', 
    icon: ClipboardCheck,
    color: 'purple'
  },
  { 
    key: 'pret', 
    label: 'Prêt', 
    icon: Gift,
    color: 'green'
  },
  { 
    key: 'livre', 
    label: 'Livré', 
    icon: Truck,
    color: 'emerald'
  },
]

const colorClasses: Record<string, { bg: string; text: string; border: string; line: string }> = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', line: 'bg-gray-300' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300', line: 'bg-blue-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300', line: 'bg-orange-400' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300', line: 'bg-purple-400' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300', line: 'bg-green-400' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-300', line: 'bg-emerald-400' },
  completed: { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500', line: 'bg-green-500' },
  inactive: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-300 dark:text-gray-600', border: 'border-gray-200 dark:border-gray-700', line: 'bg-gray-200 dark:bg-gray-700' },
}

export default function ProjetTimeline({ currentStatus, className = '', showLabels = true, size = 'md' }: ProjetTimelineProps) {
  const currentIndex = statusSteps.findIndex(s => s.key === currentStatus)
  
  // Tailles responsives
  const sizeClasses = {
    sm: { icon: 'w-8 h-8', iconInner: 'w-4 h-4', text: 'text-xs', gap: 'gap-1' },
    md: { icon: 'w-10 h-10', iconInner: 'w-5 h-5', text: 'text-sm', gap: 'gap-2' },
    lg: { icon: 'w-12 h-12', iconInner: 'w-6 h-6', text: 'text-base', gap: 'gap-3' },
  }

  const sizes = sizeClasses[size]

  return (
    <div className={`${className}`}>
      {/* Version horizontale pour desktop */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Ligne de progression en arrière-plan */}
        <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div 
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIndex / (statusSteps.length - 1)) * 100)}%` }}
        />

        {statusSteps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isUpcoming = index > currentIndex

          let colors: typeof colorClasses[string]
          if (isCompleted) {
            colors = colorClasses.completed
          } else if (isCurrent) {
            colors = colorClasses[step.color]
          } else {
            colors = colorClasses.inactive
          }

          return (
            <div key={step.key} className={`flex flex-col items-center ${sizes.gap} relative z-10`}>
              <div 
                className={`${sizes.icon} rounded-full flex items-center justify-center border-2 transition-all duration-300 ${colors.bg} ${colors.border} ${
                  isCurrent ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-opacity-30 shadow-lg scale-110' : ''
                } ${
                  isCurrent ? `ring-${step.color}-400` : ''
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className={`${sizes.iconInner} ${colors.text}`} />
                ) : (
                  <Icon className={`${sizes.iconInner} ${colors.text}`} />
                )}
              </div>
              {showLabels && (
                <span className={`${sizes.text} font-medium text-center whitespace-nowrap ${
                  isCurrent ? 'text-gray-900 dark:text-white' : 
                  isCompleted ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  {step.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Version verticale pour mobile */}
      <div className="md:hidden space-y-3">
        {statusSteps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isLast = index === statusSteps.length - 1

          let colors: typeof colorClasses[string]
          if (isCompleted) {
            colors = colorClasses.completed
          } else if (isCurrent) {
            colors = colorClasses[step.color]
          } else {
            colors = colorClasses.inactive
          }

          return (
            <div key={step.key} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${colors.bg} ${colors.border} ${
                    isCurrent ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-opacity-30 shadow-lg' : ''
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-8 ${isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
              <div className="pt-2">
                <p className={`font-medium ${
                  isCurrent ? 'text-gray-900 dark:text-white' : 
                  isCompleted ? 'text-green-600' : 
                  'text-gray-400'
                }`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-sm text-orange-500 dark:text-orange-400 mt-0.5">
                    En cours
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
