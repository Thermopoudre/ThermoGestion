'use client'

import { 
  Clock, CheckCircle2, AlertCircle, XCircle, Package, 
  Flame, Eye, Truck, FileText, Send, ThumbsUp, Ban,
  CreditCard, AlertTriangle
} from 'lucide-react'

type ProjetStatus = 'devis' | 'en_cours' | 'en_cuisson' | 'qc' | 'pret' | 'livre' | 'annule'
type DevisStatus = 'draft' | 'sent' | 'signed' | 'refused' | 'expired'
type FactureStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
type PaymentStatus = 'unpaid' | 'partial' | 'paid'

interface StatusConfig {
  label: string
  icon: typeof Clock
  bg: string
  text: string
  border: string
  dot: string
}

// Projet statuses
const projetStatusConfig: Record<ProjetStatus, StatusConfig> = {
  devis: {
    label: 'Devis',
    icon: FileText,
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-500',
  },
  en_cours: {
    label: 'En production',
    icon: Package,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  en_cuisson: {
    label: 'Cuisson',
    icon: Flame,
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500 animate-pulse',
  },
  qc: {
    label: 'Contrôle',
    icon: Eye,
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  pret: {
    label: 'Prêt',
    icon: CheckCircle2,
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  livre: {
    label: 'Livré',
    icon: Truck,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  annule: {
    label: 'Annulé',
    icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
}

// Devis statuses
const devisStatusConfig: Record<DevisStatus, StatusConfig> = {
  draft: {
    label: 'Brouillon',
    icon: FileText,
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-500',
  },
  sent: {
    label: 'Envoyé',
    icon: Send,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  signed: {
    label: 'Signé',
    icon: ThumbsUp,
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  refused: {
    label: 'Refusé',
    icon: Ban,
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  expired: {
    label: 'Expiré',
    icon: Clock,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
}

// Facture statuses
const factureStatusConfig: Record<FactureStatus, StatusConfig> = {
  draft: {
    label: 'Brouillon',
    icon: FileText,
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-500',
  },
  sent: {
    label: 'Envoyée',
    icon: Send,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  paid: {
    label: 'Payée',
    icon: CheckCircle2,
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  overdue: {
    label: 'En retard',
    icon: AlertTriangle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500 animate-pulse',
  },
  cancelled: {
    label: 'Annulée',
    icon: XCircle,
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-500',
    border: 'border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
}

// Payment status
const paymentStatusConfig: Record<PaymentStatus, StatusConfig> = {
  unpaid: {
    label: 'À payer',
    icon: CreditCard,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  partial: {
    label: 'Partiel',
    icon: CreditCard,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  paid: {
    label: 'Payé',
    icon: CheckCircle2,
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
}

interface StatusBadgeProps {
  status: string
  type: 'projet' | 'devis' | 'facture' | 'payment'
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showDot?: boolean
}

export function StatusBadge({
  status,
  type,
  size = 'md',
  showIcon = true,
  showDot = false,
}: StatusBadgeProps) {
  let config: StatusConfig | undefined

  switch (type) {
    case 'projet':
      config = projetStatusConfig[status as ProjetStatus]
      break
    case 'devis':
      config = devisStatusConfig[status as DevisStatus]
      break
    case 'facture':
      config = factureStatusConfig[status as FactureStatus]
      break
    case 'payment':
      config = paymentStatusConfig[status as PaymentStatus]
      break
  }

  if (!config) {
    return (
      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
        {status}
      </span>
    )
  }

  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        border ${config.bg} ${config.text} ${config.border}
        ${sizeClasses[size]}
      `}
    >
      {showDot && (
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      )}
      {showIcon && !showDot && (
        <Icon className={iconSizes[size]} />
      )}
      {config.label}
    </span>
  )
}

// Quick status selector dropdown
interface StatusSelectorProps {
  currentStatus: string
  type: 'projet' | 'devis' | 'facture'
  onChange: (status: string) => void
  disabled?: boolean
}

export function StatusSelector({ currentStatus, type, onChange, disabled }: StatusSelectorProps) {
  let options: Record<string, StatusConfig>

  switch (type) {
    case 'projet':
      options = projetStatusConfig
      break
    case 'devis':
      options = devisStatusConfig
      break
    case 'facture':
      options = factureStatusConfig
      break
    default:
      options = {}
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        px-3 py-1.5 text-sm font-medium rounded-full
        border cursor-pointer
        focus:ring-2 focus:ring-orange-500 focus:outline-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${options[currentStatus]?.bg || 'bg-gray-100'}
        ${options[currentStatus]?.text || 'text-gray-700'}
        ${options[currentStatus]?.border || 'border-gray-200'}
      `}
    >
      {Object.entries(options).map(([value, config]) => (
        <option key={value} value={value}>
          {config.label}
        </option>
      ))}
    </select>
  )
}
