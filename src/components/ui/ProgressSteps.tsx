'use client'

import { Check } from 'lucide-react'

interface Step {
  id: string
  label: string
  description?: string
}

interface ProgressStepsProps {
  steps: Step[]
  currentStep: number
  onChange?: (step: number) => void
  allowNavigation?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function ProgressSteps({
  steps,
  currentStep,
  onChange,
  allowNavigation = false,
  orientation = 'horizontal',
}: ProgressStepsProps) {
  const handleClick = (index: number) => {
    if (allowNavigation && onChange && index <= currentStep) {
      onChange(index)
    }
  }

  if (orientation === 'vertical') {
    return (
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = allowNavigation && index <= currentStep

          return (
            <div
              key={step.id}
              className={`flex gap-4 ${isClickable ? 'cursor-pointer' : ''}`}
              onClick={() => handleClick(index)}
            >
              {/* Indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    transition-all duration-300
                    ${isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-orange-500 text-white ring-4 ring-orange-100 dark:ring-orange-900/30'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-12 mt-2 transition-colors ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pt-1.5">
                <p
                  className={`font-medium transition-colors ${
                    isCurrent
                      ? 'text-orange-600 dark:text-orange-400'
                      : isCompleted
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Horizontal orientation
  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden md:flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = allowNavigation && index <= currentStep

          return (
            <div key={step.id} className="flex-1 relative">
              <div
                className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : ''}`}
                onClick={() => handleClick(index)}
              >
                {/* Indicator */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center z-10
                    transition-all duration-300
                    ${isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-orange-500 text-white ring-4 ring-orange-100 dark:ring-orange-900/30'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <p
                  className={`mt-2 text-sm font-medium text-center transition-colors ${
                    isCurrent
                      ? 'text-orange-600 dark:text-orange-400'
                      : isCompleted
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    absolute top-5 left-1/2 w-full h-0.5
                    transition-colors duration-300
                    ${isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile - compact */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Étape {currentStep + 1} sur {steps.length}
          </span>
          <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
            {steps[currentStep]?.label}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
