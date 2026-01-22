'use client'

import { useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface QuickStatusUpdateProps {
  projetId: string
  currentStatus: string
  onUpdate?: () => void
  size?: 'sm' | 'md'
}

const statuses = [
  { value: 'devis', label: 'Devis', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'en_cuisson', label: 'Cuisson', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'qc', label: 'Contrôle', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'pret', label: 'Prêt', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'livre', label: 'Livré', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
]

export default function QuickStatusUpdate({ projetId, currentStatus, onUpdate, size = 'md' }: QuickStatusUpdateProps) {
  const supabase = createClientComponentClient()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)

  const currentStatusInfo = statuses.find(s => s.value === status) || statuses[0]

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) {
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('projets')
        .update({ status: newStatus })
        .eq('id', projetId)

      if (!error) {
        setStatus(newStatus)
        onUpdate?.()
      }
    } catch (e) {
      console.error('Error updating status:', e)
    }
    setLoading(false)
    setIsOpen(false)
  }

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm'

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full border font-medium transition-all ${currentStatusInfo.color} hover:shadow-md`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <span>{currentStatusInfo.label}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsOpen(false)
            }} 
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-200">
            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleStatusChange(s.value)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  s.value === status ? 'bg-gray-50 dark:bg-gray-700' : ''
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`} />
                <span className="flex-1 text-left">{s.label}</span>
                {s.value === status && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
