'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ChevronDown } from 'lucide-react'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  section?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error tracking
    console.error(`[ErrorBoundary${this.props.section ? ` - ${this.props.section}` : ''}]`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6 my-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-800 dark:text-red-300 text-lg">
                {this.props.section ? `Erreur - ${this.props.section}` : 'Une erreur est survenue'}
              </h3>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                Ce composant n'a pas pu se charger correctement.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null })
                    window.location.reload()
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rafraichir
                </button>
                <Link
                  href="/app/dashboard"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </Link>
              </div>
              {this.state.error && (
                <div className="mt-4">
                  <button
                    onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`} />
                    Details techniques
                  </button>
                  {this.state.showDetails && (
                    <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-400 overflow-x-auto max-h-32">
                      {this.state.error.message}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function InlineError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-600 dark:text-red-400 flex-1">
        {message || 'Impossible de charger ces donnees'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
        >
          <RefreshCw className="w-3 h-3" />
          Reessayer
        </button>
      )}
    </div>
  )
}
