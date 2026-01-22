'use client'

import Link from 'next/link'
import { Plus, Search, FileQuestion, Package, User, FileText, Receipt, Palette } from 'lucide-react'

interface EmptyStateProps {
  icon?: 'package' | 'user' | 'file' | 'receipt' | 'palette' | 'search' | 'question'
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

const icons = {
  package: Package,
  user: User,
  file: FileText,
  receipt: Receipt,
  palette: Palette,
  search: Search,
  question: FileQuestion,
}

export default function EmptyState({
  icon = 'question',
  title,
  description,
  action,
  secondaryAction,
  className = ''
}: EmptyStateProps) {
  const Icon = icons[icon]

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      {/* Icon avec animation */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-orange-500/10 rounded-full blur-xl animate-pulse" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-2xl flex items-center justify-center">
          <Icon className="w-10 h-10 text-orange-500/60" />
        </div>
      </div>

      {/* Texte */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-gray-500 text-center max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                {action.label}
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                {action.label}
              </button>
            )
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-colors"
              >
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}

      {/* Tips */}
      {!action && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-sm">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">⌘K</kbd>
            pour créer rapidement
          </p>
        </div>
      )}
    </div>
  )
}
