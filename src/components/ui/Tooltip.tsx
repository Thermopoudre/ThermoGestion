'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  disabled?: boolean
}

export function Tooltip({
  children,
  content,
  position = 'top',
  delay = 200,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const padding = 8

      // Check if tooltip fits in preferred position, otherwise flip
      let newPosition = position

      if (position === 'top' && triggerRect.top < tooltipRect.height + padding) {
        newPosition = 'bottom'
      } else if (position === 'bottom' && window.innerHeight - triggerRect.bottom < tooltipRect.height + padding) {
        newPosition = 'top'
      } else if (position === 'left' && triggerRect.left < tooltipRect.width + padding) {
        newPosition = 'right'
      } else if (position === 'right' && window.innerWidth - triggerRect.right < tooltipRect.width + padding) {
        newPosition = 'left'
      }

      setActualPosition(newPosition)
    }
  }, [isVisible, position])

  const showTooltip = () => {
    if (disabled) return
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700 border-y-transparent border-l-transparent',
  }

  return (
    <div 
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-sm text-white
            bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg
            whitespace-nowrap pointer-events-none
            animate-in fade-in zoom-in-95 duration-150
            ${positionClasses[actualPosition]}
          `}
        >
          {content}
          {/* Arrow */}
          <div className={`absolute border-4 ${arrowClasses[actualPosition]}`} />
        </div>
      )}
    </div>
  )
}

// Info tooltip with icon
import { HelpCircle } from 'lucide-react'

interface InfoTooltipProps {
  content: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  return (
    <Tooltip content={content} position={position}>
      <button 
        type="button" 
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Plus d'informations"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}
