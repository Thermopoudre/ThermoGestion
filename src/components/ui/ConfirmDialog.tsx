'use client'

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import { AlertTriangle, Trash2, X, CheckCircle2, Info, AlertCircle } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  icon?: ReactNode
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return context.confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOptions(options)
    setIsOpen(true)
    
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    resolver?.(true)
    setResolver(null)
  }, [resolver])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    resolver?.(false)
    setResolver(null)
  }, [resolver])

  const variantConfig = {
    danger: {
      icon: <Trash2 className="w-6 h-6" />,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
    info: {
      icon: <Info className="w-6 h-6" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6" />,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      buttonBg: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    },
  }

  const config = variantConfig[options?.variant || 'danger']

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-full ${config.iconBg} ${config.iconColor} flex items-center justify-center mx-auto mb-4`}>
                {options?.icon || config.icon}
              </div>

              {/* Content */}
              <h3 
                id="confirm-title"
                className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2"
              >
                {options?.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                {options?.message}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:ring-2 focus:ring-gray-400 focus:outline-none"
                >
                  {options?.cancelText || 'Annuler'}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 px-4 py-3 text-white font-medium rounded-xl transition-colors focus:ring-2 focus:outline-none ${config.buttonBg}`}
                  autoFocus
                >
                  {options?.confirmText || 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

// Standalone confirmation dialog component
interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantConfig = {
    danger: {
      icon: <Trash2 className="w-6 h-6" />,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      buttonBg: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      icon: <Info className="w-6 h-6" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6" />,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      buttonBg: 'bg-green-600 hover:bg-green-700',
    },
  }

  const config = variantConfig[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className={`w-14 h-14 rounded-full ${config.iconBg} ${config.iconColor} flex items-center justify-center mx-auto mb-4`}>
            {config.icon}
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            {message}
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-3 text-white font-medium rounded-xl transition-colors disabled:opacity-50 ${config.buttonBg} flex items-center justify-center gap-2`}
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
